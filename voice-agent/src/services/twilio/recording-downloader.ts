/**
 * Twilio Recording Downloader
 * Downloads completed recordings from Twilio for S3 archival
 */

import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';
import * as https from 'https';

const twilio = require('twilio');
const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

export interface DownloadRecordingOptions {
  recordingSid: string;
  format?: 'mp3' | 'wav';
}

export interface DownloadRecordingResult {
  success: boolean;
  audioBuffer?: Buffer;
  contentType?: string;
  error?: string;
  size?: number;
}

/**
 * Download a completed recording from Twilio
 * Returns audio buffer for S3 upload
 */
export async function downloadRecording(
  options: DownloadRecordingOptions
): Promise<DownloadRecordingResult> {
  const { recordingSid, format = 'mp3' } = options;
  const startTime = Date.now();

  try {
    logger.info('Downloading recording from Twilio', {
      recordingSid,
      format,
      type: 'recording_download_start'
    });

    // Fetch recording metadata
    const recording = await twilioClient.recordings(recordingSid).fetch();

    if (!recording.uri) {
      throw new Error('Recording URI not available');
    }

    // Construct download URL
    const downloadUrl = `https://api.twilio.com${recording.uri.replace('.json', `.${format}`)}`;

    // Download with authentication using native https
    const auth = Buffer.from(
      `${twilioConfig.accountSid}:${twilioConfig.authToken}`
    ).toString('base64');

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const options = {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      };

      https.get(downloadUrl, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download recording: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });

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
 */
export async function getRecordingMetadata(recordingSid: string) {
  try {
    const recording = await twilioClient.recordings(recordingSid).fetch();
    
    return {
      success: true,
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
  } catch (error) {
    logger.error('Failed to fetch recording metadata', {
      recordingSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'recording_metadata_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

