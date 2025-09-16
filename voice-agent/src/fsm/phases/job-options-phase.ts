/**
 * Job options phase processor
 * Handles user selection of job actions (1, 2, 3, or 4)
 * Supports both traditional DTMF and conversational AI voice modes
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML, generateAdaptiveTwiML } from '../twiml/twiml-generator';
import { parseIntent } from '../../services/intent/intent-parser';
import { getJobOptionsMessage } from '../../services/voice/natural-responses';
import { getConversationContext, shouldRequestClarification, generateContextualClarification } from '../../services/intent/conversation-context';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process job_options phase
 * Handles user selection of job actions (1, 2, 3, or 4)
 */
export function processJobOptionsPhase(state: CallState, input: string, hasInput: boolean, inputSource?: 'speech' | 'dtmf' | 'none'): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Job Options Phase: hasInput=${hasInput}, input="${input}", source=${inputSource}`);
  
  if (hasInput) {
    let selectedOption = input;
    
    // If this is voice input, parse the intent
    if (inputSource === 'speech') {
      const intentResult = parseIntent(input, 'job_options');
      
      if (!intentResult.success || !intentResult.intent) {
        // Failed to parse intent - ask for clarification
        const conversationContext = getConversationContext(state);
        const newAttempts = state.attempts.jobOptions + 1;
        
        if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
          console.log('Max job options attempts reached (voice parsing failed)');
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
              twiml: generateAdaptiveTwiML('I\'m having trouble understanding what you\'d like to do. Let me connect you with a representative.', false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
        // Generate clarification prompt
        const clarificationPrompt = generateContextualClarification({
          currentPhase: state.phase,
          expectedInputType: 'selection',
          previousIntents: [],
          failedAttempts: newAttempts,
          conversationHistory: [],
        });
        
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
            twiml: generateAdaptiveTwiML(clarificationPrompt, true),
            action: 'reprompt',
            shouldDeleteState: false,
          },
        };
      }
      
      selectedOption = intentResult.intent;
      console.log(`Voice intent parsed: "${input}" → option ${selectedOption} (confidence: ${intentResult.confidence})`);
    }
    
    // Process the selected option (now works for both voice and DTMF)
    if (selectedOption === '1' || selectedOption === '2') {
      console.log(`Option ${selectedOption} selected, looking up future occurrences`);
      // Options 1 (reschedule) or 2 (leave open) - need to find future occurrences
      const actionType = selectedOption === '1' ? 'reschedule' : 'leave_open';
      
      // We'll handle the occurrence lookup in the next phase
      const newState: CallState = {
        ...state,
        selectedOption: selectedOption,
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
    } else if (selectedOption === '3') {
      console.log('Option 3 selected, completing workflow (representative)');
      // Option 3 - talk to representative (complete workflow)
      const newState: CallState = {
        ...state,
        selectedOption: selectedOption,
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
    } else if (selectedOption === '4') {
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
