/**
 * Twilio Media Stream WebSocket endpoint
 * Handles real-time audio streaming between Twilio and ElevenLabs
 */

import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { AudioStreamManager } from '../../../services/audio/stream-manager';
import { TTSService, STTService } from '../../../services/elevenlabs/elevenlabs-service';

// Store active connections
const activeConnections = new Map<string, AudioStreamManager>();

/**
 * Handle WebSocket upgrade for Twilio Media Streams
 */
export async function GET(request: NextRequest) {
  console.log('Media Stream WebSocket upgrade requested');

  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Note: In a production Next.js app, WebSocket handling might need to be done
  // through a custom server or external WebSocket service. This is a basic implementation.
  
  return new Response('WebSocket endpoint ready', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}

/**
 * Initialize WebSocket server for media streaming
 * This would typically be called from a custom server setup
 */
export function initializeMediaStreamServer(port: number = 3001): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`Media Stream WebSocket server listening on port ${port}`);

  wss.on('connection', (ws: WebSocket, request) => {
    console.log('New Media Stream WebSocket connection established');

    // Create audio stream manager for this connection
    const streamManager = new AudioStreamManager();
    streamManager.initializeConnection(ws);

    // Handle stream events
    streamManager.on('streamStarted', (metadata) => {
      console.log('Stream started for call:', metadata.callSid);
      activeConnections.set(metadata.callSid, streamManager);
      
      // Send initial greeting or wait for user speech
      handleStreamStart(streamManager, metadata);
    });

    streamManager.on('audioReady', async (audioData) => {
      console.log(`Processing audio chunk: ${audioData.audioData.length} bytes`);
      
      try {
        // Convert audio to text using ElevenLabs STT
        const sttResult = await STTService.transcribeAudio(audioData.audioData);
        
        if (sttResult.success && sttResult.text) {
          console.log('STT Result:', sttResult.text);
          
          // Process the transcribed text (this is where we'll integrate with FSM later)
          await handleUserSpeech(streamManager, sttResult.text, audioData);
        } else {
          console.log('STT failed or no text:', sttResult.error);
        }
      } catch (error) {
        console.error('Error processing audio:', error);
      }
    });

    streamManager.on('streamStopped', (streamSid) => {
      console.log('Stream stopped:', streamSid);
      
      // Clean up connection
      const metadata = streamManager.getStreamMetadata();
      if (metadata) {
        activeConnections.delete(metadata.callSid);
      }
    });

    streamManager.on('error', (error) => {
      console.error('Stream manager error:', error);
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log('Media Stream WebSocket connection closed');
      
      // Clean up
      const metadata = streamManager.getStreamMetadata();
      if (metadata) {
        activeConnections.delete(metadata.callSid);
      }
    });
  });

  return wss;
}

/**
 * Handle stream start - send initial greeting
 */
async function handleStreamStart(streamManager: AudioStreamManager, metadata: any): Promise<void> {
  try {
    console.log('Handling stream start for call:', metadata.callSid);
    
    // For now, send a simple greeting
    // Later this will integrate with the FSM to determine appropriate response
    const greeting = "Hello! I can hear you now. Please say something.";
    
    const ttsResult = await TTSService.generateSpeech(greeting);
    
    if (ttsResult.success && ttsResult.audioBuffer) {
      console.log('Sending greeting audio to caller');
      streamManager.sendAudio(ttsResult.audioBuffer);
      
      // Send a mark to synchronize
      streamManager.sendMark('greeting_complete');
    } else {
      console.error('Failed to generate greeting:', ttsResult.error);
    }
    
  } catch (error) {
    console.error('Error handling stream start:', error);
  }
}

/**
 * Handle user speech input
 */
async function handleUserSpeech(
  streamManager: AudioStreamManager, 
  transcribedText: string, 
  audioData: any
): Promise<void> {
  try {
    console.log('Processing user speech:', transcribedText);
    
    // For Phase 1, just echo back what the user said
    // Later phases will integrate with FSM for proper processing
    const response = `I heard you say: ${transcribedText}. This is a test response.`;
    
    const ttsResult = await TTSService.generateSpeech(response);
    
    if (ttsResult.success && ttsResult.audioBuffer) {
      console.log('Sending response audio to caller');
      streamManager.sendAudio(ttsResult.audioBuffer);
      
      // Send a mark to indicate response complete
      streamManager.sendMark('response_complete');
    } else {
      console.error('Failed to generate response:', ttsResult.error);
      
      // Send fallback response
      const fallback = "I'm sorry, I'm having trouble processing your request.";
      const fallbackTTS = await TTSService.generateSpeech(fallback);
      
      if (fallbackTTS.success && fallbackTTS.audioBuffer) {
        streamManager.sendAudio(fallbackTTS.audioBuffer);
      }
    }
    
  } catch (error) {
    console.error('Error handling user speech:', error);
  }
}

/**
 * Get active connection for a call
 */
export function getActiveConnection(callSid: string): AudioStreamManager | undefined {
  return activeConnections.get(callSid);
}

/**
 * Close all active connections
 */
export function closeAllConnections(): void {
  console.log('Closing all media stream connections');
  
  activeConnections.forEach((streamManager, callSid) => {
    console.log('Closing connection for call:', callSid);
    streamManager.close();
  });
  
  activeConnections.clear();
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  activeConnections: number;
  connectionDetails: Array<{
    callSid: string;
    streamSid: string;
    connected: boolean;
  }>;
} {
  const connectionDetails: Array<{
    callSid: string;
    streamSid: string;
    connected: boolean;
  }> = [];
  
  activeConnections.forEach((streamManager, callSid) => {
    const metadata = streamManager.getStreamMetadata();
    connectionDetails.push({
      callSid,
      streamSid: metadata?.streamSid || 'unknown',
      connected: streamManager.isStreamConnected(),
    });
  });
  
  return {
    activeConnections: activeConnections.size,
    connectionDetails,
  };
}
