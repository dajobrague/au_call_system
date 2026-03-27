/**
 * Twilio Recording Status Callback
 * Handles recording completion notifications
 * NDIS Compliance Flow: Twilio → S3 (ap-southeast-2) → Airtable → Delete from Twilio
 * 
 * Supports dual-region recordings:
 * - AU1 recordings (inbound calls): uses AU1 auth token
 * - US1 recordings (outbound calls): uses default auth token
 * Region is auto-detected from the RecordingUrl in Twilio's callback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { downloadRecording } from '@/services/twilio/recording-downloader';
import { scheduleRecordingDeletion } from '@/services/twilio/recording-manager';
import type { TwilioRegion } from '@/services/twilio/recording-manager';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { airtableClient } from '@/services/airtable/client';
import { env } from '@/config/env';

/**
 * Detect Twilio region from a recording URL
 */
function detectRegion(url: string): TwilioRegion {
  return url.includes('au1.twilio.com') ? 'au1' : 'us1';
}

const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';

/**
 * Find Call Log record by CallSid
 */
async function findCallLogByCallSid(callSid: string): Promise<any> {
  try {
    const records = await airtableClient.findRecords(
      CALL_LOGS_TABLE_ID,
      `{CallSid} = "${callSid}"`
    );

    if (records.length === 0) {
      logger.warn('Call log not found for CallSid', {
        callSid,
        type: 'call_log_not_found'
      });
      return null;
    }

    return records[0];
  } catch (error) {
    logger.error('Error finding call log', {
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'call_log_find_error'
    });
    return null;
  }
}

/**
 * Extract provider and employee info from call log
 */
function extractProviderEmployee(callLog: any): { provider?: string; employee?: string } {
  try {
    // Provider is a linked record - get the name from linked data
    const providerArray = callLog.fields?.Provider;
    const employeeArray = callLog.fields?.Employee;

    return {
      provider: providerArray && providerArray.length > 0 ? String(providerArray[0]) : undefined,
      employee: employeeArray && employeeArray.length > 0 ? String(employeeArray[0]) : undefined
    };
  } catch (error) {
    logger.warn('Could not extract provider/employee info', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'provider_employee_extract_warning'
    });
    return {};
  }
}

/**
 * POST /api/twilio/recording-status
 * Receives recording status updates from Twilio
 * 
 * Flow:
 * 1. Receive callback from Twilio
 * 2. Download recording from Twilio
 * 3. Upload to S3 (ap-southeast-2) with SSE-S3 encryption
 * 4. Update Airtable with S3 URL
 * 5. Schedule Twilio recording deletion (24h retention)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Log immediately to confirm endpoint is being called
  logger.info('📼 Recording status endpoint called', {
    url: request.url,
    method: request.method,
    type: 'recording_status_endpoint_called'
  });
  
  try {
    const formData = await request.formData();
    
    const callSid = formData.get('CallSid') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingStatus = formData.get('RecordingStatus') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;
    const recordingChannels = formData.get('RecordingChannels') as string;
    
    logger.info('Recording status callback received', {
      callSid,
      recordingSid,
      recordingStatus,
      recordingDuration,
      recordingChannels,
      recordingUrl,
      duration: Date.now() - startTime,
      type: 'recording_status_callback'
    });
    
    if (recordingStatus === 'completed') {
      // Detect which Twilio region holds this recording based on the callback URL
      const region = detectRegion(recordingUrl || '');

      logger.info('Recording completed, starting S3 archival process', {
        callSid,
        recordingSid,
        recordingDuration,
        region,
        type: 'recording_archival_start'
      });

      // Step 1: Find call log to get provider/employee info (do this first so we can
      // still update Airtable even if the download fails)
      const callLog = await findCallLogByCallSid(callSid);
      const { provider, employee } = extractProviderEmployee(callLog);

      // Determine if this is a transfer recording (second recording for same CallSid)
      const existingRecordingUrl = callLog?.fields?.['Recording URL (Twilio/S3)'];
      const isTransferRecording = !!existingRecordingUrl;

      if (isTransferRecording) {
        logger.info('Existing recording found - this is a transfer recording', {
          callSid,
          recordingSid,
          type: 'transfer_recording_detected'
        });
      }

      // Step 2: Attempt to download recording from Twilio
      // The downloader auto-selects AU1 or US1 credentials based on the URL
      let downloadedBuffer: Buffer | null = null;

      if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET) {
        const downloadResult = await downloadRecording({
          recordingSid,
          format: 'mp3',
          recordingUrl: recordingUrl || undefined
        });

        if (downloadResult.success && downloadResult.audioBuffer) {
          downloadedBuffer = downloadResult.audioBuffer;
          logger.info('Recording downloaded from Twilio', {
            callSid,
            recordingSid,
            region,
            size: downloadResult.audioBuffer.length,
            type: 'recording_download_success'
          });
        } else {
          // Download failed — log but do NOT throw; we'll fall back to the Twilio URL
          logger.warn('Recording download failed, will store Twilio URL as fallback', {
            callSid,
            recordingSid,
            region,
            error: downloadResult.error,
            type: 'recording_download_failed_fallback'
          });
        }
      } else {
        logger.warn('S3 credentials not configured, storing Twilio URL directly', {
          callSid,
          recordingSid,
          type: 'recording_s3_not_configured'
        });
      }

      // Step 3: Upload to S3 or fall back to Twilio URL
      let finalRecordingUrl: string;
      let shouldDeleteFromTwilio = false;
      let uploadedToS3 = false;

      const providerSlug = provider || 'unknown-provider';
      const employeeSlug = employee || 'unknown-employee';
      const s3FileName = isTransferRecording ? 'twilio-transfer-recording.mp3' : 'twilio-recording.mp3';
      const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${callSid}/${s3FileName}`;

      if (downloadedBuffer) {
        try {
          const s3Client = new S3Client({
            region: env.AWS_REGION,
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY
            }
          });

          const putCommand = new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: s3Key,
            Body: downloadedBuffer,
            ContentType: 'audio/mpeg',
            ServerSideEncryption: 'AES256',
            StorageClass: 'STANDARD_IA',
            Metadata: {
              'call-sid': callSid,
              'recording-sid': recordingSid,
              'provider': providerSlug,
              'employee': employeeSlug,
              'duration': recordingDuration,
              'region': region,
              'uploaded-at': new Date().toISOString()
            }
          });

          await s3Client.send(putCommand);

          // Generate presigned URL (valid for 7 days)
          const getCommand = new GetObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: s3Key
          });
          
          const s3Url = await getSignedUrl(s3Client, getCommand, { 
            expiresIn: 604800 // 7 days
          });

          finalRecordingUrl = s3Url;
          shouldDeleteFromTwilio = true;
          uploadedToS3 = true;

          logger.info('Recording uploaded to S3 successfully', {
            callSid,
            recordingSid,
            s3Key,
            region,
            size: downloadedBuffer.length,
            type: 'recording_s3_upload_success'
          });

        } catch (s3Error) {
          // S3 upload failed — fall back to Twilio URL
          logger.warn('S3 upload failed, using Twilio URL as fallback', {
            callSid,
            recordingSid,
            error: s3Error instanceof Error ? s3Error.message : 'Unknown error',
            type: 'recording_s3_fallback_to_twilio'
          });

          const twilioFullUrl = recordingUrl.includes('http') 
            ? recordingUrl 
            : `https://api.twilio.com${recordingUrl}`;
          
          finalRecordingUrl = twilioFullUrl.replace('.json', '') + '.mp3';
          shouldDeleteFromTwilio = false;
          uploadedToS3 = false;
        }
      } else {
        // No downloaded buffer — store the Twilio URL directly
        const twilioFullUrl = recordingUrl.includes('http') 
          ? recordingUrl 
          : `https://api.twilio.com${recordingUrl}`;
        
        finalRecordingUrl = twilioFullUrl.replace('.json', '') + '.mp3';
        shouldDeleteFromTwilio = false;
        uploadedToS3 = false;
      }

      // Step 4: Update Airtable with recording URL (S3 or Twilio fallback)
      if (callLog) {
        try {
          const airtableField = isTransferRecording 
            ? 'Transfer Recording URL' 
            : 'Recording URL (Twilio/S3)';
          
          await airtableClient.updateRecord(
            CALL_LOGS_TABLE_ID,
            callLog.id,
            {
              [airtableField]: finalRecordingUrl
            }
          );

          logger.info(isTransferRecording 
            ? 'Airtable updated with transfer recording URL' 
            : (uploadedToS3 ? 'Airtable updated with S3 URL' : 'Airtable updated with Twilio fallback URL'), {
            callSid,
            recordId: callLog.id,
            uploadedToS3,
            isTransferRecording,
            region,
            field: airtableField,
            type: isTransferRecording 
              ? 'transfer_recording_saved_to_airtable' 
              : (uploadedToS3 ? 'recording_saved_to_airtable_s3' : 'recording_saved_to_airtable_twilio')
          });
        } catch (error) {
          logger.error('Failed to update Airtable', {
            callSid,
            error: error instanceof Error ? error.message : 'Unknown error',
            isTransferRecording,
            type: 'airtable_update_error'
          });
        }
      }

      // Step 5: Schedule deletion from Twilio only if S3 upload succeeded
      // Pass the detected region so deletion uses the correct credentials
      if (shouldDeleteFromTwilio) {
        scheduleRecordingDeletion(recordingSid, 24, region);
        logger.info('Twilio recording deletion scheduled', {
          callSid,
          recordingSid,
          region,
          type: 'twilio_deletion_scheduled'
        });
      } else {
        logger.info('Twilio recording preserved (not uploaded to S3)', {
          callSid,
          recordingSid,
          region,
          type: 'twilio_recording_preserved'
        });
      }

      logger.info('Recording archival process completed', {
        callSid,
        recordingSid,
        uploadedToS3,
        region,
        recordingUrl: finalRecordingUrl.substring(0, 100) + '...',
        totalDuration: Date.now() - startTime,
        type: 'recording_archival_completed'
      });

      return NextResponse.json({
        status: 'ok',
        message: uploadedToS3 ? 'Recording archived to S3' : 'Recording URL stored (Twilio fallback)',
        recordingUrl: finalRecordingUrl,
        uploadedToS3,
        region
      });
    }
    
    return NextResponse.json({
      status: 'ok',
      message: 'Recording status received'
    });
    
  } catch (error) {
    logger.error('Recording status callback error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'recording_status_error'
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
