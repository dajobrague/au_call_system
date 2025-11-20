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
        logger.info('WebSocket stream started', {
          callSid: message.start?.callSid,
          streamSid: message.start?.streamSid,
          type: 'ws_stream_start'
        });
        await handlers.onStart(message, ws);
        break;
        
      case 'media':
        // Media frames - handled silently for performance
        // Check if we're actively recording speech AND it's the inbound track (user speech)
        const wsExt = ws as WebSocketWithExtensions;
        
        if (wsExt.speechState && 
            isRecording(wsExt.speechState) && 
            message.media?.payload &&
            message.media?.track === 'inbound') { // Only capture user speech!
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
