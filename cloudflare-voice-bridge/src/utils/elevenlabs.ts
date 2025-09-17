/**
 * ElevenLabs Realtime connection utilities
 * Handles WebSocket connection to ElevenLabs Conversational AI
 */

import type { ElevenLabsMessage, ElevenLabsConversationConfig } from '../types';
import { arrayBufferToBase64, base64ToArrayBuffer } from './audio';

/**
 * Create ElevenLabs Text-to-Speech WebSocket connection
 */
export async function createElevenLabsConnection(
  apiKey: string,
  voiceId: string
): Promise<WebSocket> {
  const endpoint = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`;
  
  console.log('🔗 Connecting to ElevenLabs TTS WebSocket:', endpoint);
  
  // Note: Cloudflare Workers WebSocket doesn't support headers in constructor
  // We'll need to send the API key in the initial message instead
  const websocket = new WebSocket(endpoint);
  
  return websocket;
}

/**
 * Initialize ElevenLabs TTS WebSocket connection
 */
export function initializeTTSConnection(
  websocket: WebSocket,
  apiKey: string,
  voiceSettings: {
    stability?: number;
    similarity_boost?: number;
    speed?: number;
  } = {}
): void {
  const initMessage = {
    text: " ", // Initial space to start connection
    voice_settings: {
      speed: voiceSettings.speed || 1,
      stability: voiceSettings.stability || 0.5,
      similarity_boost: voiceSettings.similarity_boost || 0.8,
    },
    xi_api_key: apiKey, // Include API key in the message
  };
  
  console.log('🎤 Initializing ElevenLabs TTS connection');
  websocket.send(JSON.stringify(initMessage));
}

/**
 * Send text to ElevenLabs TTS WebSocket
 */
export function sendTextToElevenLabs(
  websocket: WebSocket,
  text: string,
  triggerGeneration: boolean = false
): void {
  const textMessage = {
    text: text,
    try_trigger_generation: triggerGeneration,
  };
  
  console.log('📝 Sending text to ElevenLabs:', text);
  websocket.send(JSON.stringify(textMessage));
}

/**
 * Close ElevenLabs TTS stream
 */
export function closeElevenLabsStream(websocket: WebSocket): void {
  const closeMessage = {
    text: "", // Empty text signals end of stream
  };
  
  console.log('🔚 Closing ElevenLabs TTS stream');
  websocket.send(JSON.stringify(closeMessage));
}

/**
 * Parse ElevenLabs WebSocket message
 */
export function parseElevenLabsMessage(data: string): ElevenLabsMessage | null {
  try {
    const message = JSON.parse(data) as ElevenLabsMessage;
    
    if (!message.type) {
      console.warn('Invalid ElevenLabs message structure:', message);
      return null;
    }
    
    return message;
  } catch (error) {
    console.error('Failed to parse ElevenLabs message:', error);
    return null;
  }
}

/**
 * Extract audio data from ElevenLabs message
 */
export function extractElevenLabsAudio(message: ElevenLabsMessage): ArrayBuffer | null {
  if (message.type === 'audio' && 'audio_data' in message) {
    try {
      return base64ToArrayBuffer(message.audio_data);
    } catch (error) {
      console.error('Failed to decode ElevenLabs audio:', error);
      return null;
    }
  }
  
  return null;
}

/**
 * Log ElevenLabs message for debugging
 */
export function logElevenLabsMessage(
  message: ElevenLabsMessage, 
  direction: 'inbound' | 'outbound'
): void {
  const logData = {
    direction,
    type: message.type,
    timestamp: new Date().toISOString(),
  };
  
  switch (message.type) {
    case 'audio':
      if ('audio_data' in message) {
        console.log('🎵 ElevenLabs audio:', {
          ...logData,
          audioSize: message.audio_data.length,
        });
      }
      break;
      
    case 'message':
      if ('message' in message) {
        console.log('💬 ElevenLabs message:', {
          ...logData,
          content: message.message,
        });
      }
      break;
      
    case 'user_transcript':
      console.log('📝 ElevenLabs transcript:', {
        ...logData,
        transcript: (message as any).transcript || 'N/A',
      });
      break;
      
    case 'agent_response':
      console.log('🤖 ElevenLabs agent response:', {
        ...logData,
        response: (message as any).response || 'N/A',
      });
      break;
      
    default:
      console.log('📋 ElevenLabs control message:', logData);
  }
}

/**
 * Create ElevenLabs connection with error handling
 */
export async function createRobustElevenLabsConnection(
  apiKey: string,
  voiceId: string,
  maxRetries: number = 3
): Promise<WebSocket | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ElevenLabs connection attempt ${attempt}/${maxRetries}`);
      
      const websocket = await createElevenLabsConnection(apiKey, voiceId);
      
      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout
        
        websocket.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        websocket.addEventListener('error', (event) => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket error: ${event}`));
        });
      });
      
      console.log('✅ ElevenLabs connection established');
      return websocket;
      
    } catch (error) {
      console.error(`❌ ElevenLabs connection attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error('🚨 All ElevenLabs connection attempts failed');
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return null;
}

/**
 * Handle ElevenLabs WebSocket events
 */
export function setupElevenLabsEventHandlers(
  websocket: WebSocket,
  onAudio: (audioData: ArrayBuffer) => void,
  onMessage: (message: string) => void,
  onError: (error: any) => void,
  onClose: () => void
): void {
  websocket.addEventListener('message', (event) => {
    const message = parseElevenLabsMessage(event.data);
    if (!message) return;
    
    logElevenLabsMessage(message, 'inbound');
    
    switch (message.type) {
      case 'audio':
        const audioData = extractElevenLabsAudio(message);
        if (audioData) {
          onAudio(audioData);
        }
        break;
        
      case 'message':
        if ('message' in message) {
          onMessage(message.message);
        }
        break;
        
      case 'user_transcript':
      case 'agent_response':
      case 'conversation_initiation_metadata':
        // Handle control messages
        console.log('📋 ElevenLabs control message:', message.type);
        break;
    }
  });
  
  websocket.addEventListener('error', (event) => {
    console.error('🚨 ElevenLabs WebSocket error:', event);
    onError(event);
  });
  
  websocket.addEventListener('close', (event) => {
    console.log('📴 ElevenLabs WebSocket closed:', event.code, event.reason);
    onClose();
  });
}

/**
 * Send ping to keep connection alive
 * Note: Cloudflare Workers WebSocket doesn't have ping(), so we send a small text message
 */
export function sendElevenLabsPing(websocket: WebSocket): void {
  if (websocket.readyState === WebSocket.OPEN) {
    // Send a small text message to keep connection alive
    sendTextToElevenLabs(websocket, " ", false);
    console.log('🏓 Sent keepalive to ElevenLabs');
  }
}

/**
 * Close ElevenLabs connection gracefully
 */
export function closeElevenLabsConnection(websocket: WebSocket, reason: string = 'Call ended'): void {
  if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
    console.log('📴 Closing ElevenLabs connection:', reason);
    websocket.close(1000, reason);
  }
}
