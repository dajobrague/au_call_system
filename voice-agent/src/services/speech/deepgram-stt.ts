/**
 * Deepgram Speech-to-Text Service
 * Optimized for phone call audio (μ-law) with real-time transcription
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { logger } from '../../lib/logger';

export interface DeepgramConfig {
  model: string;
  language: string;
  encoding: string;
  sampleRate: number;
  channels: number;
  punctuate: boolean;
  interimResults: boolean;
}

export interface DeepgramResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  durationMs?: number;
}

// Configuration optimized for Twilio phone audio
const DEEPGRAM_CONFIG: DeepgramConfig = {
  model: 'nova-2',  // Latest model, best for phone calls
  language: 'en-US',
  encoding: 'mulaw',  // Native μ-law support!
  sampleRate: 8000,   // Twilio's sample rate
  channels: 1,        // Mono
  punctuate: true,
  interimResults: false  // Only final results
};

/**
 * Transcribe audio using Deepgram
 * Accepts raw μ-law audio buffer - no conversion needed!
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<DeepgramResult> {
  const startTime = Date.now();
  
  try {
    // Validate audio size
    if (audioBuffer.length < 1600) {  // ~200ms at 8kHz
      logger.warn('Audio too short for transcription', {
        size: audioBuffer.length,
        type: 'deepgram_audio_too_short'
      });
      
      return {
        success: false,
        error: 'Audio too short'
      };
    }
    
    logger.info('Transcribing audio with Deepgram', {
      audioSize: audioBuffer.length,
      durationMs: (audioBuffer.length / 8000) * 1000,
      type: 'deepgram_transcribe_start'
    });
    
    // Initialize Deepgram client
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
    
    // Transcribe using pre-recorded audio API (for buffered audio)
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: DEEPGRAM_CONFIG.model,
        language: DEEPGRAM_CONFIG.language,
        encoding: DEEPGRAM_CONFIG.encoding,
        sample_rate: DEEPGRAM_CONFIG.sampleRate,
        channels: DEEPGRAM_CONFIG.channels,
        punctuate: DEEPGRAM_CONFIG.punctuate,
      }
    );
    
    if (error) {
      logger.error('Deepgram API error', {
        error: error.message || error,
        type: 'deepgram_api_error'
      });
      
      return {
        success: false,
        error: `Deepgram API error: ${error.message || 'Unknown error'}`
      };
    }
    
    const duration = Date.now() - startTime;
    
    // Extract transcript
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    
    // Empty response
    if (!transcript || transcript.trim().length === 0) {
      logger.info('Deepgram returned empty transcription', {
        duration,
        type: 'deepgram_empty'
      });
      
      return {
        success: false,
        error: 'No speech detected',
        durationMs: duration
      };
    }
    
    // Low confidence
    if (confidence < 0.5) {
      logger.warn('Deepgram low confidence transcription', {
        text: transcript,
        confidence,
        duration,
        type: 'deepgram_low_confidence'
      });
      
      return {
        success: false,
        error: 'Low confidence transcription',
        text: transcript,
        confidence,
        durationMs: duration
      };
    }
    
    // Success!
    logger.info('Deepgram transcription successful', {
      text: transcript,
      confidence,
      length: transcript.length,
      duration,
      type: 'deepgram_success'
    });
    
    return {
      success: true,
      text: transcript.trim(),
      confidence,
      durationMs: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Deepgram transcription error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'deepgram_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration
    };
  }
}
