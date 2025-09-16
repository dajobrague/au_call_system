/**
 * Date/time collection phase processors
 * Handles day, month, time collection and confirmation for rescheduling
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import { 
  generateDateTimeTwiML, 
  validateDay, 
  validateMonth, 
  validateTime, 
  validateDateCombination, 
  formatDateTimeForVoice, 
  createFullDateString, 
  isFutureDate 
} from '../../utils/date-time';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process collect_day phase
 * Collects day input (DD format with auto-advance)
 */
export function processCollectDayPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Collect Day Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    const day = input.trim();
    const dayValidation = validateDay(day);
    
    if (dayValidation.valid) {
      console.log(`Valid day received: ${day}`);
      // Store day and move to month collection
      const newState: CallState = {
        ...state,
        dateTimeInput: {
          ...state.dateTimeInput,
          day,
        },
        phase: PHASES.COLLECT_MONTH,
        attempts: {
          ...state.attempts,
          confirmClientId: 0, // Reset for month collection
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateDateTimeTwiML('Enter the month using 2 digits, for example 0 1 for January or 1 2 for December.', 2),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else {
      // Invalid day
      const newAttempts = state.attempts.clientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max day attempts reached');
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
            twiml: generateTwiML('I couldn\'t get a valid day. Connecting you with a representative.', false),
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
          twiml: generateDateTimeTwiML('Please enter a valid day using 2 digits, between 0 1 and 3 1.', 2),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input
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
        twiml: generateTwiML('I didn\'t receive the day. Connecting you with a representative.', false),
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
      twiml: generateDateTimeTwiML('I didn\'t hear the day. Please enter the day using 2 digits.', 2),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process collect_month phase
 * Collects month input (MM format with auto-advance)
 */
export function processCollectMonthPhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Collect Month Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    const month = input.trim();
    const monthValidation = validateMonth(month);
    
    if (monthValidation.valid && state.dateTimeInput?.day) {
      // Validate day+month combination
      const dateValidation = validateDateCombination(state.dateTimeInput.day, month);
      
      if (dateValidation.valid) {
        console.log(`Valid month received: ${month}`);
        // Store month and move to time collection
        const newState: CallState = {
          ...state,
          dateTimeInput: {
            ...state.dateTimeInput,
            month,
          },
          phase: PHASES.COLLECT_TIME,
          attempts: {
            ...state.attempts,
            confirmClientId: 0, // Reset for time collection
          },
        };
        
        return {
          newState,
          result: {
            twiml: generateDateTimeTwiML('Enter the time in military format. Use 2 digits for hour only, like 1 9 for 7 PM, or 4 digits for hour and minutes, like 1 9 3 0 for 7:30 PM.', 4),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      } else {
        // Invalid date combination
        console.log(`Invalid date combination: day ${state.dateTimeInput.day}, month ${month}`);
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
              twiml: generateTwiML('I couldn\'t get a valid date. Connecting you with a representative.', false),
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
            twiml: generateDateTimeTwiML(`${dateValidation.error}. Please enter a valid month using 2 digits, between 0 1 and 1 2.`, 2),
            action: 'reprompt',
            shouldDeleteState: false,
          },
        };
      }
    } else {
      // Invalid month
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
            twiml: generateTwiML('I couldn\'t get a valid month. Connecting you with a representative.', false),
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
          twiml: generateDateTimeTwiML('Please enter a valid month using 2 digits, between 0 1 and 1 2.', 2),
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
        twiml: generateTwiML('I didn\'t receive the month. Connecting you with a representative.', false),
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
      twiml: generateDateTimeTwiML('I didn\'t hear the month. Please enter the month using 2 digits.', 2),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process collect_time phase
 * Collects time input (HH or HHMM military format with auto-advance)
 */
export function processCollectTimePhase(state: CallState, input: string, hasInput: boolean): { newState: CallState; result: Partial<ProcessingResult> } {
  console.log(`Collect Time Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    const time = input.trim();
    const timeValidation = validateTime(time);
    
    if (timeValidation.valid && timeValidation.normalizedTime && state.dateTimeInput?.day && state.dateTimeInput?.month) {
      console.log(`Valid time received: ${time} -> ${timeValidation.normalizedTime}`);
      
      // Create full date and display format
      const fullDate = createFullDateString(state.dateTimeInput.day, state.dateTimeInput.month);
      const displayDateTime = formatDateTimeForVoice(state.dateTimeInput.day, state.dateTimeInput.month, timeValidation.normalizedTime);
      
      // Check if date is in the future
      if (!isFutureDate(state.dateTimeInput.day, state.dateTimeInput.month)) {
        console.log('Date is in the past');
        const newAttempts = state.attempts.jobNumber + 1;
        
        if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
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
              twiml: generateTwiML('The date cannot be in the past. Connecting you with a representative.', false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
        // Go back to day collection
        const newState: CallState = {
          ...state,
          dateTimeInput: {}, // Reset date input
          phase: PHASES.COLLECT_DAY,
          attempts: {
            ...state.attempts,
            jobNumber: newAttempts,
          },
        };
        
        return {
          newState,
          result: {
            twiml: generateDateTimeTwiML('The date cannot be in the past. Please enter a future day using 2 digits.', 2),
            action: 'reprompt',
            shouldDeleteState: false,
          },
        };
      }
      
      // Store complete date/time and move to confirmation
      const newState: CallState = {
        ...state,
        dateTimeInput: {
          ...state.dateTimeInput,
          time: timeValidation.normalizedTime,
          fullDate,
          displayDateTime,
        },
        phase: PHASES.CONFIRM_DATETIME,
        attempts: {
          ...state.attempts,
          confirmJobNumber: 1, // Reset for datetime confirmation
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(`Confirm rescheduling to ${displayDateTime}. Press 1 to confirm, or 2 to start over.`),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    } else {
      // Invalid time
      const newAttempts = state.attempts.jobNumber + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
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
            twiml: generateTwiML('I couldn\'t get a valid time. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
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
          twiml: generateDateTimeTwiML(`${timeValidation.error}. Please enter time in military format, 2 digits for hour or 4 digits for hour and minutes.`, 4),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input
  const newAttempts = state.attempts.jobNumber + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
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
        twiml: generateTwiML('I didn\'t receive the time. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
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
      twiml: generateDateTimeTwiML('I didn\'t hear the time. Please enter the time in military format.', 4),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Process confirm_datetime phase
 * Confirms the complete date/time before updating Airtable
 */
export async function processConfirmDateTimePhase(state: CallState, input: string, hasInput: boolean): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  console.log(`Confirm DateTime Phase: hasInput=${hasInput}, input="${input}"`);
  
  if (hasInput) {
    if (input === '1' || input.trim() === '1') {
      console.log('Date/time confirmed, updating appointment in Airtable');
      
      if (!state.selectedOccurrence || !state.dateTimeInput?.fullDate || !state.dateTimeInput?.time) {
        console.error('Missing data for appointment update');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
          },
          result: {
            twiml: generateTwiML('System error updating appointment. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      try {
        // Import job occurrence service and update the appointment
        const { jobOccurrenceService } = await import('../../services/airtable');
        
        const rescheduleResult = await jobOccurrenceService.rescheduleOccurrence(
          state.selectedOccurrence.id,
          state.dateTimeInput.fullDate,   // YYYY-MM-DD format
          state.dateTimeInput.time        // HHMM format
        );
        
        if (rescheduleResult.success) {
          console.log('Appointment successfully updated in Airtable');
          
          // Send reschedule confirmation SMS
          try {
            const { jobOccurrenceService } = await import('../../services/airtable');
            
            const employeePhone = state.employee?.phone || '+522281957913'; // Fallback to your phone for demo
            const employeeName = state.employee?.name || 'Employee';
            const oldDate = state.selectedOccurrence.displayDate;
            const newDateTime = state.dateTimeInput.displayDateTime || 'the new time';
            const patientName = state.patient?.name || 'Patient';
            
            // Send SMS confirmation (don't wait for completion to avoid delays)
            jobOccurrenceService.sendRescheduleConfirmationSMS(
              employeePhone,
              employeeName,
              oldDate,
              newDateTime,
              patientName
            ).then((smsResult) => {
              console.log(`Reschedule SMS result: ${smsResult.success ? 'sent' : 'failed'}`);
            }).catch((error) => {
              console.log('Reschedule SMS error:', error);
            });
            
          } catch (smsError) {
            console.log('Error sending reschedule SMS:', smsError);
            // Don't fail the main flow if SMS fails
          }
          
          const newState: CallState = {
            ...state,
            phase: PHASES.WORKFLOW_COMPLETE,
          };
          
          const oldDate = state.selectedOccurrence.displayDate;
          const newDateTime = state.dateTimeInput.displayDateTime;
          
          const confirmationMessage = `Appointment successfully rescheduled from ${oldDate} to ${newDateTime}. A confirmation message is being sent to you. ${telephonyConfig.prompts.workflow_complete}`;
          
          return {
            newState,
            result: {
              twiml: generateTwiML(confirmationMessage, false),
              action: 'confirm',
              shouldDeleteState: true,
            },
          };
        } else {
          console.error('Failed to update appointment:', rescheduleResult.error);
          
          const newState: CallState = {
            ...state,
            phase: PHASES.ERROR,
          };
          
          return {
            newState,
            result: {
              twiml: generateTwiML('I couldn\'t update your appointment in the system. Connecting you with a representative.', false),
              action: 'error',
              shouldDeleteState: true,
            },
          };
        }
        
      } catch (error) {
        console.error('Error during appointment update:', error);
        
        const newState: CallState = {
          ...state,
          phase: PHASES.ERROR,
        };
        
        return {
          newState,
          result: {
            twiml: generateTwiML('System error updating appointment. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
    } else if (input === '2' || input.trim() === '2') {
      console.log('Date/time rejected, restarting date collection');
      // User pressed 2 to start over with date collection
      const newState: CallState = {
        ...state,
        phase: PHASES.COLLECT_DAY,
        dateTimeInput: {}, // Clear date input
        attempts: {
          ...state.attempts,
          clientId: 0, // Reset attempts for date collection
          confirmJobNumber: 0,
        },
      };
      
      return {
        newState,
        result: {
          twiml: generateDateTimeTwiML('Enter the new day using 2 digits, for example 0 1 for the first or 1 5 for the fifteenth.', 2),
          action: 'restart',
          shouldDeleteState: false,
        },
      };
    } else {
      // Invalid confirmation input
      const newAttempts = state.attempts.confirmJobNumber + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              confirmJobNumber: newAttempts,
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
          confirmJobNumber: newAttempts,
        },
      };
      
      const displayDateTime = state.dateTimeInput?.displayDateTime || 'the new time';
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(`Please press 1 to confirm rescheduling to ${displayDateTime}, or 2 to start over.`),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // No input
  const newAttempts = state.attempts.confirmJobNumber + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          confirmJobNumber: newAttempts,
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
      confirmJobNumber: newAttempts,
    },
  };
  
  const displayDateTime = state.dateTimeInput?.displayDateTime || 'the new time';
  
  return {
    newState,
    result: {
      twiml: generateConfirmationTwiML(`I didn't hear your response. Please press 1 to confirm rescheduling to ${displayDateTime}, or 2 to start over.`),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}
