/**
 * Conference Recorder
 * Downloads Twilio conference recordings, uploads to S3, and updates Airtable
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { twilioConfig } from '../../config/twilio';
import axios from 'axios';

const twilio = require('twilio');

export interface ConferenceRecordingOptions {
  recordingSid: string;
  recordingUrl: string;
  callSid: string;
  conferenceSid: string;
}

export interface ConferenceRecordingResult {
  success: boolean;
  transferRecordingUrl?: string;
  error?: string;
}

/**
 * Process conference recording: download from Twilio, upload to S3, update Airtable
 */
export async function processConferenceRecording(
  options: ConferenceRecordingOptions
): Promise<ConferenceRecordingResult> {
  const { recordingSid, recordingUrl, callSid, conferenceSid } = options;
  const startTime = Date.now();

  try {
    logger.info('Processing conference recording', {
      recordingSid,
      callSid,
      conferenceSid,
      type: 'conference_recording_start'
    });

    // Step 1: Download recording from Twilio
    const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const recording = await twilioClient.recordings(recordingSid).fetch();
    
    // Get the recording download URL (with .wav extension for best quality)
    const downloadUrl = `https://api.twilio.com${recording.uri.replace('.json', '.wav')}`;
    
    logger.info('Downloading conference recording from Twilio', {
      recordingSid,
      downloadUrl,
      type: 'conference_recording_download'
    });

    // Download the recording audio file
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: twilioConfig.accountSid,
        password: twilioConfig.authToken
      }
    });

    const audioBuffer = Buffer.from(response.data);

    logger.info('Conference recording downloaded', {
      recordingSid,
      size: audioBuffer.length,
      type: 'conference_recording_downloaded'
    });

    // Step 2: Load call state to get provider and employee info
    const { loadCallState } = await import('../../fsm/state/state-manager');
    const callState = await loadCallState(callSid);
    
    const providerId = callState?.provider?.id || 'unknown-provider';
    const employeeId = callState?.employee?.id || 'unknown-employee';

    // Step 3: Upload to S3
    const s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
      }
    });

    const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerId}/${employeeId}/${callSid}/transfer-recording.wav`;

    const putCommand = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/wav',
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA',
      Metadata: {
        'call-sid': callSid,
        'conference-sid': conferenceSid,
        'recording-sid': recordingSid,
        'provider': providerId,
        'employee': employeeId,
        'source': 'conference',
        'uploaded-at': new Date().toISOString()
      }
    });

    await s3Client.send(putCommand);

    logger.info('Conference recording uploaded to S3', {
      recordingSid,
      s3Key,
      size: audioBuffer.length,
      type: 'conference_recording_s3_uploaded'
    });

    // Step 4: Generate presigned URL (valid for 7 days)
    const getCommand = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: s3Key
    });

    const transferRecordingUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 604800 // 7 days
    });

    // Step 5: Update Airtable with transfer recording URL
    const { updateCallLogWithTransferRecording } = await import('../../services/airtable/call-log-service');
    
    await updateCallLogWithTransferRecording(callSid, transferRecordingUrl);

    logger.info('✅ Conference recording processed successfully', {
      recordingSid,
      callSid,
      s3Key,
      duration: Date.now() - startTime,
      type: 'conference_recording_success'
    });

    return {
      success: true,
      transferRecordingUrl
    };

  } catch (error) {
    logger.error('Failed to process conference recording', {
      recordingSid,
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'conference_recording_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

