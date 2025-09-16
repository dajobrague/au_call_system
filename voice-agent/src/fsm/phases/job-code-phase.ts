/**
 * Job code phase processors
 * Handles job code collection and confirmation with Airtable validation
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process job_code collection phase
 * Validates job code against Airtable and checks employee authorization
 */
export async function processJobCodePhase(state: CallState, input: string, hasInput: boolean): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  console.log(`Job Code Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // User provided job code
    const jobCode = input.trim();
    
    if (jobCode.length > 0) {
      console.log(`Job code received: ${jobCode}, validating...`);
      
      // Import job service dynamically
      const { jobService } = await import('../../services/airtable');
      
      if (!state.employee) {
        console.error('No employee data in state for job validation');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
          },
          result: {
            twiml: generateTwiML('System error. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Validate job code with authorization
      const jobValidation = await jobService.validateJobWithAuthorization(state.employee, jobCode);
      
      if (jobValidation.success && jobValidation.jobTemplate) {
        console.log(`Job code ${jobCode} validated successfully`);
        
        // Store job template and patient data, move to confirmation
        const newState: CallState = {
          ...state,
          jobCode,
          jobTemplate: {
            id: jobValidation.jobTemplate.id,
            jobCode: jobValidation.jobTemplate.jobCode,
            title: jobValidation.jobTemplate.title,
            serviceType: jobValidation.jobTemplate.serviceType,
            patientId: jobValidation.jobTemplate.patientId,
            occurrenceIds: jobValidation.jobTemplate.occurrenceIds, // Include occurrence IDs
          },
          patient: jobValidation.patient ? {
            id: jobValidation.patient.id,
            name: jobValidation.patient.name,
            patientId: jobValidation.patient.patientId,
          } : undefined,
          phase: PHASES.CONFIRM_JOB_CODE,
          attempts: {
            ...state.attempts,
            confirmClientId: 1, // Using confirmClientId for job code confirmation attempts
          },
        };
        
        return {
          newState,
          result: {
            twiml: generateConfirmationTwiML(`I heard job code ${jobCode}. Press 1 to confirm, or 2 to re-enter.`),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      } else {
        // Job validation failed
        const newAttempts = state.attempts.jobNumber + 1;
        
        if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
          console.log(`Job code validation failed after ${newAttempts} attempts: ${jobValidation.error}`);
          
          // Max attempts reached - different message based on error type
          let errorMessage = 'I couldn\'t validate your job code after several attempts. Connecting you with a representative.';
          
          if (jobValidation.errorType === 'not_authorized') {
            errorMessage = 'You are not assigned to this job. Connecting you with customer care.';
          } else if (jobValidation.errorType === 'not_found') {
            errorMessage = 'I couldn\'t find that job code after several attempts. Connecting you with customer care.';
          }
          
          return {
            newState: {
              ...state,
              phase: PHASES.ERROR,
              attempts: {
                ...state.attempts,
                jobNumber: newAttempts,
              },
            },
            result: {
              twiml: generateTwiML(errorMessage, false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
        // Retry with specific error message
        console.log(`Job code validation failed (attempt ${newAttempts}): ${jobValidation.error}`);
        
        const newState: CallState = {
          ...state,
          attempts: {
            ...state.attempts,
            jobNumber: newAttempts,
          },
        };
        
        let errorPrompt = 'I couldn\'t find that job code. Please use your keypad to enter a valid job code followed by the pound key.';
        if (jobValidation.errorType === 'not_authorized') {
          errorPrompt = 'You are not assigned to that job. Please use your keypad to enter a different job code followed by the pound key.';
        }
        
        return {
          newState,
          result: {
            twiml: generateTwiML(errorPrompt, true),
            action: 'reprompt',
            shouldDeleteState: false,
          },
        };
      }
    }
  }
  
  // No input or empty input - increment job code attempts
  const newAttempts = state.attempts.jobNumber + 1; // Using jobNumber for job code attempts
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max job code attempts reached (no input), ending call');
    // Max attempts reached
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          jobNumber: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML('I didn\'t receive your job code after several attempts. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt for job code
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      jobNumber: newAttempts,
    },
  };
  
  const isFirstAttempt = newAttempts === 1;
  const prompt = isFirstAttempt 
    ? 'Please use your keypad to enter your job code followed by the pound key.'
    : 'I didn\'t get the job code. Please use your keypad to enter it followed by the pound key.';
  
  return {
    newState,
    result: {
      twiml: generateTwiML(prompt, true),
      action: isFirstAttempt ? 'prompt' : 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process job_code confirmation phase
 */
export function processConfirmJobCodePhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Confirm Job Code Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    // Check if user pressed 1 to confirm
    if (input === '1' || input.trim() === '1') {
      console.log('Job code confirmed, moving to dynamic job options');
      // Confirmed - move to job options with real data
      const newState: CallState = {
        ...state,
        phase: PHASES.JOB_OPTIONS,
        attempts: {
          ...state.attempts,
          jobOptions: 1,
        },
      };
      
      // Generate dynamic job options message
      let jobOptionsMessage: string = telephonyConfig.prompts.job_options; // fallback
      
      if (state.jobTemplate && state.patient) {
        const patientName = state.patient.name;
        const jobTitle = state.jobTemplate.title;
        jobOptionsMessage = `What do you want to do for ${patientName}'s ${jobTitle}? Press 1 for re-scheduling, Press 2 to leave the job as open for someone else to take care of it, Press 3 to talk to a representative, or Press 4 to enter a different job code.`;
      } else if (state.jobTemplate) {
        const jobTitle = state.jobTemplate.title;
        jobOptionsMessage = `What do you want to do for the ${jobTitle}? Press 1 for re-scheduling, Press 2 to leave the job as open for someone else to take care of it, Press 3 to talk to a representative, or Press 4 to enter a different job code.`;
      }
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(jobOptionsMessage),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else if (input === '2' || input.trim() === '2') {
      console.log('Job code rejected, restarting job code collection');
      // User pressed 2 to re-enter job code
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_JOB_CODE,
        jobCode: null, // Clear the job code
        attempts: {
          ...state.attempts,
          jobNumber: 1, // Reset to first attempt
          confirmClientId: 0, // Reset confirmation attempts
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
      // Invalid input for confirmation
      console.log('Invalid confirmation input:', input);
      
      const newAttempts = state.attempts.confirmClientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max job code confirmation attempts reached');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              confirmClientId: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML('I didn\'t understand your response. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Reprompt for valid confirmation
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
          twiml: generateConfirmationTwiML(`Please press 1 to confirm job code ${state.jobCode}, or 2 to re-enter.`),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input - increment confirmation attempts
  const newAttempts = state.attempts.confirmClientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max job code confirmation attempts reached (no input)');
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          confirmClientId: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML('I didn\'t hear your response. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt for confirmation
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
      twiml: generateConfirmationTwiML(`I didn't hear your response. Please press 1 to confirm job code ${state.jobCode}, or 2 to re-enter.`),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}
