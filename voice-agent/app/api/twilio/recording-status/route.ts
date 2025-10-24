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

      // Step 3: Upload to S3
      const providerSlug = provider || 'unknown-provider';
      const employeeSlug = employee || 'unknown-employee';
      const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${callSid}/twilio-recording.mp3`;

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

      logger.info('Recording uploaded to S3 successfully', {
        callSid,
        recordingSid,
        s3Key,
        size: downloadResult.audioBuffer.length,
        type: 'recording_s3_upload_success'
      });

      // Step 4: Update Airtable with S3 presigned URL
      if (callLog) {
        try {
          await airtableClient.updateRecord(
            CALL_LOGS_TABLE_ID,
            callLog.id,
            {
              'Recording URL (Twilio/S3)': s3Url
            }
          );

          logger.info('Airtable updated with S3 presigned URL', {
            callSid,
            recordId: callLog.id,
            type: 'airtable_updated'
          });
        } catch (error) {
          logger.error('Failed to update Airtable', {
            callSid,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'airtable_update_error'
          });
        }
      }

      // Step 5: Schedule deletion from Twilio (24h retention for testing)
      scheduleRecordingDeletion(recordingSid, 24);

      logger.info('Recording archival process completed', {
        callSid,
        recordingSid,
        s3Url: s3Url.substring(0, 100) + '...',
        totalDuration: Date.now() - startTime,
        type: 'recording_archival_completed'
      });

      return NextResponse.json({
        status: 'ok',
        message: 'Recording archived to S3',
        s3Url: s3Url
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
