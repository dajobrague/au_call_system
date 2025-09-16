/**
 * ElevenLabs service integration
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) operations
 */

import { ElevenLabs, ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs';
import path from 'path';

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam voice
const DEFAULT_MODEL_ID = 'eleven_monolingual_v1';

if (!ELEVENLABS_API_KEY) {
  console.warn('ELEVENLABS_API_KEY not found in environment variables');
}

// Initialize ElevenLabs client
const elevenLabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  error?: string;
  duration?: number;
}

export interface STTResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
  duration?: number;
}

/**
 * Text-to-Speech service
 */
export class TTSService {
  /**
   * Convert text to speech and return audio buffer
   */
  static async generateSpeech(
    text: string, 
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const startTime = Date.now();
    
    try {
      if (!ELEVENLABS_API_KEY) {
        return {
          success: false,
          error: 'ElevenLabs API key not configured',
          duration: Date.now() - startTime,
        };
      }

      const voiceId = options.voiceId || DEFAULT_VOICE_ID;
      const modelId = options.modelId || DEFAULT_MODEL_ID;

      console.log(`TTS: Converting text to speech - "${text.substring(0, 50)}..."`);

      const response = await elevenLabs.textToSpeech.convert(voiceId, {
        text,
        modelId: modelId,
        voiceSettings: {
          stability: options.stability || 0.5,
          similarityBoost: options.similarityBoost || 0.8,
          style: options.style || 0.0,
          useSpeakerBoost: options.useSpeakerBoost || true,
        },
      });

      // Convert response to buffer
      const chunks: Buffer[] = [];
      const reader = response.getReader();
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(Buffer.from(value));
        }
      }
      
      const audioBuffer = Buffer.concat(chunks);

      const duration = Date.now() - startTime;
      console.log(`TTS: Success - Generated ${audioBuffer.length} bytes in ${duration}ms`);

      return {
        success: true,
        audioBuffer,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('TTS Error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS error',
        duration,
      };
    }
  }

  /**
   * Stream text-to-speech directly to a WebSocket
   */
  static async streamSpeech(
    text: string,
    outputStream: any,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const startTime = Date.now();
    
    try {
      if (!ELEVENLABS_API_KEY) {
        return {
          success: false,
          error: 'ElevenLabs API key not configured',
          duration: Date.now() - startTime,
        };
      }

      const voiceId = options.voiceId || DEFAULT_VOICE_ID;
      const modelId = options.modelId || DEFAULT_MODEL_ID;

      console.log(`TTS Stream: Converting text to speech - "${text.substring(0, 50)}..."`);

      const response = await elevenLabs.textToSpeech.convert(voiceId, {
        text,
        modelId: modelId,
        voiceSettings: {
          stability: options.stability || 0.5,
          similarityBoost: options.similarityBoost || 0.8,
          style: options.style || 0.0,
          useSpeakerBoost: options.useSpeakerBoost || true,
        },
      });

      // Stream chunks to output
      let totalBytes = 0;
      const reader = response.getReader();
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          outputStream.write(Buffer.from(value));
          totalBytes += value.length;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`TTS Stream: Success - Streamed ${totalBytes} bytes in ${duration}ms`);

      return {
        success: true,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('TTS Stream Error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS streaming error',
        duration,
      };
    }
  }
}

/**
 * Speech-to-Text service
 */
export class STTService {
  /**
   * Convert audio buffer to text
   */
  static async transcribeAudio(audioBuffer: Buffer): Promise<STTResult> {
    const startTime = Date.now();
    
    try {
      if (!ELEVENLABS_API_KEY) {
        return {
          success: false,
          error: 'ElevenLabs API key not configured',
          duration: Date.now() - startTime,
        };
      }

      console.log(`STT: Transcribing audio buffer - ${audioBuffer.length} bytes`);

      // Create temporary file for audio
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `audio-${Date.now()}.wav`);
      fs.writeFileSync(tempFile, audioBuffer);

      try {
        // For Phase 1, we'll use a placeholder STT implementation
        // In a real implementation, you would use the correct ElevenLabs STT API
        // or integrate with another STT service like OpenAI Whisper
        
        // Clean up temp file
        fs.unlinkSync(tempFile);

        const duration = Date.now() - startTime;
        
        // Placeholder response for Phase 1 testing
        const text = "This is a placeholder STT response for testing";
        const confidence = 0.95;

        console.log(`STT: Placeholder response - "${text}" (confidence: ${confidence}) in ${duration}ms`);
        console.log('Note: STT implementation needs to be completed with correct ElevenLabs API');

        return {
          success: true,
          text,
          confidence,
          duration,
        };

      } catch (sttError) {
        // Clean up temp file on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        throw sttError;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('STT Error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown STT error',
        duration,
      };
    }
  }

  /**
   * Process real-time audio stream for transcription
   */
  static async processAudioStream(
    audioStream: NodeJS.ReadableStream,
    onTranscription: (result: STTResult) => void
  ): Promise<void> {
    const chunks: Buffer[] = [];
    
    audioStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      
      // Process chunks when we have enough data (e.g., 1 second of audio)
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      if (totalSize > 16000) { // Roughly 1 second at 16kHz
        const audioBuffer = Buffer.concat(chunks);
        chunks.length = 0; // Clear chunks
        
        // Transcribe asynchronously
        this.transcribeAudio(audioBuffer).then(onTranscription);
      }
    });

    audioStream.on('end', () => {
      // Process any remaining chunks
      if (chunks.length > 0) {
        const audioBuffer = Buffer.concat(chunks);
        this.transcribeAudio(audioBuffer).then(onTranscription);
      }
    });
  }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return { success: false, error: 'ElevenLabs API key not configured' };
    }

    const response = await elevenLabs.voices.getAll();
    return {
      success: true,
      voices: response.voices.map(voice => ({
        id: voice.voiceId,
        name: voice.name,
        category: voice.category,
        description: voice.description,
      })),
    };
  } catch (error) {
    console.error('Error fetching voices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test ElevenLabs connectivity
 */
export async function testElevenLabsConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ELEVENLABS_API_KEY) {
      return { success: false, error: 'ElevenLabs API key not configured' };
    }

    // Test with a simple TTS request
    const result = await TTSService.generateSpeech('Testing connection');
    return { success: result.success, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}
