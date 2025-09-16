/**
 * Reason collection phase processors
 * Handles speech input for why employee cannot take the job and leave open confirmation
 * Enhanced with conversational AI and empathetic responses
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateAdaptiveTwiML } from '../twiml/twiml-generator';
import { 
  generateSpeechTwiML, 
  cleanSpeechInput, 
  formatReasonForAirtable, 
  generateSpeechConfirmationTwiML 
} from '../../utils/speech-input';
import { 
  processSpokenReason, 
  generateNaturalReasonPrompt, 
  generateEmpatheticConfirmation 
} from '../../services/voice/reason-processor';
import { 
  summarizeConversation, 
  detectEmotionalDistress 
} from '../../services/voice/conversation-summarizer';
import type { CallState, ProcessingResult, InputSource } from '../types';

/**
 * Process collect_reason phase
 * Collects speech input for why employee cannot take the job
 */
export function processCollectReasonPhase(state: CallState, input: string, hasInput: boolean, inputSource: InputSource): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Collect Reason Phase: hasInput=${hasInput}, input="${input}", source=${inputSource}`);
  
  if (hasInput && inputSource === 'speech') {
    const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
    
    if (useVoiceAI) {
      // Enhanced voice AI processing
      const reasonResult = processSpokenReason(input);
      
      if (reasonResult.success && !reasonResult.needsMoreDetail) {
        console.log(`Enhanced reason processed: "${input}" → Category: ${reasonResult.category}, Summary: ${reasonResult.summary}`);
        
        // Check for emotional distress and respond appropriately
        const distressCheck = detectEmotionalDistress(input);
        
        // Store enhanced reason data
        const newState: CallState = {
          ...state,
          rescheduleReason: reasonResult.summary || reasonResult.reason || input,
          phase: PHASES.CONFIRM_LEAVE_OPEN,
          attempts: {
            ...state.attempts,
            confirmClientId: 1,
          },
        };
        
        // Generate empathetic confirmation
        const appointmentDate = state.selectedOccurrence?.displayDate || 'the appointment';
        const confirmationMessage = distressCheck.hasDistress 
          ? distressCheck.supportiveResponse!
          : generateEmpatheticConfirmation(
              reasonResult.reason || input,
              reasonResult.category || 'other',
              appointmentDate
            );
        
        return {
          newState,
          result: {
            twiml: generateAdaptiveTwiML(confirmationMessage, true),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      } else if (reasonResult.needsMoreDetail && reasonResult.suggestedFollowUp) {
        // Need more detail - ask follow-up question
        console.log(`Reason needs more detail: "${input}"`);
        
        const newAttempts = state.attempts.clientId + 1;
        
        if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
          return {
            newState: {
              ...state,
              phase: PHASES.ERROR,
              attempts: {
                ...state.attempts,
                clientId: newAttempts,
              },
            },
            result: {
              twiml: generateAdaptiveTwiML('I understand you have your reasons. Let me mark this appointment as open for others.', false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
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
            twiml: generateAdaptiveTwiML(reasonResult.suggestedFollowUp, true),
            action: 'reprompt',
            shouldDeleteState: false,
          },
        };
      }
    }
    
    // Fallback to traditional speech processing
    const speechValidation = cleanSpeechInput(input);
    
    if (speechValidation.isValid) {
      console.log(`Valid reason received: "${speechValidation.cleaned}"`);
      
      // Store reason and move to confirmation
      const newState: CallState = {
        ...state,
        rescheduleReason: speechValidation.cleaned,
        phase: PHASES.CONFIRM_LEAVE_OPEN,
        attempts: {
          ...state.attempts,
          confirmClientId: 1, // First confirmation attempt
        },
      };
      
      const confirmationMessage = useVoiceAI
        ? `I understand. I'll mark this appointment as open for others and record your reason. Is that okay?`
        : speechValidation.cleaned;
      
      return {
        newState,
        result: {
          twiml: useVoiceAI 
            ? generateAdaptiveTwiML(confirmationMessage, true)
            : generateSpeechConfirmationTwiML(speechValidation.cleaned),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else {
      // Invalid speech input
      const newAttempts = state.attempts.clientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max reason collection attempts reached');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              clientId: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML('I couldn\'t understand your reason. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
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
          twiml: generateSpeechTwiML(`${speechValidation.error}. Please clearly state the reason why you cannot take this appointment.`),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No speech input or wrong input type
  const newAttempts = state.attempts.clientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          clientId: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML('I didn\'t hear your reason. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
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
      twiml: generateSpeechTwiML('I didn\'t hear your reason. Please speak clearly and tell me why you cannot take this appointment.'),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process confirm_leave_open phase
 * Confirms the reason and executes the leave open action
 */
export async function processConfirmLeaveOpenPhase(state: CallState, input: string, hasInput: boolean): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  console.log(`Confirm Leave Open Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    if (input === '1' || input.trim() === '1') {
      console.log('Leave open confirmed, updating job in Airtable');
      
      if (!state.selectedOccurrence || !state.employee || !state.rescheduleReason) {
        console.error('Missing data for leave open action');
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
      
      try {
        // Import job occurrence service and leave the job open with reason
        const { jobOccurrenceService } = await import('../../services/airtable');
        
        // Format reason for Airtable
        const formattedReason = formatReasonForAirtable(state.rescheduleReason, state.employee.name);
        
        const leaveOpenResult = await jobOccurrenceService.leaveJobOpen(
          state.selectedOccurrence.id,
          state.employee.id,
          formattedReason
        );
        
        if (leaveOpenResult.success) {
          console.log('Job successfully left open with reason, starting instant redistribution');
          
          // Trigger instant job redistribution
          try {
            const { jobNotificationService } = await import('../../services/sms/job-notification-service');
            
            // We need to reconstruct the full objects for redistribution
            const fullJobTemplate = {
              id: state.jobTemplate?.id || '',
              jobCode: state.jobTemplate?.jobCode || '',
              title: state.jobTemplate?.title || '',
              serviceType: state.jobTemplate?.serviceType || '',
              priority: 'Normal',
              patientId: state.jobTemplate?.patientId || '',
              providerId: state.provider?.id || '',
              defaultEmployeeId: '',
              uniqueJobNumber: 0,
              occurrenceIds: [],
              active: true,
            };
            
            const fullJobOccurrence = {
              id: state.selectedOccurrence.id,
              occurrenceId: state.selectedOccurrence.occurrenceId,
              jobTemplateId: state.jobTemplate?.id || '',
              scheduledAt: state.selectedOccurrence.scheduledAt,
              status: 'Open',
              assignedEmployeeId: '', // Now empty
              occurrenceLabel: state.selectedOccurrence.occurrenceId,
              providerId: state.provider?.id || '',
              patientId: state.jobTemplate?.patientId || '',
              displayDate: state.selectedOccurrence.displayDate,
            };
            
            const fullPatient = {
              id: state.patient?.id || '',
              name: state.patient?.name || 'Unknown Patient',
              patientId: state.patient?.patientId || 0,
              phone: '',
              dateOfBirth: '',
              providerId: state.provider?.id || '',
              active: true,
            };
            
            // Start instant redistribution (don't wait for completion)
            const redistributionResult = await jobNotificationService.processInstantJobRedistribution(
              fullJobOccurrence,
              fullJobTemplate,
              fullPatient,
              formattedReason,
              state.employee
            );
            
            console.log(`Instant redistribution result: ${redistributionResult.employeesNotified} employees notified`);
            
          } catch (redistributionError) {
            // Log error but don't fail the main flow
            console.error('Error during instant redistribution:', redistributionError);
          }
          
          const newState: CallState = {
            ...state,
            phase: PHASES.WORKFLOW_COMPLETE,
          };
          
          const confirmationMessage = `Appointment for ${state.selectedOccurrence.displayDate} has been left open and other team members are being notified immediately. Your reason has been recorded. ${telephonyConfig.prompts.workflow_complete}`;
          
          return {
            newState,
            result: {
              twiml: generateTwiML(confirmationMessage, false),
              action: 'confirm',
              shouldDeleteState: true,
            },
          };
        } else {
          console.error('Failed to leave job open:', leaveOpenResult.error);
          
          const newState: CallState = {
            ...state,
            phase: PHASES.ERROR,
          };
          
          return {
            newState,
            result: {
              twiml: generateTwiML('I couldn\'t update the job in the system. Connecting you with a representative.', false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
      } catch (error) {
        console.error('Error during leave open action:', error);
        
        const newState: CallState = {
          ...state,
          phase: PHASES.ERROR,
        };
        
        return {
          newState,
          result: {
            twiml: generateTwiML('System error updating job. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
    } else if (input === '2' || input.trim() === '2') {
      console.log('Reason rejected, collecting reason again');
      // User pressed 2 to try again with reason
      const newState: CallState = {
        ...state,
        rescheduleReason: undefined, // Clear previous reason
        phase: PHASES.COLLECT_REASON,
        attempts: {
          ...state.attempts,
          clientId: 0, // Reset attempts
          confirmClientId: 0,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateSpeechTwiML(`Please tell me the reason why you cannot take the appointment for ${state.selectedOccurrence?.displayDate}. Speak clearly after the beep.`),
          action: 'restart',
          shouldDeleteState: false,
        },
      };
    } else {
      // Invalid confirmation input
      const newAttempts = state.attempts.confirmClientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
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
          twiml: generateSpeechConfirmationTwiML(state.rescheduleReason || 'your reason'),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input
  const newAttempts = state.attempts.confirmClientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
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
      twiml: generateSpeechConfirmationTwiML(state.rescheduleReason || 'your reason'),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}
