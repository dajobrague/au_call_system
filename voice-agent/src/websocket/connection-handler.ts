/**
 * WebSocket Connection Handler
 * Manages WebSocket connection lifecycle and state
 */

import { WebSocket } from 'ws';
import { saveCallState as saveStateToRedis, loadCallState as loadStateFromRedis } from '../fsm/state/state-manager';
import { callQueueService } from '../services/queue/call-queue-service';
import { stopHoldMusic } from '../audio/hold-music-player';
import { stopCurrentAudio } from '../services/elevenlabs/audio-streamer';
import { AudioBuffer, SpeechCollectionState, VADState } from '../services/speech';
import { CallEvent } from '../types/call-log';
import { logger } from '../lib/logger';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

export interface WebSocketWithExtensions extends WebSocket {
  streamSid?: string;
  callSid?: string;
  parentCallSid?: string; // The original call leg (for REST API operations)
  cachedData?: any;
  holdMusicInterval?: NodeJS.Timeout;
  queueUpdateInterval?: NodeJS.Timeout;
  currentAudioInterval?: NodeJS.Timeout;
  
  // Speech collection properties
  speechState?: SpeechCollectionState;
  speechBuffer?: AudioBuffer;
  vadState?: VADState;
  recordingTimeout?: NodeJS.Timeout;
  generateSpeech?: (text: string) => Promise<void>;
  collectedDateTime?: {
    dateISO?: string;
    timeISO?: string;
    displayText?: string;
    originalText: string;
  };
  
  // Call logging properties
  callEvents?: CallEvent[];
  callLogRecordId?: string;
  callStartTime?: Date;
  recordingSid?: string;
  
  // Conference tracking
  inConference?: boolean;
  conferenceName?: string;
  providerId?: string;
  employeeId?: string;
}

/**
 * Handle WebSocket connection open
 */
export function handleConnectionOpen(ws: WebSocketWithExtensions): void {
  logger.info('WebSocket connection opened', {
    type: 'ws_connection_open'
  });
}

/**
 * Handle WebSocket connection close
 */
export async function handleConnectionClose(
  ws: WebSocketWithExtensions,
  code: number,
  reason: Buffer
): Promise<void> {
  const callSid = ws.callSid || 'unknown';
  
  logger.info('WebSocket connection closed', {
    callSid,
    code,
    reason: reason.toString(),
    type: 'ws_connection_close'
  });
  
  // Finalize call log before cleanup
  await finalizeCallLog(ws, code, reason.toString());
  
  // Clean up hold music
  stopHoldMusic(ws as any);
  
  // Clean up any ongoing audio playback
  stopCurrentAudio(ws as any);
  
  // Clean up speech collection
  if (ws.recordingTimeout) {
    clearTimeout(ws.recordingTimeout);
    ws.recordingTimeout = undefined;
  }
  if (ws.speechBuffer) {
    ws.speechBuffer.reset();
    ws.speechBuffer = undefined;
  }
  ws.speechState = undefined;
  ws.vadState = undefined;
  
  // Clean up queue update interval
  if (ws.queueUpdateInterval) {
    clearInterval(ws.queueUpdateInterval);
    ws.queueUpdateInterval = undefined;
    logger.info('Queue update interval cleared', {
      callSid,
      type: 'queue_interval_cleared'
    });
  }
  
  // Remove from queue if present
  if (callSid && callSid !== 'unknown') {
    try {
      const removed = await callQueueService.removeFromQueue(callSid);
      if (removed) {
        logger.info('Call removed from queue on disconnect', {
          callSid,
          type: 'queue_removed_on_disconnect'
        });
      }
    } catch (error) {
      logger.error('Error removing call from queue', {
        callSid,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'queue_remove_error'
      });
    }
  }
}

/**
 * Schedule S3 transfer for Twilio recording (after 15 second delay)
 * Downloads from Twilio → Uploads to S3 → Updates Airtable → Deletes from Twilio
 */
function scheduleRecordingTransferToS3(
  recordingSid: string,
  callSid: string,
  callLogRecordId: string,
  providerId?: string,
  employeeId?: string
): void {
  logger.info('Scheduling S3 transfer for recording', {
    recordingSid,
    callSid,
    delay: '3 seconds',
    type: 'recording_transfer_scheduled'
  });

  setTimeout(async () => {
    try {
      logger.info('Starting S3 transfer', {
        recordingSid,
        callSid,
        type: 'recording_transfer_start'
      });

      // Import services dynamically to avoid circular dependencies
      const { downloadRecording } = require('../services/twilio/recording-downloader');
      const { deleteRecording } = require('../services/twilio/recording-manager');
      const { airtableClient } = require('../services/airtable/client');

      // Check S3 credentials
      if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
        logger.error('S3 credentials not configured', {
          type: 'recording_transfer_error'
        });
        return;
      }

      // Step 1: Download from Twilio
      const downloadResult = await downloadRecording({
        recordingSid,
        format: 'mp3'
      });

      if (!downloadResult.success || !downloadResult.audioBuffer) {
        throw new Error(`Failed to download: ${downloadResult.error}`);
      }

      logger.info('Recording downloaded from Twilio', {
        recordingSid,
        size: downloadResult.audioBuffer.length,
        type: 'recording_download_success'
      });

      // Step 2: Upload to S3
      const providerSlug = providerId || 'unknown-provider';
      const employeeSlug = employeeId || 'unknown-employee';
      const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${callSid}/twilio-recording.mp3`;

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

      logger.info('Recording uploaded to S3', {
        recordingSid,
        callSid,
        s3Key,
        type: 'recording_s3_upload_success'
      });

      // Step 3: Update Airtable with S3 URL
      const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';
      await airtableClient.updateRecord(
        CALL_LOGS_TABLE_ID,
        callLogRecordId,
        {
          'Recording URL (Twilio/S3)': s3Url
        }
      );

      logger.info('Airtable updated with S3 URL', {
        recordingSid,
        callSid,
        recordId: callLogRecordId,
        type: 'airtable_updated_s3'
      });

      // Step 4: Delete from Twilio
      const deleteResult = await deleteRecording(recordingSid);
      
      if (deleteResult.success) {
        logger.info('Recording deleted from Twilio', {
          recordingSid,
          callSid,
          type: 'twilio_recording_deleted'
        });
      } else {
        logger.warn('Failed to delete recording from Twilio', {
          recordingSid,
          error: deleteResult.error,
          type: 'twilio_delete_warning'
        });
      }

      logger.info('S3 transfer completed successfully', {
        recordingSid,
        callSid,
        type: 'recording_transfer_completed'
      });

    } catch (error) {
      logger.error('S3 transfer failed', {
        recordingSid,
        callSid,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'recording_transfer_error'
      });
    }
  }, 3000); // 3 seconds delay
}

/**
 * Finalize call log with end details
 */
async function finalizeCallLog(
  ws: WebSocketWithExtensions,
  closeCode: number,
  closeReason: string
): Promise<void> {
  // Only finalize if we have a call log record
  if (!ws.callLogRecordId || !ws.callStartTime || !ws.callSid) {
    return;
  }

  try {
    const { updateCallLog, buildActivitySummary, buildRawPayload, trackCallEvent } = require('../services/airtable/call-log-service');
    const { getRecordingUrl } = require('../services/twilio/call-recorder');
    
    // Track call end event
    if (ws.callEvents) {
      trackCallEvent(ws.callEvents, 'call_end', 'call_ended', {
        reason: closeReason || 'normal',
        code: closeCode
      });
    }

    // Calculate duration
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - ws.callStartTime.getTime()) / 1000);

    // Get Australian timestamp for end time
    const endedAt = endTime.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Load call state for activity summary
    const callState = await loadStateFromRedis(ws.callSid);

    // Build activity summary and raw payload
    const detectedIntent = callState && ws.callEvents 
      ? buildActivitySummary(callState, ws.callEvents)
      : 'Call completed';
    
    const rawPayload = ws.callEvents 
      ? buildRawPayload(ws.callEvents)
      : 'No events recorded';

    // Try to get recording URL (may not be ready yet)
    let recordingUrl: string | undefined;
    if (ws.recordingSid) {
      try {
        const urlResult = await getRecordingUrl(ws.recordingSid);
        if (urlResult.success && urlResult.url) {
          recordingUrl = urlResult.url;
        }
      } catch (error) {
        logger.warn('Recording URL not yet available', {
          callSid: ws.callSid,
          recordingSid: ws.recordingSid,
          type: 'recording_url_pending'
        });
      }
    }

    // Update call log with Twilio URL (will be replaced with S3 URL soon)
    await updateCallLog(ws.callLogRecordId, {
      endedAt,
      seconds: durationSeconds,
      recordingUrl,
      detectedIntent,
      rawPayload,
      patientId: (callState as any)?.patient?.id,
      relatedOccurrenceId: (callState as any)?.selectedOccurrence?.id,
      notes: closeCode !== 1000 ? `Abnormal close: ${closeReason} (code ${closeCode})` : undefined
    });

    logger.info('Call log finalized', {
      callSid: ws.callSid,
      recordId: ws.callLogRecordId,
      duration: durationSeconds,
      type: 'call_log_finalized'
    });

    // Schedule S3 transfer after 15 seconds (gives Twilio time to process recording)
    if (ws.recordingSid && ws.callSid) {
      scheduleRecordingTransferToS3(
        ws.recordingSid,
        ws.callSid,
        ws.callLogRecordId,
        ws.providerId,
        ws.employeeId
      );
    }

  } catch (error) {
    logger.error('Failed to finalize call log', {
      callSid: ws.callSid,
      recordId: ws.callLogRecordId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'call_log_finalize_error'
    });
  }
}

/**
 * Handle WebSocket error
 */
export function handleConnectionError(
  ws: WebSocketWithExtensions,
  error: Error
): void {
  const callSid = ws.callSid || 'unknown';
  
  logger.error('WebSocket connection error', {
    callSid,
    error: error.message,
    type: 'ws_connection_error'
  });
}

/**
 * Save call state with caching optimization
 */
export async function saveCallState(
  ws: WebSocketWithExtensions,
  state: any
): Promise<void> {
  // Cache state on WebSocket for instant access
  ws.cachedData = {
    ...ws.cachedData,
    callState: state,
    cachedAt: Date.now()
  };
  
  // Save to Redis in background (non-blocking)
  saveStateToRedis(state).catch((error: Error) => {
    logger.error('Background state save error', {
      callSid: state.sid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'state_save_error'
    });
  });
  
  logger.debug('Call state cached and saving to Redis', {
    callSid: state.sid,
    phase: state.phase,
    type: 'state_cached'
  });
}

/**
 * Load call state with caching
 */
export async function loadCallState(
  ws: WebSocketWithExtensions,
  callSid: string
): Promise<any | null> {
  // Check cache first
  if (ws.cachedData?.callState?.sid === callSid) {
    const cacheAge = Date.now() - (ws.cachedData.cachedAt || 0);
    if (cacheAge < 5000) { // Cache valid for 5 seconds
      logger.debug('Using cached call state', {
        callSid,
        cacheAge,
        type: 'state_cache_hit'
      });
      return ws.cachedData.callState;
    }
  }
  
  // Load from Redis
  const state = await loadStateFromRedis(callSid);
  
  if (state) {
    // Update cache
    ws.cachedData = {
      ...ws.cachedData,
      callState: state,
      cachedAt: Date.now()
    };
    
    logger.debug('Call state loaded from Redis and cached', {
      callSid,
      phase: state.phase,
      type: 'state_loaded'
    });
  }
  
  return state;
}
