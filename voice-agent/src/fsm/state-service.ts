/**
 * State service for FSM management
 * Pure functions to load/update/transition/delete call state
 */

import { getState, setState, deleteState } from '../services/redis';
import { stateKeys } from '../services/redis/config';
import { telephonyConfig } from '../config/telephony';
import { MAX_ATTEMPTS_PER_FIELD, PHASES, DEFAULT_LANGUAGE, VOICE_CONFIG, GATHER_CONFIG } from './constants';
import type { CallState, TwilioWebhookData, ProcessingResult, InputSource, StateAction } from './types';

/**
 * Create initial call state
 */
export function createInitialState(callSid: string): CallState {
  const now = new Date().toISOString();
  return {
    sid: callSid,
    phase: PHASES.COLLECT_CLIENT_ID,
    clientId: null,
    jobNumber: null,
    attempts: {
      clientId: 0,
      jobNumber: 0,
    },
    lang: DEFAULT_LANGUAGE,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Load call state from Redis or create new one
 */
export async function loadCallState(callSid: string): Promise<CallState> {
  const key = stateKeys.call(callSid);
  const existingState = await getState<CallState>(key);
  
  if (existingState) {
    return existingState;
  }
  
  // Create new state
  const newState = createInitialState(callSid);
  await setState(key, newState);
  return newState;
}

/**
 * Save call state to Redis with TTL refresh
 */
export async function saveCallState(state: CallState): Promise<boolean> {
  const key = stateKeys.call(state.sid);
  const updatedState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  return await setState(key, updatedState);
}

/**
 * Delete call state from Redis
 */
export async function deleteCallState(callSid: string): Promise<boolean> {
  const key = stateKeys.call(callSid);
  return await deleteState(key);
}

/**
 * Normalize input from Twilio webhook
 */
export function normalizeInput(webhookData: TwilioWebhookData): { input: string; source: InputSource } {
  const speechResult = webhookData.SpeechResult?.trim() || '';
  const digits = webhookData.Digits?.trim() || '';
  
  if (speechResult) {
    return { input: speechResult, source: 'speech' };
  }
  
  if (digits) {
    return { input: digits, source: 'dtmf' };
  }
  
  return { input: '', source: 'none' };
}

/**
 * Generate TwiML response
 */
function generateTwiML(prompt: string, isGather: boolean = true): string {
  const voiceAttrs = `voice="${VOICE_CONFIG.voice}" language="${VOICE_CONFIG.language}" ttsProvider="${VOICE_CONFIG.ttsProvider}"`;
  
  if (!isGather) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say ${voiceAttrs}>${prompt}</Say>
  <Hangup/>
</Response>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="${GATHER_CONFIG.input}" 
    language="${GATHER_CONFIG.language}" 
    timeout="${GATHER_CONFIG.timeout}" 
    speechTimeout="${GATHER_CONFIG.speechTimeout}" 
    finishOnKey="${GATHER_CONFIG.finishOnKey}"
    action="${GATHER_CONFIG.action}"
    method="${GATHER_CONFIG.method}">
    <Say ${voiceAttrs}>${prompt}</Say>
  </Gather>
  <Say ${voiceAttrs}>We didn't receive your input. Please try again.</Say>
  <Redirect>${GATHER_CONFIG.action}</Redirect>
</Response>`;
}

/**
 * Process collect_client_id phase
 */
function processClientIdPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  if (hasInput) {
    // Transition to job number collection
    const newState: CallState = {
      ...state,
      clientId: input,
      phase: PHASES.COLLECT_JOB_NUMBER,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.ask_jobNumber),
        action: 'transition',
        shouldDeleteState: false,
      },
    };
  }
  
  // No input - increment attempts
  const newAttempts = state.attempts.clientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    // Max attempts exceeded
    const newState: CallState = {
      ...state,
      phase: PHASES.DONE,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.goodbye, false),
        action: 'goodbye',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      clientId: newAttempts,
    },
  };
  
  return {
    newState,
    result: {
      twiml: generateTwiML(telephonyConfig.prompts.reprompt_clientId),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process collect_job_number phase
 */
function processJobNumberPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  if (hasInput) {
    // Complete the flow
    const newState: CallState = {
      ...state,
      jobNumber: input,
      phase: PHASES.DONE,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.confirm_both, false),
        action: 'confirm',
        shouldDeleteState: true,
      },
    };
  }
  
  // No input - increment attempts
  const newAttempts = state.attempts.jobNumber + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    // Max attempts exceeded
    const newState: CallState = {
      ...state,
      phase: PHASES.DONE,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.goodbye, false),
        action: 'goodbye',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      jobNumber: newAttempts,
    },
  };
  
  return {
    newState,
    result: {
      twiml: generateTwiML(telephonyConfig.prompts.reprompt_jobNumber),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Main FSM processing function
 */
export async function processCallState(webhookData: TwilioWebhookData): Promise<ProcessingResult> {
  const { input, source } = normalizeInput(webhookData);
  const hasInput = input.length > 0;
  
  try {
    // Load current state
    let state = await loadCallState(webhookData.CallSid);
    
    // Handle initial call (no previous state and no input)
    if (state.attempts.clientId === 0 && !hasInput) {
      // First prompt for client ID
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          clientId: 1,
        },
      };
      
      await saveCallState(newState);
      
      return {
        twiml: generateTwiML(telephonyConfig.prompts.welcome),
        action: 'prompt',
        shouldDeleteState: false,
        logData: {
          phase: newState.phase,
          hasInput,
          inputSource: source,
          attempts: newState.attempts,
          action: 'prompt',
        },
      };
    }

    // If this is a fresh state but we have input, treat it as first client ID attempt
    if (state.attempts.clientId === 0 && hasInput && state.phase === PHASES.COLLECT_CLIENT_ID) {
      state = {
        ...state,
        attempts: {
          ...state.attempts,
          clientId: 1,
        },
      };
    }
    
    // Log state for debugging (production-ready)
    console.log(`FSM: CallSid=${webhookData.CallSid}, Phase=${state.phase}, HasInput=${hasInput}`);

    // Process based on current phase
    let newState: CallState;
    let result: Partial<ProcessingResult>;
    
    switch (state.phase) {
      case PHASES.COLLECT_CLIENT_ID:
        ({ newState, result } = processClientIdPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_JOB_NUMBER:
        ({ newState, result } = processJobNumberPhase(state, input, hasInput));
        break;
        
      case PHASES.DONE:
        // Should rarely hit this if we delete state properly
        return {
          twiml: generateTwiML(telephonyConfig.prompts.goodbye, false),
          action: 'goodbye',
          shouldDeleteState: true,
          logData: {
            phase: state.phase,
            hasInput,
            inputSource: source,
            attempts: state.attempts,
            action: 'goodbye',
          },
        };
        
      default:
        throw new Error(`Unknown phase: ${state.phase}`);
    }
    
    // Save or delete state
    if (result.shouldDeleteState) {
      await deleteCallState(webhookData.CallSid);
    } else {
      await saveCallState(newState);
    }
    
    return {
      twiml: result.twiml!,
      action: result.action!,
      shouldDeleteState: result.shouldDeleteState!,
      logData: {
        phase: newState.phase,
        hasInput,
        inputSource: source,
        attempts: newState.attempts,
        action: result.action!,
      },
    };
    
  } catch (error) {
    console.error('FSM processing error:', error);
    
    // Fallback: single-turn prompt with no persistence
    // If Redis is unavailable, provide a basic response based on input
    if (hasInput) {
      // If we have input but can't persist state, acknowledge and ask for both pieces of info
      return {
        twiml: generateTwiML('Thank you. Due to a technical issue, please call back and provide both your client number and job number when prompted.', false),
        action: 'error',
        shouldDeleteState: false,
        logData: {
          phase: PHASES.ERROR,
          hasInput,
          inputSource: source,
          attempts: { clientId: 0, jobNumber: 0 },
          action: 'error',
        },
      };
    } else {
      // No input, provide welcome prompt
      return {
        twiml: generateTwiML(telephonyConfig.prompts.welcome),
        action: 'error',
        shouldDeleteState: false,
        logData: {
          phase: PHASES.ERROR,
          hasInput,
          inputSource: source,
          attempts: { clientId: 0, jobNumber: 0 },
          action: 'error',
        },
      };
    }
  }
}
