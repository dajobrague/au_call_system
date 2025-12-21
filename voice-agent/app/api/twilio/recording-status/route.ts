/**
 * Twilio Recording Status Callback
 * Handles recording completion notifications
 * NDIS Compliance Flow: Twilio → S3 (ap-southeast-2) → Airtable → Delete from Twilio
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { downloadRecording } from '@/services/twilio/recording-downloader';
import { scheduleRecordingDeletion } from '@/services/twilio/recording-manager';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { airtableClient } from '@/services/airtable/client';
import { env } from '@/config/env';

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
      logger.info('Recording completed, starting S3 archival process', {
        callSid,
        recordingSid,
        recordingDuration,
        type: 'recording_archival_start'
      });

      // Check S3 credentials
      if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
        throw new Error('S3 credentials not configured');
      }

      // Step 1: Download recording from Twilio
      const downloadResult = await downloadRecording({
        recordingSid,
        format: 'mp3'
      });

      if (!downloadResult.success || !downloadResult.audioBuffer) {
        throw new Error(`Failed to download recording: ${downloadResult.error}`);
      }

      logger.info('Recording downloaded from Twilio', {
        callSid,
        recordingSid,
        size: downloadResult.audioBuffer.length,
        type: 'recording_download_success'
      });

      // Step 2: Find call log to get provider/employee info
      const callLog = await findCallLogByCallSid(callSid);
      const { provider, employee } = extractProviderEmployee(callLog);

      // Step 3: Attempt S3 upload with fallback to Twilio URL
      let finalRecordingUrl: string;
      let shouldDeleteFromTwilio = false;
      let uploadedToS3 = false;

      const providerSlug = provider || 'unknown-provider';
      const employeeSlug = employee || 'unknown-employee';
      const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${callSid}/twilio-recording.mp3`;

      try {
        // Create S3 client
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
          Body: downloadResult.audioBuffer,
          ContentType: 'audio/mpeg',
          ServerSideEncryption: 'AES256',
          StorageClass: 'STANDARD_IA',
          Metadata: {
            'call-sid': callSid,
            'recording-sid': recordingSid,
            'provider': providerSlug,
            'employee': employeeSlug,
            'duration': recordingDuration,
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

        // S3 upload successful
        finalRecordingUrl = s3Url;
        shouldDeleteFromTwilio = true;
        uploadedToS3 = true;

        logger.info('Recording uploaded to S3 successfully', {
          callSid,
          recordingSid,
          s3Key,
          size: downloadResult.audioBuffer.length,
          type: 'recording_s3_upload_success'
        });

      } catch (s3Error) {
        // S3 upload failed - fallback to Twilio URL
        logger.warn('S3 upload failed, using Twilio URL as fallback', {
          callSid,
          recordingSid,
          error: s3Error instanceof Error ? s3Error.message : 'Unknown error',
          type: 'recording_s3_fallback_to_twilio'
        });

        // Convert Twilio relative URL to full URL with .mp3 extension
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
          await airtableClient.updateRecord(
            CALL_LOGS_TABLE_ID,
            callLog.id,
            {
              'Recording URL (Twilio/S3)': finalRecordingUrl
            }
          );

          logger.info(uploadedToS3 ? 'Airtable updated with S3 URL' : 'Airtable updated with Twilio fallback URL', {
            callSid,
            recordId: callLog.id,
            uploadedToS3,
            type: uploadedToS3 ? 'recording_saved_to_airtable_s3' : 'recording_saved_to_airtable_twilio'
          });
        } catch (error) {
          logger.error('Failed to update Airtable', {
            callSid,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'airtable_update_error'
          });
        }
      }

      // Step 5: Schedule deletion from Twilio only if S3 upload succeeded
      if (shouldDeleteFromTwilio) {
        scheduleRecordingDeletion(recordingSid, 24);
        logger.info('Twilio recording deletion scheduled', {
          callSid,
          recordingSid,
          type: 'twilio_deletion_scheduled'
        });
      } else {
        logger.info('Twilio recording preserved (S3 upload failed)', {
          callSid,
          recordingSid,
          type: 'twilio_recording_preserved'
        });
      }

      logger.info('Recording archival process completed', {
        callSid,
        recordingSid,
        uploadedToS3,
        recordingUrl: finalRecordingUrl.substring(0, 100) + '...',
        totalDuration: Date.now() - startTime,
        type: 'recording_archival_completed'
      });

      return NextResponse.json({
        status: 'ok',
        message: uploadedToS3 ? 'Recording archived to S3' : 'Recording preserved on Twilio (S3 fallback)',
        recordingUrl: finalRecordingUrl,
        uploadedToS3
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
