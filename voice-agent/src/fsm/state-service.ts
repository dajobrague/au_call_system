/**
 * State service for FSM management
 * Pure functions to load/update/transition/delete call state
 */

import { getState, setState, deleteState } from '../services/redis';
import { stateKeys, redisConfig } from '../services/redis/config';
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
    selectedOption: null,
    attempts: {
      clientId: 0,
      confirmClientId: 0,
      jobNumber: 0,
      confirmJobNumber: 0,
      jobOptions: 0,
    },
    lang: DEFAULT_LANGUAGE,
    createdAt: now,
    updatedAt: now,
    lastGatherAttempt: undefined,
  };
}

/**
 * Load call state from Redis or create new one
 */
export async function loadCallState(callSid: string): Promise<CallState> {
  const key = stateKeys.call(callSid);
  const existingState = await getState<CallState>(key);
  
  if (existingState) {
    // Check if call has been running too long (safety cleanup)
    const callAge = Date.now() - new Date(existingState.createdAt).getTime();
    const maxAge = redisConfig.maxCallDuration * 1000; // Convert to milliseconds
    
    if (callAge > maxAge) {
      console.log(`Call ${callSid} exceeded max duration (${callAge}ms), cleaning up`);
      await deleteCallState(callSid);
      // Create fresh state after cleanup
      const newState = createInitialState(callSid);
      await setState(key, newState);
      return newState;
    }
    
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
  const voiceAttrs = `voice="${VOICE_CONFIG.voice}" language="${VOICE_CONFIG.language}"`;
  
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
 * Generate TwiML for confirmation prompts (no # required, single digit auto-submits)
 */
function generateConfirmationTwiML(prompt: string): string {
  const voiceAttrs = `voice="${VOICE_CONFIG.voice}" language="${VOICE_CONFIG.language}"`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="dtmf" 
    language="${GATHER_CONFIG.language}" 
    timeout="${GATHER_CONFIG.timeout}" 
    numDigits="1"
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
    // Transition to client ID confirmation
    const newState: CallState = {
      ...state,
      clientId: input,
      phase: PHASES.CONFIRM_CLIENT_ID,
      attempts: {
        ...state.attempts,
        confirmClientId: 1, // First confirmation attempt
      },
    };
    
    // Generate confirmation prompt with the collected client ID
    const confirmPrompt = telephonyConfig.prompts.confirm_client_id
      .replace('{clientId}', input);
    
    return {
      newState,
      result: {
        twiml: generateConfirmationTwiML(confirmPrompt),
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
    // Move to job number confirmation
    const newState: CallState = {
      ...state,
      jobNumber: input,
      phase: PHASES.CONFIRM_JOB_NUMBER,
      attempts: {
        ...state.attempts,
        confirmJobNumber: 1, // First confirmation attempt
      },
    };
    
    // Generate confirmation prompt with the job number
    const confirmPrompt = telephonyConfig.prompts.confirm_job_number
      .replace('{jobNumber}', input);
    
    return {
      newState,
      result: {
        twiml: generateConfirmationTwiML(confirmPrompt),
        action: 'transition',
        shouldDeleteState: false,
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
 * Process confirm_client_id phase
 */
function processConfirmClientIdPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Confirm Client ID Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // Check if user pressed 1 to confirm
    if (input === '1' || input.trim() === '1') {
      console.log('Client ID confirmed, moving to job number collection');
      // Confirmed - move to job number collection
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_JOB_NUMBER,
        attempts: {
          ...state.attempts,
          jobNumber: 1, // First job number attempt
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateTwiML(telephonyConfig.prompts.ask_jobNumber),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else if (input === '2' || input.trim() === '2') {
      console.log('Client ID rejected, restarting client ID collection');
      // User pressed 2 to re-enter client ID
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_CLIENT_ID,
        clientId: null,
        attempts: {
          ...state.attempts,
          clientId: 1, // Reset to first attempt
          confirmClientId: 0,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateTwiML(telephonyConfig.prompts.welcome),
          action: 'restart',
          shouldDeleteState: false,
        },
      };
    } else {
      console.log('Invalid confirmation input, reprompting');
      // Invalid input (not 1 or 2) - reprompt with same attempts increment
      const newAttempts = state.attempts.confirmClientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        // Too many failed confirmation attempts - end call
        const newState: CallState = {
          ...state,
          phase: PHASES.ERROR,
        };
        
        return {
          newState,
          result: {
            twiml: generateTwiML(telephonyConfig.prompts.error, false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Retry confirmation
      const confirmPrompt = telephonyConfig.prompts.reprompt_confirm_client_id
        .replace('{clientId}', state.clientId || 'unknown');
      
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          confirmClientId: newAttempts,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(confirmPrompt),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input - increment confirmation attempts
  const newAttempts = state.attempts.confirmClientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    // Too many failed confirmation attempts - end call
    const newState: CallState = {
      ...state,
      phase: PHASES.ERROR,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.error, false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Retry confirmation
  const confirmPrompt = telephonyConfig.prompts.reprompt_confirm_client_id
    .replace('{clientId}', state.clientId || 'unknown');
  
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      confirmClientId: newAttempts,
    },
  };
  
  return {
    newState,
    result: {
      twiml: generateConfirmationTwiML(confirmPrompt),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process confirm_job_number phase
 */
function processConfirmJobNumberPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Confirm Job Number Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // Check if user pressed 1 to confirm
    if (input === '1' || input.trim() === '1') {
      console.log('Job number confirmed, moving to job options');
      // Confirmed - move to job options
      const newState: CallState = {
        ...state,
        phase: PHASES.JOB_OPTIONS,
        attempts: {
          ...state.attempts,
          jobOptions: 1,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(telephonyConfig.prompts.job_options),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else if (input === '2' || input.trim() === '2') {
      console.log('Job number rejected, restarting job number collection');
      // User pressed 2 to re-enter job number
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_JOB_NUMBER,
        jobNumber: null,
        attempts: {
          ...state.attempts,
          jobNumber: 1, // Reset to first attempt
          confirmJobNumber: 0,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateTwiML(telephonyConfig.prompts.ask_jobNumber),
          action: 'restart',
          shouldDeleteState: false,
        },
      };
    } else {
      console.log('Invalid job number confirmation input, reprompting');
      // Invalid input (not 1 or 2) - reprompt with same attempts increment
      const newAttempts = state.attempts.confirmJobNumber + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        // Too many failed confirmation attempts - end call
        const newState: CallState = {
          ...state,
          phase: PHASES.ERROR,
        };
        
        return {
          newState,
          result: {
            twiml: generateTwiML(telephonyConfig.prompts.error, false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Retry confirmation
      const confirmPrompt = telephonyConfig.prompts.reprompt_confirm_job_number
        .replace('{jobNumber}', state.jobNumber || 'unknown');
      
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          confirmJobNumber: newAttempts,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(confirmPrompt),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input - increment confirmation attempts
  const newAttempts = state.attempts.confirmJobNumber + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    // Too many failed confirmation attempts - end call
    const newState: CallState = {
      ...state,
      phase: PHASES.ERROR,
    };
    
    return {
      newState,
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.error, false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Retry confirmation
  const confirmPrompt = telephonyConfig.prompts.reprompt_confirm_job_number
    .replace('{jobNumber}', state.jobNumber || 'unknown');
  
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      confirmJobNumber: newAttempts,
    },
  };
  
  return {
    newState,
    result: {
      twiml: generateConfirmationTwiML(confirmPrompt),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process job_options phase
 */
function processJobOptionsPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Job Options Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // Check if user selected a valid option (1, 2, or 3)
    if (input === '1' || input === '2' || input === '3') {
      console.log(`Option ${input} selected, completing workflow`);
      // Valid option selected - complete workflow
      const newState: CallState = {
        ...state,
        selectedOption: input,
        phase: PHASES.WORKFLOW_COMPLETE,
      };
      
      return {
        newState,
        result: {
          twiml: generateTwiML(telephonyConfig.prompts.workflow_complete, false),
          action: 'confirm',
          shouldDeleteState: true,
        },
      };
    } else {
      // Invalid option, reprompt
      const newAttempts = state.attempts.jobOptions + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max job options attempts reached, ending call');
        // Max attempts reached
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              jobOptions: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML(telephonyConfig.prompts.error, false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Retry job options
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          jobOptions: newAttempts,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(telephonyConfig.prompts.reprompt_job_options),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input - increment job options attempts
  const newAttempts = state.attempts.jobOptions + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max job options attempts reached (no input), ending call');
    // Max attempts reached
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          jobOptions: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML(telephonyConfig.prompts.error, false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Retry job options
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      jobOptions: newAttempts,
    },
  };
  
  return {
    newState,
    result: {
      twiml: generateConfirmationTwiML(telephonyConfig.prompts.reprompt_job_options),
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
    
    // Idempotency protection: check if we've already processed this GatherAttempt
    if (webhookData.GatherAttempt && state.lastGatherAttempt === webhookData.GatherAttempt) {
      console.log(`Duplicate GatherAttempt detected: ${webhookData.GatherAttempt}, returning last response`);
      
      // Return a safe "please wait" response for duplicates
      return {
        twiml: generateTwiML('Please wait while we process your request.', false),
        action: 'duplicate',
        shouldDeleteState: false,
        logData: {
          phase: state.phase,
          hasInput,
          inputSource: source,
          attempts: state.attempts,
          action: 'duplicate',
        },
      };
    }
    
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
        
      case PHASES.CONFIRM_CLIENT_ID:
        ({ newState, result } = processConfirmClientIdPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_JOB_NUMBER:
        ({ newState, result } = processJobNumberPhase(state, input, hasInput));
        break;
        
      case PHASES.CONFIRM_JOB_NUMBER:
        ({ newState, result } = processConfirmJobNumberPhase(state, input, hasInput));
        break;
        
      case PHASES.JOB_OPTIONS:
        ({ newState, result } = processJobOptionsPhase(state, input, hasInput));
        break;
        
      case PHASES.WORKFLOW_COMPLETE:
        // Should rarely hit this if we delete state properly
        return {
          twiml: generateTwiML(telephonyConfig.prompts.workflow_complete, false),
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
      // Update GatherAttempt for idempotency tracking
      newState.lastGatherAttempt = webhookData.GatherAttempt;
      newState.updatedAt = new Date().toISOString();
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
          attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0 },
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
          attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0 },
          action: 'error',
        },
      };
    }
  }
}
