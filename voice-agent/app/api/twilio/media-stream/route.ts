/**
 * Twilio Media Stream WebSocket endpoint
 * Handles real-time audio streaming between Twilio and ElevenLabs
 */

import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { AudioStreamManager } from '../../../../src/services/audio/stream-manager';
import { TTSService, STTService } from '../../../../src/services/elevenlabs/elevenlabs-service';

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
function initializeMediaStreamServer(port: number = 3001): WebSocketServer {
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
      handleStreamStart(streamManager, metadata, request);
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
 * Handle stream start - send initial greeting using ElevenLabs
 */
async function handleStreamStart(streamManager: AudioStreamManager, metadata: any, request?: any): Promise<void> {
  try {
    console.log('Handling stream start for call:', metadata.callSid);
    
    // Check if there's a prompt in the URL parameters
    let prompt = "Hello! I can hear you now. Please say something.";
    
    if (request?.url) {
      const url = new URL(request.url, 'http://localhost');
      const urlPrompt = url.searchParams.get('prompt');
      if (urlPrompt) {
        prompt = decodeURIComponent(urlPrompt);
        console.log('Using prompt from URL:', prompt);
      }
    }
    
    // Generate speech using ElevenLabs with Australian voice
    const ttsResult = await TTSService.generateSpeech(prompt, {
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT', // Steve - Australian Male
      stability: 0.5,
      similarityBoost: 0.8,
    });
    
    if (ttsResult.success && ttsResult.audioBuffer) {
      console.log(`Sending ElevenLabs audio to caller: "${prompt}"`);
      streamManager.sendAudio(ttsResult.audioBuffer);
      
      // Send a mark to synchronize
      streamManager.sendMark('elevenlabs_prompt_complete');
    } else {
      console.error('Failed to generate ElevenLabs audio:', ttsResult.error);
      
      // Fallback: send a simple message
      const fallbackPrompt = "Hello, I'm your AI assistant.";
      const fallbackResult = await TTSService.generateSpeech(fallbackPrompt);
      if (fallbackResult.success && fallbackResult.audioBuffer) {
        streamManager.sendAudio(fallbackResult.audioBuffer);
      }
    }
    
  } catch (error) {
    console.error('Error handling stream start:', error);
  }
}

/**
 * Handle user speech input with ElevenLabs processing
 */
async function handleUserSpeech(
  streamManager: AudioStreamManager, 
  transcribedText: string, 
  audioData: any
): Promise<void> {
  try {
    console.log('Processing user speech:', transcribedText);
    
    // Process user input through FSM (this would integrate with the full FSM in production)
    // For now, provide intelligent responses based on input
    let response = generateIntelligentResponse(transcribedText);
    
    // Generate speech using ElevenLabs with Australian voice
    const ttsResult = await TTSService.generateSpeech(response, {
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT', // Steve - Australian Male
      stability: 0.5,
      similarityBoost: 0.8,
    });
    
    if (ttsResult.success && ttsResult.audioBuffer) {
      console.log(`Sending ElevenLabs response: "${response}"`);
      streamManager.sendAudio(ttsResult.audioBuffer);
      
      // Send a mark to indicate response complete
      streamManager.sendMark('elevenlabs_response_complete');
    } else {
      console.error('Failed to generate ElevenLabs response:', ttsResult.error);
      
      // Send fallback response using ElevenLabs
      const fallback = "I'm sorry, I'm having trouble processing your request.";
      const fallbackTTS = await TTSService.generateSpeech(fallback, {
        voiceId: process.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT',
      });
      
      if (fallbackTTS.success && fallbackTTS.audioBuffer) {
        streamManager.sendAudio(fallbackTTS.audioBuffer);
      }
    }
    
  } catch (error) {
    console.error('Error handling user speech:', error);
  }
}

/**
 * Generate intelligent response based on user input
 */
function generateIntelligentResponse(input: string): string {
  const text = input.toLowerCase();
  
  // Simple intent-based responses for testing
  if (text.includes('reschedule') || text.includes('change')) {
    return "I understand you want to reschedule. Let me help you with that.";
  }
  
  if (text.includes('cancel') || text.includes('can\'t make')) {
    return "I understand you can't make the appointment. Let me mark it as available for someone else.";
  }
  
  if (text.includes('hello') || text.includes('hi')) {
    return "Hello! How can I help you today?";
  }
  
  if (text.includes('pin') || /\d{4}/.test(text)) {
    return "Thank you for your PIN. Let me authenticate you.";
  }
  
  if (text.includes('job code') || /[a-z]\d+|\d+[a-z]/i.test(text)) {
    return "Got your job code. Let me look that up for you.";
  }
  
  // Default response
  return `I heard you say: ${input}. How can I help you with that?`;
}

/**
 * Get active connection for a call
 */
function getActiveConnection(callSid: string): AudioStreamManager | undefined {
  return activeConnections.get(callSid);
}

/**
 * Close all active connections
 */
function closeAllConnections(): void {
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
function getConnectionStats(): {
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
