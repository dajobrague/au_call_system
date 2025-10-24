/**
 * OpenAI Whisper Speech-to-Text Service
 * Transcribes audio using Whisper API with hallucination detection
 */

import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { mulawToWav, validateAudioSize } from './audio-converter';
import { logger } from '../../lib/logger';

export interface WhisperConfig {
  model: string;
  language: string;
  temperature: number;
  prompt: string;
  maxResponseLength: number;
}

export interface WhisperResult {
  success: boolean;
  text?: string;
  error?: string;
  isHallucination?: boolean;
  durationMs?: number;
}

// Configuration optimized for date/time transcription
const WHISPER_CONFIG: WhisperConfig = {
  model: 'whisper-1',
  language: 'en',
  temperature: 0, // Reduce hallucinations
  prompt: '', // NO PROMPT - it causes hallucinations with poor audio
  maxResponseLength: 100
};

// Common hallucination patterns to filter
const HALLUCINATION_PATTERNS = [
  'thank you for watching',
  'like and subscribe',
  'music playing',
  'background noise',
  'silence',
  '[music]',
  '[noise]',
  'you',
  'thank you',
  'thanks for watching'
];

/**
 * Check if transcription contains hallucination patterns
 */
function isHallucination(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  
  // Check for known hallucination patterns
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }
  
  // Check if text is too short (likely noise)
  if (lowerText.length < 2) {
    return true;
  }
  
  return false;
}

/**
 * Check if transcription contains relevant date/time content
 */
function hasRelevantContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const relevantWords = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'tomorrow', 'next', 'today',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'morning', 'afternoon', 'evening', 'am', 'pm',
    'sick', 'emergency', 'personal', 'family', 'vacation'
  ];
  
  // Check if text contains any relevant words OR numbers (for times/dates)
  const hasRelevantWord = relevantWords.some(word => lowerText.includes(word));
  const hasNumber = /\d/.test(text);
  
  return hasRelevantWord || hasNumber;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<WhisperResult> {
  const startTime = Date.now();
  
  try {
    // Validate audio size
    const validation = validateAudioSize(audioBuffer);
    
    if (!validation.valid) {
      logger.warn('Audio validation failed', {
        reason: validation.reason,
        durationMs: validation.durationMs,
        type: 'whisper_validation_failed'
      });
      
      return {
        success: false,
        error: validation.reason,
        durationMs: validation.durationMs
      };
    }
    
    logger.info('Transcribing audio with Whisper', {
      audioSize: audioBuffer.length,
      durationMs: validation.durationMs,
      type: 'whisper_transcribe_start'
    });
    
    // Use ffmpeg to convert μ-law to WAV properly
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Save μ-law to temp file
    const tempDir = path.join(process.cwd(), 'temp-audio');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const mulawPath = path.join(tempDir, `input-${timestamp}.mulaw`);
    const wavPath = path.join(tempDir, `output-${timestamp}.wav`);
    
    fs.writeFileSync(mulawPath, audioBuffer);
    
    // Convert using ffmpeg (handles μ-law natively and correctly!)
    try {
      await execAsync(`ffmpeg -f mulaw -ar 8000 -ac 1 -i "${mulawPath}" -ar 16000 "${wavPath}" -y 2>&1`);
      
      const wavBuffer = fs.readFileSync(wavPath);
      
      // Clean up temp files
      fs.unlinkSync(mulawPath);
      fs.unlinkSync(wavPath);
      
      logger.info('✅ Audio converted with ffmpeg', {
        inputSize: audioBuffer.length,
        outputSize: wavBuffer.length,
        type: 'ffmpeg_conversion_success'
      });
      
      console.log(`✅ FFmpeg conversion successful: ${audioBuffer.length} → ${wavBuffer.length} bytes`);
      
      // Create form data for OpenAI API
      const form = new FormData();
      form.append('file', wavBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', WHISPER_CONFIG.model);
      form.append('language', WHISPER_CONFIG.language);
      form.append('temperature', WHISPER_CONFIG.temperature.toString());
      if (WHISPER_CONFIG.prompt) {
        form.append('prompt', WHISPER_CONFIG.prompt);
      }
      
      // Call Whisper API
      // Use axios instead of fetch for proper FormData handling
      const axios = require('axios');
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders()
          },
          validateStatus: () => true // Handle all status codes manually
        }
      );
      
      if (response.status !== 200) {
        const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        logger.error('Whisper API error', {
          status: response.status,
          error: errorText,
          type: 'whisper_api_error'
        });
        
        return {
          success: false,
          error: `Whisper API error: ${response.status}`
        };
      }
      
      const result = response.data;
      const text = result.text?.trim() || '';
      
      const duration = Date.now() - startTime;
      
      // Validate response length
      if (text.length > WHISPER_CONFIG.maxResponseLength) {
        logger.warn('Whisper response too long (likely hallucination)', {
          length: text.length,
          text: text.substring(0, 100),
          duration,
          type: 'whisper_too_long'
        });
        
        return {
          success: false,
          error: 'Response too long',
          isHallucination: true,
          durationMs: duration
        };
      }
      
      // Check for hallucinations
      if (isHallucination(text)) {
        logger.warn('Whisper hallucination detected', {
          text,
          duration,
          type: 'whisper_hallucination'
        });
        
        return {
          success: false,
          error: 'Hallucination detected',
          isHallucination: true,
          durationMs: duration
        };
      }
      
      // Check for relevant content
      if (text.length > 0 && !hasRelevantContent(text)) {
        logger.warn('Whisper response lacks relevant content', {
          text,
          duration,
          type: 'whisper_irrelevant'
        });
        
        return {
          success: false,
          error: 'No relevant content',
          durationMs: duration
        };
      }
      
      // Empty response
      if (text.length === 0) {
        logger.info('Whisper returned empty transcription', {
          duration,
          type: 'whisper_empty'
        });
        
        return {
          success: false,
          error: 'No speech detected',
          durationMs: duration
        };
      }
      
      // Success!
      logger.info('Whisper transcription successful', {
        text,
        length: text.length,
        duration,
        type: 'whisper_success'
      });
      
      return {
        success: true,
        text,
        durationMs: duration
      };
      
    } catch (ffmpegError) {
      // FFmpeg conversion failed
      logger.error('FFmpeg conversion error', {
        error: ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error',
        type: 'ffmpeg_error'
      });
      
      return {
        success: false,
        error: 'Audio conversion failed'
      };
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Whisper transcription error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'whisper_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration
    };
  }
}
