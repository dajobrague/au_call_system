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
      speed, // Slightly faster for more responsive feel
      stability, // Voice consistency
      similarity_boost: similarityBoost, // Voice clarity
      style, // Expressive variation
      use_speaker_boost: useSpeakerBoost // Enhanced audio quality
    },
    // Optimize for lowest latency (0-4, where 4 is fastest but slightly lower quality)
    // Setting to 3 provides good balance of speed and quality
    optimize_streaming_latency: 3
  });
  
  return new Promise((resolve) => {
    // Use μ-law 8kHz directly from ElevenLabs - no resampling needed!
    // This is optimal for Twilio's Media Streams which expects µ-law format
    const requestOptions = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData)
      },
      // Add timeout to prevent hanging
      timeout: 10000
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
      let totalBytes = 0;
      
      res.on('data', (chunk) => {
        audioChunks.push(chunk);
        totalBytes += chunk.length;
        
        // Log progress for long responses (helps identify slow generation)
        if (audioChunks.length % 10 === 0) {
          console.log(`📊 Receiving audio: ${totalBytes} bytes...`);
        }
      });
      
      res.on('end', () => {
        const fullAudio = Buffer.concat(audioChunks);
        const ulawArray = new Uint8Array(fullAudio);
        const frames = sliceInto20msFrames(ulawArray);
        
        console.log(`✅ Speech generated - ${frames.length} frames (${fullAudio.length} bytes)`);
        console.log(`⏱️ Average frame size: ${(fullAudio.length / frames.length).toFixed(1)} bytes`);
        
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
    
    req.on('timeout', () => {
      req.destroy();
      console.error('❌ ElevenLabs request timeout');
      resolve({
        success: false,
        error: 'Request timeout after 10 seconds'
      });
    });
    
    req.write(postData);
    req.end();
  });
}
