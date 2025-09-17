/**
 * Twilio Media Streams utilities
 * Handles Twilio WebSocket message parsing and generation
 */

import type { TwilioMessage, TwilioStartMessage, TwilioMediaMessage, TwilioMarkMessage, TwilioStopMessage } from '../types';
import { arrayBufferToBase64 } from './audio';

/**
 * Parse incoming Twilio WebSocket message
 */
export function parseTwilioMessage(data: string): TwilioMessage | null {
  try {
    const message = JSON.parse(data) as TwilioMessage;
    
    // Validate message structure
    if (!message.event || !message.streamSid) {
      console.warn('Invalid Twilio message structure:', message);
      return null;
    }
    
    return message;
  } catch (error) {
    console.error('Failed to parse Twilio message:', error);
    return null;
  }
}

/**
 * Create Twilio media message for sending audio back
 */
export function createTwilioMediaMessage(
  streamSid: string,
  audioData: ArrayBuffer,
  track: string = 'outbound'
): string {
  const payload = arrayBufferToBase64(audioData);
  
  const message = {
    event: 'media',
    streamSid,
    media: {
      track,
      chunk: '1',
      timestamp: Date.now().toString(),
      payload,
    },
  };
  
  return JSON.stringify(message);
}

/**
 * Create Twilio mark message for synchronization
 */
export function createTwilioMarkMessage(streamSid: string, name: string): string {
  const message = {
    event: 'mark',
    streamSid,
    mark: {
      name,
    },
  };
  
  return JSON.stringify(message);
}

/**
 * Validate Twilio start message
 */
export function validateStartMessage(message: TwilioStartMessage): boolean {
  return !!(
    message.start &&
    message.start.callSid &&
    message.start.accountSid &&
    message.start.mediaFormat
  );
}

/**
 * Extract audio format from Twilio start message
 */
export function extractAudioFormat(startMessage: TwilioStartMessage): {
  encoding: string;
  sampleRate: number;
  channels: number;
} {
  const mediaFormat = startMessage.start.mediaFormat;
  
  return {
    encoding: mediaFormat.encoding || 'mulaw',
    sampleRate: mediaFormat.sampleRate || 8000,
    channels: mediaFormat.channels || 1,
  };
}

/**
 * Log Twilio message for debugging
 */
export function logTwilioMessage(message: TwilioMessage, direction: 'inbound' | 'outbound'): void {
  const logData = {
    direction,
    event: message.event,
    streamSid: message.streamSid,
    timestamp: new Date().toISOString(),
  };
  
  switch (message.event) {
    case 'start':
      console.log('📞 Twilio stream started:', {
        ...logData,
        callSid: message.start.callSid,
        tracks: message.start.tracks,
        encoding: message.start.mediaFormat.encoding,
        sampleRate: message.start.mediaFormat.sampleRate,
      });
      break;
      
    case 'media':
      console.log('🎵 Twilio media frame:', {
        ...logData,
        track: message.media.track,
        payloadSize: message.media.payload.length,
        chunk: message.media.chunk,
      });
      break;
      
    case 'mark':
      console.log('📍 Twilio mark:', {
        ...logData,
        markName: message.mark.name,
      });
      break;
      
    case 'stop':
      console.log('📴 Twilio stream stopped:', logData);
      break;
  }
}

/**
 * Create error response for Twilio
 */
export function createTwilioErrorMessage(streamSid: string, error: string): string {
  const message = {
    event: 'error',
    streamSid,
    error: {
      message: error,
      timestamp: new Date().toISOString(),
    },
  };
  
  return JSON.stringify(message);
}

/**
 * Validate audio payload size
 */
export function validateAudioPayload(payload: string): {
  isValid: boolean;
  size: number;
  error?: string;
} {
  const maxSize = 64000; // 64KB max
  const size = payload.length;
  
  if (size === 0) {
    return {
      isValid: false,
      size,
      error: 'Empty audio payload',
    };
  }
  
  if (size > maxSize) {
    return {
      isValid: false,
      size,
      error: `Audio payload too large: ${size} bytes (max: ${maxSize})`,
    };
  }
  
  return {
    isValid: true,
    size,
  };
}

/**
 * Calculate audio metrics
 */
export function calculateAudioMetrics(
  audioData: ArrayBuffer,
  sampleRate: number,
  encoding: string
): {
  duration: number;
  samples: number;
  size: number;
  bitrate: number;
} {
  const bytesPerSample = encoding === 'mulaw' ? 1 : 2;
  const samples = audioData.byteLength / bytesPerSample;
  const duration = (samples / sampleRate) * 1000; // milliseconds
  const bitrate = (audioData.byteLength * 8) / (duration / 1000); // bits per second
  
  return {
    duration,
    samples,
    size: audioData.byteLength,
    bitrate,
  };
}
