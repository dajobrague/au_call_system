/**
 * Client ID phase processors
 * Handles client ID collection and confirmation
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process collect_client_id phase
 */
export function processClientIdPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
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
 * Process confirm_client_id phase
 */
export function processConfirmClientIdPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
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
      // User pressed 2 to re-enter - restart phone authentication
      const newState: CallState = {
        ...state,
        phase: PHASES.PHONE_AUTH,
        clientId: null,
        employee: undefined,
        provider: undefined,
        authMethod: null,
        attempts: {
          ...state.attempts,
          clientId: 0, // Reset attempts
          confirmClientId: 0,
        },
      };
      
      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-C">Let me restart the authentication process.</Say>
  <Hangup/>
</Response>`,
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
