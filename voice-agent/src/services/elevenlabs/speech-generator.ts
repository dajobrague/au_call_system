/**
 * ElevenLabs Speech Generator
 * Handles text-to-speech generation using ElevenLabs HTTP API
 */

import https from 'https';
import { resampleTo8k } from '../../audio/resampler';
import { linear16ToMulaw } from '../../audio/codecs';
import { sliceInto20msFrames } from '../../audio/frame-processor';

export interface SpeechGenerationOptions {
  voiceId?: string;
  apiKey: string;
  modelId?: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface SpeechGenerationResult {
  success: boolean;
  frames?: Uint8Array[];
  error?: string;
  bytesProcessed?: number;
}

/**
 * Generate speech from text using ElevenLabs HTTP API
 * Returns μ-law encoded audio frames ready for Twilio streaming
 */
export async function generateSpeech(
  text: string,
  options: SpeechGenerationOptions
): Promise<SpeechGenerationResult> {
  const {
    voiceId = 'aGkVQvWUZi16EH8aZJvT',
    apiKey,
    modelId = 'eleven_turbo_v2_5',
    speed = 0.95,
    stability = 0.5,
    similarityBoost = 0.9,
    style = 0.2,
    useSpeakerBoost = true
  } = options;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing ElevenLabs API key'
    };
  }
  
  console.log('🎤 Generating speech with ElevenLabs HTTP API...');
  console.log('📋 Text:', text);
  console.log('📋 Voice ID:', voiceId);
  
  const postData = JSON.stringify({
    text: text,
    model_id: modelId,
    voice_settings: {
      speed,
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost
    },
    optimize_streaming_latency: 3
  });
  
  return new Promise((resolve) => {
    // Use μ-law 8kHz directly from ElevenLabs - no conversion needed!
    const requestOptions = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(requestOptions, (res) => {
      console.log(`✅ ElevenLabs response status: ${res.statusCode}`);
      
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', (chunk) => {
          errorBody += chunk.toString();
        });
        res.on('end', () => {
          console.error('❌ ElevenLabs error:', errorBody);
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}: ${errorBody}`
          });
        });
        return;
      }
      
      const audioChunks: Buffer[] = [];
      
      res.on('data', (chunk) => {
        audioChunks.push(chunk);
      });
      
      res.on('end', () => {
        const fullAudio = Buffer.concat(audioChunks);
        const ulawArray = new Uint8Array(fullAudio);
        const frames = sliceInto20msFrames(ulawArray);
        
        console.log(`✅ Speech generated - ${frames.length} frames (${fullAudio.length} bytes)`);
        
        resolve({
          success: true,
          frames,
          bytesProcessed: fullAudio.length
        });
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ ElevenLabs request error:', error);
      resolve({
        success: false,
        error: error.message
      });
    });
    
    req.write(postData);
    req.end();
  });
}
