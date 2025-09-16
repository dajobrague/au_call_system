/**
 * Job options phase processor
 * Handles user selection of job actions (1, 2, 3, or 4)
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process job_options phase
 * Handles user selection of job actions (1, 2, 3, or 4)
 */
export function processJobOptionsPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Job Options Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // Check if user selected a valid option (1, 2, 3, or 4)
    if (input === '1' || input === '2') {
      console.log(`Option ${input} selected, looking up future occurrences`);
      // Options 1 (reschedule) or 2 (leave open) - need to find future occurrences
      const actionType = input === '1' ? 'reschedule' : 'leave_open';
      
      // We'll handle the occurrence lookup in the next phase
      const newState: CallState = {
        ...state,
        selectedOption: input,
        actionType,
        phase: PHASES.OCCURRENCE_SELECTION,
        attempts: {
          ...state.attempts,
          occurrenceSelection: 1,
        },
      };
      
      // This will trigger occurrence lookup in the next phase
      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Please wait while I look up your upcoming appointments.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`,
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else if (input === '3') {
      console.log('Option 3 selected, completing workflow (representative)');
      // Option 3 - talk to representative (complete workflow)
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
    } else if (input === '4') {
      console.log('Option 4 selected, going back to job code entry');
      // Option 4 - go back to job code entry
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_JOB_CODE,
        jobCode: null,           // Clear current job code
        jobTemplate: undefined,  // Clear current job template
        patient: undefined,      // Clear current patient
        attempts: {
          ...state.attempts,
          jobNumber: 1,          // Reset job code attempts
          confirmClientId: 0,    // Reset confirmation attempts
          jobOptions: 0,         // Reset job options attempts
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateTwiML('Please use your keypad to enter your job code followed by the pound key.', true),
          action: 'restart',
          shouldDeleteState: false,
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
            twiml: generateTwiML('I didn\'t understand your selection. Connecting you with a representative.', false),
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
        twiml: generateTwiML('I didn\'t hear your selection. Connecting you with a representative.', false),
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
