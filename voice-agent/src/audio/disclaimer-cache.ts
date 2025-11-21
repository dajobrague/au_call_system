/**
 * Disclaimer Audio Cache
 * Pre-generates and caches the call recording disclaimer
 * Enables instant playback without TTS API latency
 */

import { generateSpeech } from '../services/elevenlabs/speech-generator';
import { streamAudioToTwilio } from '../services/elevenlabs/audio-streamer';
import { logger } from '../lib/logger';

const DISCLAIMER_TEXT = 'This call may be recorded for quality and compliance purposes.';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF';

interface DisclaimerCache {
  frames: Uint8Array[] | null;
  isGenerating: boolean;
  generatedAt: number | null;
}

const cache: DisclaimerCache = {
  frames: null,
  isGenerating: false,
  generatedAt: null
};

/**
 * Pre-generate disclaimer audio at server startup
 * Call this once when the WebSocket server initializes
 */
export async function initializeDisclaimerCache(): Promise<void> {
  if (cache.isGenerating || cache.frames) {
    logger.info('Disclaimer cache already initialized or generating', {
      type: 'disclaimer_cache_skip'
    });
    return;
  }

  cache.isGenerating = true;
  
  logger.info('Generating disclaimer audio cache...', {
    text: DISCLAIMER_TEXT,
    type: 'disclaimer_cache_start'
  });

  try {
    const startTime = Date.now();
    
    const result = await generateSpeech(DISCLAIMER_TEXT, {
      apiKey: ELEVENLABS_API_KEY,
      voiceId: ELEVENLABS_VOICE_ID,
      speed: 0.95 // Slightly faster for professional sound
    });

    if (result.success && result.frames) {
      cache.frames = result.frames;
      cache.generatedAt = Date.now();
      
      const duration = Date.now() - startTime;
      
      logger.info('Disclaimer audio cached successfully', {
        frameCount: result.frames.length,
        bytesProcessed: result.bytesProcessed,
        generationTime: duration,
        type: 'disclaimer_cache_success'
      });
      
      console.log(`✅ Disclaimer cached: ${result.frames.length} frames (${duration}ms)`);
    } else {
      logger.error('Failed to generate disclaimer cache', {
        error: result.error,
        type: 'disclaimer_cache_error'
      });
      
      console.error('❌ Disclaimer cache generation failed:', result.error);
    }
  } catch (error) {
    logger.error('Disclaimer cache initialization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'disclaimer_cache_exception'
    });
    
    console.error('❌ Disclaimer cache error:', error);
  } finally {
    cache.isGenerating = false;
  }
}

/**
 * Play the cached disclaimer audio instantly
 * Falls back to real-time generation if cache isn't ready
 * @param ws - WebSocket connection
 * @param streamSid - Twilio stream SID
 */
export async function playDisclaimerFromCache(
  ws: any,
  streamSid: string
): Promise<void> {
  // If cache is ready, use it instantly
  if (cache.frames && cache.frames.length > 0) {
    logger.info('Playing disclaimer from cache', {
      frameCount: cache.frames.length,
      cacheAge: cache.generatedAt ? Date.now() - cache.generatedAt : 0,
      type: 'disclaimer_cache_play'
    });
    
    console.log('⚡ Playing cached disclaimer instantly');
    
    await streamAudioToTwilio(ws, cache.frames, streamSid);
    return;
  }

  // Cache not ready - fall back to real-time generation
  logger.warn('Disclaimer cache not ready, falling back to real-time generation', {
    isGenerating: cache.isGenerating,
    type: 'disclaimer_cache_fallback'
  });
  
  console.log('⚠️ Cache not ready - generating disclaimer in real-time');
  
  const result = await generateSpeech(DISCLAIMER_TEXT, {
    apiKey: ELEVENLABS_API_KEY,
    voiceId: ELEVENLABS_VOICE_ID
  });

  if (result.success && result.frames) {
    await streamAudioToTwilio(ws, result.frames, streamSid);
  } else {
    logger.error('Failed to play disclaimer', {
      error: result.error,
      type: 'disclaimer_play_error'
    });
  }
}

/**
 * Check if disclaimer cache is ready
 */
export function isDisclaimerCacheReady(): boolean {
  return cache.frames !== null && cache.frames.length > 0;
}

/**
 * Get cache statistics for monitoring
 */
export function getDisclaimerCacheStats() {
  return {
    ready: isDisclaimerCacheReady(),
    frameCount: cache.frames?.length || 0,
    generatedAt: cache.generatedAt,
    isGenerating: cache.isGenerating
  };
}

