/**
 * Job number phase processors (legacy)
 * Handles job number collection and confirmation
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process collect_job_number phase
 */
export function processJobNumberPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
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
 * Process confirm_job_number phase
 */
export function processConfirmJobNumberPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
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
