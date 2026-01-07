/**
 * ElevenLabs TTS Service for Provider Portal
 * Handles text-to-speech generation for IVR greetings
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  error?: string;
}

/**
 * Generate speech from text using ElevenLabs
 */
export async function generateSpeech(text: string): Promise<TTSResult> {
  try {
    if (!ELEVENLABS_API_KEY) {
      return {
        success: false,
        error: 'ElevenLabs API key not configured',
      };
    }

    // Initialize ElevenLabs client
    const elevenLabs = new ElevenLabsClient({
      apiKey: ELEVENLABS_API_KEY,
    });

    console.log('Generating speech with ElevenLabs...');

    // Generate speech
    const response = await elevenLabs.textToSpeech.convert(ELEVENLABS_VOICE_ID, {
      text,
      modelId: 'eleven_monolingual_v1',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.8,
        style: 0.0,
        useSpeakerBoost: true,
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

    console.log(`Generated ${audioBuffer.length} bytes of audio`);

    return {
      success: true,
      audioBuffer,
    };
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

