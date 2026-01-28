/**
 * Audio Pre-generator for Outbound Calls
 * Phase 3: Audio Generation & TwiML
 * 
 * Generates personalized audio using ElevenLabs with template variable substitution
 */

import { generateSpeech } from '../elevenlabs/speech-generator';
import { logger } from '../../lib/logger';
import { 
  DEFAULT_MESSAGE_TEMPLATE, 
  TEMPLATE_VARIABLE_REGEX,
  ELEVENLABS_SETTINGS,
  validateMessageTemplate 
} from '../../config/outbound-calling';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Template variable values for substitution
 */
export interface TemplateVariables {
  employeeName: string;          // Staff member's first name
  patientName: string;           // Patient name (First LastInitial)
  date: string;                  // Formatted date (e.g., "March 15th")
  time: string;                  // Formatted time (e.g., "2:00 PM")
  startTime?: string;            // Start time (e.g., "14:00")
  endTime?: string;              // End time (e.g., "16:00")
  suburb?: string;               // Location suburb
  duration?: string;             // Shift duration (e.g., "2 hours")
}

/**
 * Audio generation result
 */
export interface AudioGenerationResult {
  success: boolean;
  audioUrl?: string;             // Public URL to audio file
  audioPath?: string;            // Local file path
  message?: string;              // The final message that was generated
  durationSeconds?: number;      // Estimated audio duration
  error?: string;
}

/**
 * Generate personalized audio for outbound call
 * 
 * @param messageTemplate - Template with variables like {employeeName}, {patientName}
 * @param variables - Values to substitute into template
 * @param callId - Unique identifier for this call (for file naming)
 * @returns Audio generation result with URL or error
 */
export async function generateOutboundCallAudio(
  messageTemplate: string,
  variables: TemplateVariables,
  callId: string
): Promise<AudioGenerationResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Validate template
    const validation = validateMessageTemplate(messageTemplate);
    if (!validation.valid) {
      logger.error('Invalid message template', {
        callId,
        error: validation.error,
        type: 'audio_gen_validation_error'
      });
      
      return {
        success: false,
        error: `Invalid template: ${validation.error}`
      };
    }
    
    // Step 2: Substitute variables
    const finalMessage = substituteVariables(messageTemplate, variables);
    
    logger.info('Generating outbound call audio', {
      callId,
      messageLength: finalMessage.length,
      employeeName: variables.employeeName,
      type: 'audio_gen_start'
    });
    
    // Step 3: Generate audio with ElevenLabs
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF';
    
    if (!apiKey) {
      logger.error('Missing ElevenLabs API key', {
        callId,
        type: 'audio_gen_no_api_key'
      });
      
      return {
        success: false,
        error: 'ElevenLabs API key not configured'
      };
    }
    
    const speechResult = await generateSpeech(finalMessage, {
      apiKey,
      voiceId,
      modelId: ELEVENLABS_SETTINGS.MODEL_ID,
      speed: ELEVENLABS_SETTINGS.SPEED,
      stability: ELEVENLABS_SETTINGS.STABILITY,
      similarityBoost: ELEVENLABS_SETTINGS.SIMILARITY_BOOST,
      style: ELEVENLABS_SETTINGS.STYLE,
      useSpeakerBoost: ELEVENLABS_SETTINGS.USE_SPEAKER_BOOST,
    });
    
    if (!speechResult.success || !speechResult.frames) {
      logger.error('ElevenLabs audio generation failed', {
        callId,
        error: speechResult.error,
        type: 'audio_gen_elevenlabs_error'
      });
      
      return {
        success: false,
        error: speechResult.error || 'Audio generation failed'
      };
    }
    
    // Step 4: Save audio to temporary storage
    // For Phase 3, we'll save locally. Phase 4 can add S3/cloud storage if needed
    const audioPath = await saveAudioToTemp(callId, speechResult.frames);
    
    // Step 5: Generate public URL
    // For Railway deployment, we need to serve this via HTTP endpoint
    const audioUrl = generateAudioUrl(callId);
    
    const duration = Date.now() - startTime;
    const estimatedDuration = estimateAudioDuration(finalMessage);
    
    logger.info('Outbound call audio generated successfully', {
      callId,
      audioPath,
      audioUrl,
      messageLength: finalMessage.length,
      framesGenerated: speechResult.frames.length,
      bytesProcessed: speechResult.bytesProcessed,
      generationTimeMs: duration,
      estimatedDurationSeconds: estimatedDuration,
      type: 'audio_gen_success'
    });
    
    return {
      success: true,
      audioUrl,
      audioPath,
      message: finalMessage,
      durationSeconds: estimatedDuration
    };
    
  } catch (error) {
    logger.error('Audio generation error', {
      callId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'audio_gen_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio generation failed'
    };
  }
}

/**
 * Substitute template variables with actual values
 */
function substituteVariables(template: string, variables: TemplateVariables): string {
  let message = template;
  
  // Replace each variable
  message = message.replace(/{employeeName}/g, variables.employeeName);
  message = message.replace(/{patientName}/g, variables.patientName);
  message = message.replace(/{date}/g, variables.date);
  message = message.replace(/{time}/g, variables.time);
  
  // Optional variables
  if (variables.startTime) {
    message = message.replace(/{startTime}/g, variables.startTime);
  }
  if (variables.endTime) {
    message = message.replace(/{endTime}/g, variables.endTime);
  }
  if (variables.suburb) {
    message = message.replace(/{suburb}/g, variables.suburb);
  }
  if (variables.duration) {
    message = message.replace(/{duration}/g, variables.duration);
  }
  
  return message;
}

/**
 * Save audio frames to temporary storage
 * Returns the file path
 */
async function saveAudioToTemp(callId: string, frames: Uint8Array[]): Promise<string> {
  try {
    // Ensure temp directory exists
    const tempDir = '/tmp/outbound-audio';
    await mkdir(tempDir, { recursive: true });
    
    // Combine all frames into single buffer
    const totalLength = frames.reduce((sum, frame) => sum + frame.length, 0);
    const audioBuffer = Buffer.alloc(totalLength);
    
    let offset = 0;
    for (const frame of frames) {
      audioBuffer.set(frame, offset);
      offset += frame.length;
    }
    
    // Save to file with .ulaw extension (µ-law format)
    const fileName = `outbound-call-${callId}.ulaw`;
    const filePath = path.join(tempDir, fileName);
    
    await writeFile(filePath, audioBuffer);
    
    logger.info('Audio saved to temp storage', {
      callId,
      filePath,
      sizeBytes: audioBuffer.length,
      type: 'audio_saved'
    });
    
    return filePath;
    
  } catch (error) {
    logger.error('Failed to save audio to temp storage', {
      callId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_save_error'
    });
    throw error;
  }
}

/**
 * Generate public URL for audio file
 * This URL will be used in TwiML <Play> element
 * 
 * For Phase 3, this returns a Railway URL
 * TODO: Consider CDN or S3 pre-signed URLs in production
 */
function generateAudioUrl(callId: string): string {
  const { getBaseUrl } = require('../../config/base-url');
  const baseUrl = getBaseUrl();
  
  // Audio will be served via API route in Phase 4
  return `${baseUrl}/api/outbound/audio/${callId}`;
}

/**
 * Estimate audio duration based on message length
 * Rough estimate: ~150 words per minute for natural speech
 */
function estimateAudioDuration(message: string): number {
  const words = message.split(/\s+/).length;
  const wordsPerMinute = 150; // Natural speaking pace
  const minutes = words / wordsPerMinute;
  const seconds = Math.ceil(minutes * 60);
  
  // Add buffer for pauses and punctuation
  return seconds + 2;
}

/**
 * Clean up old audio files from temp storage
 * Should be called periodically to prevent disk space issues
 */
export async function cleanupOldAudioFiles(maxAgeHours: number = 1): Promise<void> {
  try {
    const tempDir = '/tmp/outbound-audio';
    
    // Check if directory exists
    if (!fs.existsSync(tempDir)) {
      return;
    }
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.info('Cleaned up old audio files', {
        deletedCount,
        maxAgeHours,
        type: 'audio_cleanup'
      });
    }
    
  } catch (error) {
    logger.error('Audio cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_cleanup_error'
    });
  }
}

/**
 * Get audio file path for serving
 */
export function getAudioFilePath(callId: string): string {
  return path.join('/tmp/outbound-audio', `outbound-call-${callId}.ulaw`);
}
