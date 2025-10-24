/**
 * Occurrence selection phase processor
 * Looks up future occurrences and presents selection options
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { generateTwiML, generateConfirmationTwiML, generateAdaptiveTwiML } from '../twiml/twiml-generator';
import { generateSpeechTwiML } from '../../utils/speech-input';
import { generateDateTimeTwiML } from '../../utils/date-time';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process occurrence_selection phase
 * Looks up future occurrences and presents selection options
 */
export async function processOccurrenceSelectionPhase(state: CallState, input: string, hasInput: boolean): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  console.log(`Occurrence Selection Phase: hasInput=${hasInput}, input="${input}"`);
  
  // If this is the first time in this phase, look up occurrences
  if (!state.jobOccurrences && state.jobTemplate && state.employee) {
    console.log('Looking up future occurrences...');
    
    try {
      // Import job occurrence service dynamically
      const { jobOccurrenceService } = await import('../../services/airtable');
      
      // Look up future occurrences using the job template's occurrence IDs
      const fullJobTemplate = {
        id: state.jobTemplate.id,
        jobCode: state.jobTemplate.jobCode,
        title: state.jobTemplate.title,
        serviceType: state.jobTemplate.serviceType,
        patientId: state.jobTemplate.patientId,
        occurrenceIds: state.jobTemplate.occurrenceIds,
        // Add required fields for JobTemplate interface
        priority: 'Normal',
        providerId: '',
        defaultEmployeeId: '',
        uniqueJobNumber: 0,
        active: true,
      };
      
      const occurrenceLookup = await jobOccurrenceService.getFutureOccurrences(
        fullJobTemplate,
        state.employee.id
      );
      
      if (!occurrenceLookup.success) {
        console.error('Failed to lookup occurrences:', occurrenceLookup.error);
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
          },
          result: {
            twiml: generateTwiML('System error looking up appointments. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Store occurrences in state
      const newState: CallState = {
        ...state,
        jobOccurrences: occurrenceLookup.occurrences.map(occ => ({
          id: occ.id,
          occurrenceId: occ.occurrenceId,
          scheduledAt: occ.scheduledAt,
          displayDate: occ.displayDate,
          status: occ.status,
        })),
      };
      
      // Generate occurrence selection message
      const selectionMessage = jobOccurrenceService.generateOccurrenceSelectionMessage(
        occurrenceLookup.occurrences,
        state.actionType || 'reschedule'
      );
      
      if (occurrenceLookup.hasNoFutureOccurrences) {
        // No future occurrences - offer to talk to representative or go back
        const updatedState: CallState = {
          ...newState,
          phase: PHASES.NO_OCCURRENCES_FOUND,
        };
        
        return {
          newState: updatedState,
          result: {
            twiml: generateConfirmationTwiML('No upcoming appointments found for this job. Press 1 to talk to a representative, or press 2 to go back.'),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      }
      
      // Present occurrence selection options
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(selectionMessage),
          action: 'prompt',
          shouldDeleteState: false,
        },
      };
      
    } catch (error) {
      console.error('Error during occurrence lookup:', error);
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
  }
  
  // Handle user selection of occurrence
  if (hasInput && state.jobOccurrences) {
    const selection = input.trim();
    const selectionNum = parseInt(selection, 10);
    
    if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > state.jobOccurrences.length) {
      // Invalid selection
      const newAttempts = state.attempts.occurrenceSelection + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max occurrence selection attempts reached');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              occurrenceSelection: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML('I didn\'t understand your selection. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Reprompt for valid selection
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          occurrenceSelection: newAttempts,
        },
      };
      
      const maxOption = state.jobOccurrences.length;
      const repromptMessage = maxOption === 1 
        ? 'Please press 1 for the appointment.'
        : `Please press a number from 1 to ${maxOption} to select an appointment.`;
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(repromptMessage),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
    
    // Valid selection - store selected occurrence
    const selectedOccurrence = state.jobOccurrences[selectionNum - 1];
    
    console.log(`Occurrence ${selectionNum} selected:`, selectedOccurrence.displayDate);
    
    if (state.actionType === 'reschedule') {
      // For reschedule, collect new date/time
      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
      
      const newState: CallState = {
        ...state,
        selectedOccurrence: {
          id: selectedOccurrence.id,
          occurrenceId: selectedOccurrence.occurrenceId,
          scheduledAt: selectedOccurrence.scheduledAt,
          displayDate: selectedOccurrence.displayDate,
        },
        phase: useVoiceAI ? PHASES.COLLECT_DAY : PHASES.COLLECT_DAY, // Will be handled differently in voice mode
        dateTimeInput: {}, // Initialize date/time collection
        attempts: {
          ...state.attempts,
          clientId: 0, // Reset attempts for date collection
        },
      };
      
      if (useVoiceAI) {
        // Import the conversational datetime function
        const { processConversationalDateTime } = require('./datetime-phase');
        const { generateSchedulingRequest } = require('../../services/voice/datetime-parser');
        
        return {
          newState,
          result: {
            twiml: generateTwiML(generateSchedulingRequest(), true),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      } else {
        // Traditional DTMF mode
        return {
          newState,
          result: {
            twiml: generateDateTimeTwiML('Enter the new day using 2 digits, for example 0 1 for the first or 1 5 for the fifteenth.', 2),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      }
    } else {
      // For leave open, first collect the reason via speech
      console.log(`Starting leave open process for appointment: ${selectedOccurrence.displayDate}`);
      
      const newState: CallState = {
        ...state,
        selectedOccurrence: {
          id: selectedOccurrence.id,
          occurrenceId: selectedOccurrence.occurrenceId,
          scheduledAt: selectedOccurrence.scheduledAt,
          displayDate: selectedOccurrence.displayDate,
        },
        phase: PHASES.COLLECT_REASON,
        attempts: {
          ...state.attempts,
          clientId: 0, // Reset attempts for reason collection
        },
      };
      
      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
      
      if (useVoiceAI) {
        const { generateNaturalReasonPrompt } = require('../../services/voice/reason-processor');
        const naturalPrompt = generateNaturalReasonPrompt(selectedOccurrence.displayDate);
        
        return {
          newState,
          result: {
            twiml: generateAdaptiveTwiML(naturalPrompt, true),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      } else {
        return {
          newState,
          result: {
            twiml: generateSpeechTwiML(`Please tell me the reason why you cannot take the appointment for ${selectedOccurrence.displayDate}. Speak clearly after the beep.`),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      }
    }
  }
  
  // No input - reprompt
  const newAttempts = state.attempts.occurrenceSelection + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max occurrence selection attempts reached (no input)');
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          occurrenceSelection: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML('I didn\'t hear your selection. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt for selection
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      occurrenceSelection: newAttempts,
    },
  };
  
  if (state.jobOccurrences && state.jobOccurrences.length > 0) {
    const maxOption = state.jobOccurrences.length;
    const repromptMessage = maxOption === 1 
      ? 'I didn\'t hear your response. Please press 1 for the appointment.'
      : `I didn\'t hear your response. Please press a number from 1 to ${maxOption} to select an appointment.`;
    
    return {
      newState,
      result: {
        twiml: generateConfirmationTwiML(repromptMessage),
        action: 'reprompt',
        shouldDeleteState: false,
      },
    };
  }
  
  // Fallback if no occurrences data
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
