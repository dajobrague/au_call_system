/**
 * WebSocket Message Handler
 * Routes incoming Twilio WebSocket messages to appropriate handlers
 */

import { logger } from '../lib/logger';
import { processAudioChunk, isRecording } from '../services/speech';
import { WebSocketWithExtensions } from './connection-handler';

export type WebSocketMessage = {
  event: 'connected' | 'start' | 'media' | 'dtmf' | 'stop';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: {
      from?: string;
      phone?: string;
      callSid?: string;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  dtmf?: {
    track: string;
    digit: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
};

export type MessageHandlers = {
  onStart: (message: WebSocketMessage, ws: any) => Promise<void>;
  onMedia: (message: WebSocketMessage, ws: any) => Promise<void>;
  onDtmf: (message: WebSocketMessage, ws: any) => Promise<void>;
  onStop: (message: WebSocketMessage, ws: any) => Promise<void>;
};

/**
 * Parse and route WebSocket messages
 */
export async function handleWebSocketMessage(
  data: string,
  ws: any,
  handlers: MessageHandlers
): Promise<void> {
  try {
    const message: WebSocketMessage = JSON.parse(data);
    
    switch (message.event) {
      case 'connected':
        // Twilio sends this when WebSocket is first established
        logger.info('Twilio WebSocket connected', {
          protocol: (message as any).protocol,
          version: (message as any).version,
          type: 'ws_connected'
        });
        break;
        
      case 'start':
        logger.info('🚨 WebSocket START event received', {
          callSid: message.start?.callSid,
          streamSid: message.start?.streamSid,
          customParameters: JSON.stringify(message.start?.customParameters),
          hasCallType: !!(message.start?.customParameters as any)?.callType,
          callType: (message.start?.customParameters as any)?.callType,
          type: 'ws_stream_start'
        });
        await handlers.onStart(message, ws);
        break;
        
      case 'media':
        // Media frames - handled silently for performance
        const wsExt = ws as WebSocketWithExtensions;
        
        // CAPTURE INBOUND AUDIO FOR CALL RECORDING (caller audio from WebSocket)
        // Note: Outbound audio (bot) is captured separately when we generate it with ElevenLabs
        // Audio is stored in memory first, then periodically flushed to Redis
        if (message.media?.payload && message.media.track === 'inbound') {
          // Initialize audio buffers if not present
          if (!wsExt.callAudioBuffers) {
            wsExt.callAudioBuffers = { inbound: [], outbound: [] };
            wsExt.audioFrameCount = 0;
            logger.info('🎙️ Started capturing call audio for recording', {
              callSid: wsExt.callSid,
              parentCallSid: wsExt.parentCallSid,
              type: 'ws_audio_capture_start'
            });
          }
          
          // Decode and store inbound audio chunk (caller)
          const audioChunk = Buffer.from(message.media.payload, 'base64');
          wsExt.callAudioBuffers.inbound.push(audioChunk);
          
          wsExt.audioFrameCount = (wsExt.audioFrameCount || 0) + 1;
          
          // Flush to Redis every 500 frames (~10 seconds) to persist across transfers
          if (wsExt.audioFrameCount % 500 === 0) {
            logger.info('📼 Recording audio - flushing to Redis', {
              callSid: wsExt.callSid,
              frames: wsExt.audioFrameCount,
              inboundChunks: wsExt.callAudioBuffers.inbound.length,
              outboundChunks: wsExt.callAudioBuffers.outbound.length,
              type: 'ws_audio_capture_progress'
            });
            
            // Flush to Redis in background (don't block media stream)
            if (wsExt.callSid && wsExt.callAudioBuffers.inbound.length > 0) {
              import('../services/redis/audio-buffer-store').then(({ appendAudioToRedis }) => {
                appendAudioToRedis(
                  wsExt.callSid!,
                  wsExt.parentCallSid,
                  [...wsExt.callAudioBuffers!.inbound],
                  [...wsExt.callAudioBuffers!.outbound]
                ).then(() => {
                  // Clear local buffers after successful Redis flush
                  wsExt.callAudioBuffers!.inbound = [];
                  wsExt.callAudioBuffers!.outbound = [];
                }).catch((err: Error) => {
                  logger.error('Failed to flush audio to Redis', {
                    callSid: wsExt.callSid,
                    error: err.message,
                    type: 'audio_flush_error'
                  });
                });
              }).catch((err: Error) => {
                logger.error('Failed to import audio-buffer-store', {
                  callSid: wsExt.callSid,
                  error: err.message,
                  type: 'audio_import_error'
                });
              });
            }
          }
        }
        
        // ALSO check if we're actively recording speech for transcription (separate from call recording)
        if (wsExt.speechState && 
            isRecording(wsExt.speechState) && 
            message.media?.payload &&
            message.media?.track === 'inbound') {
          const audioChunk = Buffer.from(message.media.payload, 'base64');
          processAudioChunk(wsExt, audioChunk);
        }
        
        await handlers.onMedia(message, ws);
        break;
        
      case 'dtmf':
        logger.info('DTMF received', {
          digit: message.dtmf?.digit,
          streamSid: message.streamSid,
          type: 'ws_dtmf'
        });
        await handlers.onDtmf(message, ws);
        break;
        
      case 'stop':
        logger.info('WebSocket stream stopped', {
          callSid: message.stop?.callSid,
          streamSid: message.streamSid,
          type: 'ws_stream_stop'
        });
        await handlers.onStop(message, ws);
        break;
        
      default:
        logger.warn('Unknown message event', {
          event: message.event,
          type: 'ws_unknown_event'
        });
    }
  } catch (error) {
    logger.error('Error handling WebSocket message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'ws_message_error'
    });
  }
}
