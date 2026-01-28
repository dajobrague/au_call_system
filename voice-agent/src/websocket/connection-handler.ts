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
import { publishCallEnded } from '../services/redis/call-event-publisher';

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
  
  // WebSocket audio recording (for full call recording)
  callAudioBuffers?: {
    inbound: Buffer[];
    outbound: Buffer[];
  };
  audioFrameCount?: number;
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
  
  // Calculate call duration and publish call_ended event (non-blocking)
  if (ws.callStartTime && ws.providerId && callSid !== 'unknown') {
    const duration = Math.floor((Date.now() - ws.callStartTime.getTime()) / 1000);
    publishCallEnded(callSid, ws.providerId, duration).catch(err => {
      logger.error('Failed to publish call_ended event', {
        callSid,
        error: err.message,
        type: 'redis_stream_error'
      });
    });
  }
  
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

      // Step 2: Attempt S3 upload with fallback to Twilio URL
      let finalRecordingUrl: string;
      let shouldDeleteFromTwilio = false;
      let uploadedToS3 = false;

      const providerSlug = providerId || 'unknown-provider';
      const employeeSlug = employeeId || 'unknown-employee';
      const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${callSid}/twilio-recording.mp3`;

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

        // S3 upload successful
        finalRecordingUrl = s3Url;
        shouldDeleteFromTwilio = true;
        uploadedToS3 = true;

        logger.info('Recording uploaded to S3', {
          recordingSid,
          callSid,
          s3Key,
          type: 'recording_s3_upload_success'
        });

      } catch (s3Error) {
        // S3 upload failed - fallback to Twilio URL
        logger.warn('S3 upload failed, using Twilio URL as fallback', {
          recordingSid,
          callSid,
          error: s3Error instanceof Error ? s3Error.message : 'Unknown error',
          type: 'recording_s3_fallback_to_twilio'
        });

        // Get Twilio recording URL
        const { getRecordingUrl } = require('../services/twilio/call-recorder');
        const urlResult = await getRecordingUrl(recordingSid);
        
        if (urlResult.success && urlResult.url) {
          finalRecordingUrl = urlResult.url;
          shouldDeleteFromTwilio = false;
          uploadedToS3 = false;
        } else {
          throw new Error(`Failed to get Twilio URL: ${urlResult.error}`);
        }
      }

      // Step 3: Update Airtable with recording URL (S3 or Twilio fallback)
      const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';
      await airtableClient.updateRecord(
        CALL_LOGS_TABLE_ID,
        callLogRecordId,
        {
          'Recording URL (Twilio/S3)': finalRecordingUrl
        }
      );

      logger.info(uploadedToS3 ? 'Airtable updated with S3 URL' : 'Airtable updated with Twilio fallback URL', {
        recordingSid,
        callSid,
        recordId: callLogRecordId,
        uploadedToS3,
        type: uploadedToS3 ? 'recording_saved_to_airtable_s3' : 'recording_saved_to_airtable_twilio'
      });

      // Step 4: Delete from Twilio only if S3 upload succeeded
      if (shouldDeleteFromTwilio) {
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
      } else {
        logger.info('Twilio recording preserved (S3 upload failed)', {
          recordingSid,
          callSid,
          type: 'twilio_recording_preserved'
        });
      }

      logger.info('Recording transfer completed', {
        recordingSid,
        callSid,
        uploadedToS3,
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
    
    // Process WebSocket recorded audio with transfer support
    // Step 1: Flush any remaining in-memory buffers to Redis
    if (ws.callAudioBuffers && (ws.callAudioBuffers.inbound.length > 0 || ws.callAudioBuffers.outbound.length > 0)) {
      try {
        const { appendAudioToRedis } = require('../services/redis/audio-buffer-store');
        await appendAudioToRedis(
          ws.callSid,
          ws.parentCallSid,
          ws.callAudioBuffers.inbound,
          ws.callAudioBuffers.outbound
        );
        logger.info('📼 Final audio buffers flushed to Redis', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          inboundChunks: ws.callAudioBuffers.inbound.length,
          outboundChunks: ws.callAudioBuffers.outbound.length,
          type: 'ws_audio_final_flush'
        });
      } catch (error) {
        logger.error('Failed to flush final audio to Redis', {
          callSid: ws.callSid,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'ws_audio_final_flush_error'
        });
      }
    }
    
    // Step 2: Check if this is the final WebSocket (no pending transfers)
    // Pass the WebSocket object so it can check cached state first (prevents race conditions)
    const { isFinalWebSocket, getAudioFromRedis, deleteAudioFromRedis } = require('../services/redis/audio-buffer-store');
    const isFinal = await isFinalWebSocket(ws);
    
    if (!isFinal) {
      logger.info('📼 WebSocket closed but transfer pending - audio stored in Redis', {
        callSid: ws.callSid,
        parentCallSid: ws.parentCallSid,
        closeReason,
        type: 'ws_audio_transfer_pending'
      });
      // Don't upload yet - wait for final WebSocket to close
    } else {
      // Step 3: This is the final WebSocket - retrieve ALL audio from Redis and upload
      logger.info('📼 Final WebSocket closed - retrieving complete audio from Redis', {
        callSid: ws.callSid,
        parentCallSid: ws.parentCallSid,
        type: 'ws_audio_final_retrieve'
      });
      
      const completeAudio = await getAudioFromRedis(ws.callSid, ws.parentCallSid);
      
      if (completeAudio && (completeAudio.inbound.length > 0 || completeAudio.outbound.length > 0)) {
        try {
          const { tracksToWav, getAudioStats } = require('../services/audio/websocket-recorder');
          
          // Get audio statistics
          const stats = getAudioStats(completeAudio);
          logger.info('🎵 Complete call audio statistics', {
            ...stats,
            type: 'ws_audio_complete_stats'
          });
          
          // Convert to WAV file
          const wavBuffer = tracksToWav(completeAudio);
          logger.info('✅ Complete WAV file created', {
            size: wavBuffer.length,
            type: 'ws_audio_wav_created'
          });
          
          // Upload to S3
          const providerSlug = ws.providerId || 'unknown-provider';
          const employeeSlug = ws.employeeId || 'unknown-employee';
          const rootCallSid = ws.parentCallSid || ws.callSid;
          const s3Key = `${env.AWS_S3_RECORDINGS_PREFIX}${providerSlug}/${employeeSlug}/${rootCallSid}/complete-recording.wav`;
          
          const s3Client = new S3Client({
            region: env.AWS_REGION,
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
            }
          });
          
          const putCommand = new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: s3Key,
            Body: wavBuffer,
            ContentType: 'audio/wav',
            ServerSideEncryption: 'AES256',
            StorageClass: 'STANDARD_IA',
            Metadata: {
              'call-sid': rootCallSid,
              'provider': providerSlug,
              'employee': employeeSlug,
              'duration': durationSeconds.toString(),
              'source': 'websocket-multi',
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
          
          recordingUrl = s3Url; // Use complete recording URL
          
          logger.info('✅ Complete WebSocket recording uploaded to S3', {
            callSid: ws.callSid,
            rootCallSid,
            s3Key,
            size: wavBuffer.length,
            duration: stats.estimatedDuration,
            type: 'ws_audio_s3_success'
          });
          
          // Clean up Redis after successful upload
          await deleteAudioFromRedis(ws.callSid, ws.parentCallSid);
          
        } catch (error) {
          logger.error('❌ Failed to process complete WebSocket recording', {
            callSid: ws.callSid,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'ws_audio_process_error'
          });
        }
      } else {
        logger.warn('No audio found in Redis for final WebSocket', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          type: 'ws_audio_no_data'
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
