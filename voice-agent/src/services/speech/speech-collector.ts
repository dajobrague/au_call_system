/**
 * Speech Collection Orchestrator
 * Main orchestrator for the speech collection flow
 */

import { AudioBuffer } from './audio-buffer';
import { 
  SpeechState, 
  SpeechCollectionContext, 
  SpeechCollectionState,
  createSpeechState,
  transitionState,
  isRecording,
  getRecordingDuration
} from './speech-state-manager';
import { 
  createVADState, 
  detectVoiceActivity, 
  updateVADState, 
  shouldStopRecording as vadShouldStop,
  VADState 
} from './vad';
import { transcribeAudio } from './whisper-stt';
import { extractDateTime } from './datetime-parser';
import { 
  generateDialogResponse, 
  shouldContinueCollection, 
  generateInitialPrompt,
  generateErrorResponse 
} from './dialog-responses';
import { generateBeepTone } from '../../audio/generators';
import { logger } from '../../lib/logger';

// Constants
const RECORDING_TIMEOUT_MS = 10000; // 10 seconds max recording
const MAX_ATTEMPTS = 3;

/**
 * Estimate audio duration for timing (rough calculation)
 */
function estimateAudioDuration(text: string): number {
  // Rough estimate: ~150 words per minute, ~2.5 chars per word
  const wordsPerMinute = 150;
  const charsPerWord = 2.5;
  const estimatedWords = text.length / charsPerWord;
  const durationMs = (estimatedWords / wordsPerMinute) * 60 * 1000;
  return Math.max(1000, Math.min(10000, durationMs)); // Between 1-10 seconds
}

/**
 * Extended WebSocket interface for speech collection
 */
export interface WebSocketWithSpeech {
  streamSid?: string;
  callSid?: string;
  speechState?: SpeechCollectionState;
  speechBuffer?: AudioBuffer;
  vadState?: VADState;
  recordingTimeout?: NodeJS.Timeout;
  generateSpeech?: (text: string) => Promise<void>;
  collectedDateTime?: {
    dateISO?: string;
    timeISO?: string;
    displayText?: string;
    originalText: string;
  };
  readyState: number;
  send: (data: string) => void;
}

/**
 * Start speech collection
 */
export async function startSpeechCollection(
  ws: WebSocketWithSpeech,
  prompt: string,
  context: SpeechCollectionContext,
  generateSpeech: (text: string) => Promise<void>
): Promise<void> {
  logger.info('Starting speech collection', {
    prompt,
    phase: context.phase,
    attemptNumber: context.attemptNumber || 1,
    type: 'speech_collection_start'
  });
  
  // Store speech generator function
  ws.generateSpeech = generateSpeech;
  
  // Initialize speech collection state
  ws.speechState = createSpeechState(context);
  ws.speechState = transitionState(ws.speechState, SpeechState.PROMPT_PLAYING);
  
  // Initialize audio buffer and VAD
  ws.speechBuffer = new AudioBuffer();
  ws.vadState = createVADState();
  
  // Play instruction with beep cue
  // Add the "speak after tone" instruction if not already present
  const fullPrompt = prompt.includes('speak after the tone') || prompt.includes('Press 1') 
    ? prompt 
    : `${prompt}. Please speak after the tone and press pound when finished.`;
  
  // Wait for prompt to finish playing before starting beep
  await generateSpeech(fullPrompt);
  
  // Play beep immediately after prompt completes
  if (ws.speechState?.state === SpeechState.PROMPT_PLAYING) {
    playBeepAndStartRecording(ws);
  }
}

/**
 * Play beep and start recording
 */
function playBeepAndStartRecording(ws: WebSocketWithSpeech): void {
  if (!ws.speechState || !ws.streamSid) return;
  
  logger.info('Playing beep tone', {
    callSid: ws.callSid,
    type: 'speech_beep_start'
  });
  
  ws.speechState = transitionState(ws.speechState, SpeechState.BEEP_PLAYING);
  
  // Generate and play beep
  const beepFrames = generateBeepTone(300);
  beepFrames.forEach((frame, index) => {
    const twilioMessage = {
      event: 'media',
      streamSid: ws.streamSid,
      media: {
        payload: Buffer.from(frame).toString('base64')
      }
    };
    
    setTimeout(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(twilioMessage));
      }
    }, index * 20);
  });
  
  // Start recording after beep
  setTimeout(() => {
    startRecording(ws);
  }, 400); // 300ms beep + 100ms buffer
}

/**
 * Start recording
 */
function startRecording(ws: WebSocketWithSpeech): void {
  if (!ws.speechState) return;
  
  logger.info('Recording started - speak now', {
    callSid: ws.callSid,
    type: 'speech_recording_start'
  });
  
  ws.speechState = transitionState(ws.speechState, SpeechState.RECORDING);
  
  // Auto-stop recording after timeout
  ws.recordingTimeout = setTimeout(() => {
    if (ws.speechState && isRecording(ws.speechState)) {
      logger.warn('Recording timeout - processing speech', {
        callSid: ws.callSid,
        type: 'speech_recording_timeout'
      });
      stopRecordingAndProcess(ws);
    }
  }, RECORDING_TIMEOUT_MS);
}

/**
 * Process incoming audio chunk during recording
 */
export function processAudioChunk(ws: WebSocketWithSpeech, audioChunk: Buffer): void {
  if (!ws.speechState || !isRecording(ws.speechState)) return;
  if (!ws.speechBuffer || !ws.vadState) return;
  
  // Append to buffer
  const appended = ws.speechBuffer.append(audioChunk);
  
  if (!appended) {
    // Buffer full, auto-stop
    logger.warn('Speech buffer full - processing', {
      callSid: ws.callSid,
      bufferSize: ws.speechBuffer.getSize(),
      type: 'speech_buffer_full'
    });
    stopRecordingAndProcess(ws);
    return;
  }
  
  // Check VAD for silence
  const activity = detectVoiceActivity(audioChunk);
  ws.vadState = updateVADState(ws.vadState, activity);
  
  const recordingDuration = getRecordingDuration(ws.speechState);
  
  if (vadShouldStop(ws.vadState, recordingDuration)) {
    logger.info('VAD detected end of speech', {
      callSid: ws.callSid,
      recordingDuration,
      consecutiveSilentFrames: ws.vadState.consecutiveSilentFrames,
      type: 'speech_vad_stop'
    });
    stopRecordingAndProcess(ws);
  }
}

/**
 * Stop recording and process speech
 */
export async function stopRecordingAndProcess(ws: WebSocketWithSpeech): Promise<void> {
  if (!ws.speechState || !isRecording(ws.speechState)) return;
  
  logger.info('Stopping recording and processing speech', {
    callSid: ws.callSid,
    type: 'speech_stop_processing'
  });
  
  ws.speechState = transitionState(ws.speechState, SpeechState.PROCESSING);
  
  // Clear timeout
  if (ws.recordingTimeout) {
    clearTimeout(ws.recordingTimeout);
    ws.recordingTimeout = undefined;
  }
  
  // Process collected speech
  await processSpeechWithAI(ws);
}

/**
 * Process speech with AI (Whisper + OpenAI)
 */
async function processSpeechWithAI(ws: WebSocketWithSpeech): Promise<void> {
  if (!ws.speechBuffer || !ws.speechState || !ws.generateSpeech) return;
  
  const context = ws.speechState.context;
  if (!context) return;
  
  // Check minimum data
  if (!ws.speechBuffer.hasMinimumData()) {
    logger.warn('Speech too short', {
      callSid: ws.callSid,
      bufferSize: ws.speechBuffer.getSize(),
      type: 'speech_too_short'
    });
    
    const errorResponse = generateErrorResponse('too_short');
    ws.generateSpeech(errorResponse);
    
    // Retry if under max attempts
    if ((context.attemptNumber || 1) < MAX_ATTEMPTS) {
      setTimeout(() => {
        startSpeechCollection(
          ws,
          errorResponse,
          { ...context, attemptNumber: (context.attemptNumber || 1) + 1 },
          ws.generateSpeech!
        );
      }, 500);
    }
    return;
  }
  
  try {
    const audioBuffer = ws.speechBuffer.getBuffer();
    
    logger.info('Processing speech with Whisper', {
      callSid: ws.callSid,
      bufferSize: audioBuffer.length,
      durationMs: ws.speechBuffer.getDurationMs(),
      type: 'speech_whisper_start'
    });
    
    // Step 1: Transcribe with Whisper
    const whisperResult = await transcribeAudio(audioBuffer);
    
    if (!whisperResult.success || !whisperResult.text) {
      logger.warn('Whisper transcription failed', {
        callSid: ws.callSid,
        error: whisperResult.error,
        isHallucination: whisperResult.isHallucination,
        type: 'speech_whisper_failed'
      });
      
      const errorType = whisperResult.isHallucination ? 'hallucination' : 'no_speech';
      const errorResponse = generateErrorResponse(errorType);
      ws.generateSpeech(errorResponse);
      
      // Retry if under max attempts
      if ((context.attemptNumber || 1) < MAX_ATTEMPTS) {
        setTimeout(() => {
          startSpeechCollection(
            ws,
            errorResponse,
            { ...context, attemptNumber: (context.attemptNumber || 1) + 1 },
            ws.generateSpeech!
          );
        }, 500);
      } else {
        // Max attempts reached
        ws.generateSpeech(generateErrorResponse('max_attempts'));
      }
      return;
    }
    
    const userSpeech = whisperResult.text;
    logger.info('User said', {
      callSid: ws.callSid,
      text: userSpeech,
      type: 'speech_transcribed'
    });

    // Track speech transcription event
    const wsExt = ws as any;
    if (wsExt.callEvents) {
      const { trackCallEvent } = require('../airtable/call-log-service');
      trackCallEvent(wsExt.callEvents, context.phase || 'collect_day', 'speech_transcribed', {
        text: userSpeech
      });
    }
    
    // Step 2: Parse with OpenAI (pass any partial results from previous attempts)
    const extraction = await extractDateTime(userSpeech);
    
    // Merge with any partial results from previous attempts
    const mergedExtraction = {
      ...extraction,
      // If we already have a date from before, keep it
      hasDay: extraction.hasDay || !!context.partialDate,
      dateISO: extraction.dateISO || context.partialDate,
      // If we already have a time from before, keep it
      hasTime: extraction.hasTime || !!context.partialTime,
      timeISO: extraction.timeISO || context.partialTime,
    };
    
    // If we now have both, use OpenAI's displayText (it has the correct day name)
    // Only create our own if OpenAI didn't provide one
    if (mergedExtraction.hasDay && mergedExtraction.hasTime && mergedExtraction.dateISO && mergedExtraction.timeISO) {
      if (!mergedExtraction.displayText || !extraction.displayText) {
        // Only format if OpenAI didn't provide displayText (e.g., when merging partial results)
        const [year, month, day] = mergedExtraction.dateISO.split('-').map(Number);
        const [hours, minutes] = mergedExtraction.timeISO.split(':').map(Number);
        
        // Create date in local timezone (not UTC)
        const date = new Date(year, month - 1, day, hours, minutes);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        
        // Format time in 12-hour format
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        const time12h = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
        
        mergedExtraction.displayText = `${dayName}, ${monthDay} at ${time12h}`;
      }
      // Otherwise keep OpenAI's displayText - it has the correct day name!
      mergedExtraction.needsClarification = false;
      mergedExtraction.confidence = 'high';
    }
    
    logger.info('Date/time extraction result', {
      callSid: ws.callSid,
      extraction: mergedExtraction,
      hadPartialDate: !!context.partialDate,
      hadPartialTime: !!context.partialTime,
      type: 'speech_extraction_complete'
    });
    
    // Step 3: Generate response
    const dialogResponse = generateDialogResponse(mergedExtraction, context);
    
    // Step 4: Decide next action
    if (shouldContinueCollection(mergedExtraction)) {
      // Need more information - continue collecting
      logger.info('Continuing speech collection', {
        callSid: ws.callSid,
        clarificationNeeded: mergedExtraction.clarificationNeeded,
        type: 'speech_continue_collection'
      });
      
      ws.generateSpeech(dialogResponse);
      
      setTimeout(() => {
        startSpeechCollection(
          ws,
          dialogResponse,
          {
            ...context,
            attemptNumber: (context.attemptNumber || 1) + 1,
            // Store partial results for next attempt
            partialDate: mergedExtraction.dateISO || context.partialDate,
            partialTime: mergedExtraction.timeISO || context.partialTime,
            partialDisplayDate: extraction.displayText || context.partialDisplayDate,
            partialDisplayTime: extraction.displayText || context.partialDisplayTime
          },
          ws.generateSpeech!
        );
      }, 500);
      
    } else {
      // Complete - we have both day and time
      logger.info('Speech collection complete', {
        callSid: ws.callSid,
        dateISO: mergedExtraction.dateISO,
        timeISO: mergedExtraction.timeISO,
        displayText: mergedExtraction.displayText,
        type: 'speech_collection_complete'
      });

      // Track datetime extraction event
      if (wsExt.callEvents) {
        const { trackCallEvent } = require('../airtable/call-log-service');
        trackCallEvent(wsExt.callEvents, context.phase || 'collect_day', 'datetime_extracted', {
          dateISO: mergedExtraction.dateISO,
          timeISO: mergedExtraction.timeISO,
          displayText: mergedExtraction.displayText,
          originalText: extraction.originalText
        });
      }
      
      // Store in WebSocket for FSM to use
      (ws as any).collectedDateTime = {
        dateISO: mergedExtraction.dateISO,
        timeISO: mergedExtraction.timeISO,
        displayText: mergedExtraction.displayText,
        originalText: extraction.originalText
      };
      
      // Update call state to confirm_datetime phase
      if (context.updateState) {
        await context.updateState({
          phase: 'confirm_datetime',
          dateTimeInput: {
            fullDate: extraction.dateISO,
            time: extraction.timeISO?.replace(':', '') || '', // Convert "10:00" to "1000"
            displayDateTime: extraction.displayText
          }
        });
      }
      
      // Generate confirmation
      await ws.generateSpeech(dialogResponse);
    }
    
  } catch (error) {
    logger.error('Speech processing error', {
      callSid: ws.callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'speech_processing_error'
    });
    
    ws.generateSpeech("I'm having trouble processing that. Please try again.");
    
  } finally {
    // Reset buffer
    if (ws.speechBuffer) {
      ws.speechBuffer.reset();
    }
    if (ws.vadState) {
      ws.vadState = createVADState();
    }
  }
}
