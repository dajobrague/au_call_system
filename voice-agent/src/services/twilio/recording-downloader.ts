/**
 * Twilio Recording Downloader
 * Downloads completed recordings from Twilio for S3 archival
 * 
 * Supports dual-region authentication:
 * - US1 (api.twilio.com): Uses standard authToken
 * - AU1 (api.sydney.au1.twilio.com): Uses au1AuthToken
 */

import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';
import * as https from 'https';

const twilio = require('twilio');

// US1 client (default) — for outbound call recordings
const twilioClientUS1 = twilio(twilioConfig.accountSid, twilioConfig.authToken);

// AU1 client — for inbound call recordings stored in the Australia region
const twilioClientAU1 = twilioConfig.au1AuthToken
  ? twilio(twilioConfig.accountSid, twilioConfig.au1AuthToken, { region: 'au1', edge: 'sydney' })
  : null;

/**
 * Detect if a URL targets the AU1 region
 */
function isAU1Url(url: string): boolean {
  return url.includes('au1.twilio.com');
}

/**
 * Get the correct auth token for a given Twilio URL
 * AU1 URLs require the AU1-specific auth token; all others use the default US1 token
 */
function getAuthTokenForUrl(url: string): string {
  if (isAU1Url(url) && twilioConfig.au1AuthToken) {
    return twilioConfig.au1AuthToken;
  }
  return twilioConfig.authToken;
}

export interface DownloadRecordingOptions {
  recordingSid: string;
  format?: 'mp3' | 'wav';
  /** Optional: the full recording URL from Twilio's callback (regional-aware) */
  recordingUrl?: string;
}

export interface DownloadRecordingResult {
  success: boolean;
  audioBuffer?: Buffer;
  contentType?: string;
  error?: string;
  size?: number;
}

/**
 * Download a URL following redirects (Twilio recording URLs often redirect)
 * Uses URL-embedded auth for the initial request (most reliable for Node.js https)
 */
function downloadWithRedirects(url: string, accountSid: string, authToken: string, includeAuth: boolean, maxRedirects = 5): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    // For Twilio API requests, embed auth directly in the URL (most reliable method)
    let requestUrl = url;
    if (includeAuth && accountSid && authToken) {
      try {
        const parsed = new URL(url);
        parsed.username = accountSid;
        parsed.password = authToken;
        requestUrl = parsed.toString();
      } catch {
        // If URL parsing fails, fall back to header-based auth
        requestUrl = url;
      }
    }

    https.get(requestUrl, (response) => {
      // Follow redirects (301, 302, 307, 308)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        logger.info('Following recording download redirect', {
          from: url.substring(0, 80),
          to: redirectUrl.substring(0, 80),
          statusCode: response.statusCode,
          type: 'recording_download_redirect'
        });
        // Redirected URLs (e.g., to S3) don't need Twilio auth
        resolve(downloadWithRedirects(redirectUrl, '', '', false, maxRedirects - 1));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download recording: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download a completed recording from Twilio
 * Returns audio buffer for S3 upload
 */
export async function downloadRecording(
  options: DownloadRecordingOptions
): Promise<DownloadRecordingResult> {
  const { recordingSid, format = 'mp3', recordingUrl } = options;
  const startTime = Date.now();

  try {
    logger.info('Downloading recording from Twilio', {
      recordingSid,
      format,
      hasCallbackUrl: !!recordingUrl,
      type: 'recording_download_start'
    });

    let downloadUrl: string;

    if (recordingUrl) {
      // Use the URL from Twilio's callback directly — it already has the correct region
      // Ensure it has the right format extension
      const baseUrl = recordingUrl.replace('.json', '');
      downloadUrl = baseUrl.endsWith(`.${format}`) ? baseUrl : `${baseUrl}.${format}`;
      
      logger.info('Using callback recording URL (regional)', {
        recordingSid,
        downloadUrl: downloadUrl.substring(0, 100),
        isAU1: isAU1Url(downloadUrl),
        type: 'recording_download_callback_url'
      });
    } else {
      // Fallback: try AU1 client first (inbound calls), then US1
      const client = twilioClientAU1 || twilioClientUS1;
      const recording = await client.recordings(recordingSid).fetch();

      if (!recording.uri) {
        throw new Error('Recording URI not available');
      }

      // Build URL based on which client found the recording
      const apiBase = twilioClientAU1 ? 'https://api.sydney.au1.twilio.com' : 'https://api.twilio.com';
      downloadUrl = `${apiBase}${recording.uri.replace('.json', `.${format}`)}`;
      
      logger.info('Using fetched recording URI (fallback)', {
        recordingSid,
        downloadUrl: downloadUrl.substring(0, 100),
        isAU1: isAU1Url(downloadUrl),
        type: 'recording_download_fetched_url'
      });
    }

    // Select the correct auth token based on the recording URL's region
    const authToken = getAuthTokenForUrl(downloadUrl);

    logger.info('Downloading with region-aware credentials', {
      recordingSid,
      isAU1: isAU1Url(downloadUrl),
      type: 'recording_download_auth_selected'
    });

    // Download with authentication - embed credentials in URL for reliable auth
    const audioBuffer = await downloadWithRedirects(
      downloadUrl,
      twilioConfig.accountSid,
      authToken,
      true // include auth for Twilio API
    );

    const contentType = `audio/${format}`;

    logger.info('Recording downloaded successfully', {
      recordingSid,
      size: audioBuffer.length,
      contentType,
      duration: Date.now() - startTime,
      type: 'recording_download_success'
    });

    return {
      success: true,
      audioBuffer,
      contentType,
      size: audioBuffer.length
    };

  } catch (error) {
    logger.error('Failed to download recording', {
      recordingSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'recording_download_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get recording metadata without downloading
 * Tries AU1 client first (for inbound recordings), falls back to US1
 */
export async function getRecordingMetadata(recordingSid: string) {
  // Try AU1 first if available (inbound call recordings are in AU1)
  const clients = twilioClientAU1
    ? [{ client: twilioClientAU1, label: 'AU1' }, { client: twilioClientUS1, label: 'US1' }]
    : [{ client: twilioClientUS1, label: 'US1' }];

  for (const { client, label } of clients) {
    try {
      const recording = await client.recordings(recordingSid).fetch();
      
      return {
        success: true,
        region: label,
        metadata: {
          sid: recording.sid,
          duration: recording.duration,
          channels: recording.channels,
          source: recording.source,
          status: recording.status,
          dateCreated: recording.dateCreated,
          callSid: recording.callSid
        }
      };
    } catch {
      // Try next client
    }
  }

  logger.error('Failed to fetch recording metadata from any region', {
    recordingSid,
    type: 'recording_metadata_error'
  });

  return {
    success: false,
    error: 'Recording not found in any region'
  };
}

