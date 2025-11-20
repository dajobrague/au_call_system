/**
 * DTMF Router
 * Routes DTMF input to appropriate phase handlers
 */

import { logger } from '../lib/logger';
import { selectJob, generateJobOptionsMessage, filterJobsByProvider } from '../handlers/job-handler';
import { generateProviderSelectionGreeting } from '../handlers/provider-handler';
import { handleRepresentativeTransfer, getQueueUpdateMessage } from '../handlers/transfer-handler';
import { generateSpeech, streamAudioToTwilio } from '../services/elevenlabs';
import { playHoldMusic } from '../audio/hold-music-player';
import { stopRecordingAndProcess, isRecording } from '../services/speech';
import { trackCallEvent } from '../services/airtable/call-log-service';
import { WebSocketWithExtensions } from './connection-handler';

export interface DTMFRoutingContext {
  ws: any;
  callState: any;
  digit: string;
  streamSid: string;
  generateAndSpeak: (text: string) => Promise<void>;
  saveState: (state: any) => Promise<void>;
}

/**
 * Route DTMF input based on current call phase
 */
export async function routeDTMFInput(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws, streamSid } = context;
  
  // Handle # key for speech recording control
  const wsExt = ws as WebSocketWithExtensions;
  if (digit === '#' && wsExt.speechState && isRecording(wsExt.speechState)) {
    logger.info('# pressed - stopping speech recording', {
      callSid: callState.sid,
      type: 'speech_manual_stop'
    });
    await stopRecordingAndProcess(wsExt);
    return;
  }
  
  logger.info('Routing DTMF input', {
    phase: callState.phase,
    digit,
    callSid: callState.sid,
    type: 'dtmf_routing'
  });
  
  switch (callState.phase) {
    case 'pin_auth':
      await handlePinAuthentication(context);
      break;
      
    case 'provider_selection':
      await handleProviderSelection(context);
      break;
      
    case 'job_selection':
      await handleJobSelection(context);
      break;
      
    case 'job_options':
      await handleJobOptions(context);
      break;
      
    case 'occurrence_selection':
      await handleOccurrenceSelectionDTMF(context);
      break;
      
    case 'no_occurrences_found':
      await handleNoOccurrencesFound(context);
      break;
      
    case 'confirm_datetime':
      await handleDateTimeConfirmation(context);
      break;
      
    case 'workflow_complete':
      await handleWorkflowComplete(context);
      break;
      
    default:
      logger.warn('DTMF received in unhandled phase', {
        phase: callState.phase,
        digit,
        type: 'dtmf_unhandled_phase'
      });
  }
}

/**
 * Handle PIN authentication DTMF
 */
async function handlePinAuthentication(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws } = context;
  
  // Collect PIN digits until # is pressed
  if (digit === '#') {
    // User finished entering PIN
    const pin = parseInt(callState.pinBuffer || '', 10);
    
    if (!pin || callState.pinBuffer.length < 2) {
      await generateAndSpeak('Invalid PIN. Please enter your employee PIN followed by the pound key.');
      return;
    }
    
    logger.info('PIN authentication attempt', {
      pinLength: callState.pinBuffer.length,
      callSid: callState.sid,
      type: 'pin_auth_attempt'
    });
    
    // Authenticate with PIN
    const { authenticateByPhone } = require('../handlers/authentication-handler');
    const { employeeService } = require('../services/airtable');
    
    const authResult = await employeeService.authenticateByPin(pin);
    
    if (authResult.success && authResult.employee) {
      logger.info('PIN authentication successful', {
        employeeId: authResult.employee.id,
        employeeName: authResult.employee.name,
        callSid: callState.sid,
        type: 'pin_auth_success'
      });
      
      // Track successful auth
      if (ws.callEvents) {
        trackCallEvent(ws.callEvents, 'authentication', 'pin_auth_success', {
          employeeId: authResult.employee.id,
          employeeName: authResult.employee.name,
          pin
        });
      }
      
      // Prefetch background data
      const { prefetchBackgroundData } = require('../handlers/authentication-handler');
      const backgroundData = await prefetchBackgroundData(authResult.employee);
      ws.cachedData = {
        ...ws.cachedData,
        ...backgroundData
      };
      
      // Create call log
      const { createCallLog } = require('../services/airtable/call-log-service');
      const providerId = authResult.provider?.id || backgroundData.providers?.providers?.[0]?.id;
      const startedAt = (ws.callStartTime || new Date()).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const callLogResult = await createCallLog({
        callSid: callState.sid,
        employeeId: authResult.employee.id,
        providerId: providerId,
        direction: 'Inbound',
        startedAt
      });
      
      if (callLogResult.success && callLogResult.recordId) {
        ws.callLogRecordId = callLogResult.recordId;
        ws.employeeId = authResult.employee.id;
        ws.providerId = providerId;
      }
      
      // Update state to provider selection
      const updatedState = {
        ...callState,
        phase: 'provider_selection',
        employee: authResult.employee,
        provider: authResult.provider,
        authMethod: 'pin',
        pinBuffer: undefined, // Clear PIN buffer
        updatedAt: new Date().toISOString()
      };
      
      await saveState(updatedState);
      
      // Generate greeting
      const { generateSingleProviderGreeting, generateMultiProviderGreeting } = require('../handlers/provider-handler');
      const providerResult = backgroundData.providers;
      
      if (providerResult.providers?.length === 1) {
        const greeting = generateSingleProviderGreeting(authResult.employee, providerResult.providers[0]);
        await generateAndSpeak(greeting.message);
      } else {
        const greeting = generateMultiProviderGreeting(authResult.employee, providerResult.providers);
        const updatedStateWithProviders = {
          ...updatedState,
          availableProviders: providerResult.providers.map((p: any, index: number) => ({
            ...p,
            selectionNumber: index + 1
          }))
        };
        await saveState(updatedStateWithProviders);
        await generateAndSpeak(greeting);
      }
      
    } else {
      // PIN authentication failed
      const newAttempts = (callState.attempts?.clientId || 0) + 1;
      
      logger.warn('PIN authentication failed', {
        attempt: newAttempts,
        callSid: callState.sid,
        type: 'pin_auth_failed'
      });
      
      // Track failure
      if (ws.callEvents) {
        trackCallEvent(ws.callEvents, 'authentication', 'pin_auth_failed', {
          pin,
          attempt: newAttempts
        });
      }
      
      if (newAttempts >= 3) {
        await generateAndSpeak('I could not find your PIN after several attempts. Please contact your supervisor. Goodbye.');
        return;
      }
      
      // Update state with incremented attempts
      const updatedState = {
        ...callState,
        pinBuffer: '', // Clear PIN buffer
        attempts: {
          ...callState.attempts,
          clientId: newAttempts
        },
        updatedAt: new Date().toISOString()
      };
      
      await saveState(updatedState);
      await generateAndSpeak('I could not find that PIN. Please use your keypad to enter your correct employee PIN followed by the pound key.');
    }
    
  } else {
    // Collect digit
    const currentBuffer = callState.pinBuffer || '';
    const newBuffer = currentBuffer + digit;
    
    logger.info('PIN digit collected', {
      bufferLength: newBuffer.length,
      callSid: callState.sid,
      type: 'pin_digit_collected'
    });
    
    // Update state with new digit
    const updatedState = {
      ...callState,
      pinBuffer: newBuffer,
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
  }
}

/**
 * Handle provider selection DTMF
 */
async function handleProviderSelection(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws } = context;
  
  const selectionNum = parseInt(digit, 10);
  const selectedProvider = callState.availableProviders?.find(
    (p: any) => p.selectionNumber === selectionNum
  );
  
  if (!selectedProvider) {
    await generateAndSpeak('Invalid selection. Please try again.');
    return;
  }
  
  logger.info('Provider selected', {
    providerId: selectedProvider.id,
    providerName: selectedProvider.name,
    type: 'provider_selected'
  });

  // Track event
  if (ws.callEvents) {
    trackCallEvent(ws.callEvents, 'provider_selection', 'provider_selected', {
      providerId: selectedProvider.id,
      providerName: selectedProvider.name
    });
  }
  
  // Filter jobs by selected provider
  const employeeJobs = ws.cachedData?.employeeJobs || [];
  const filteredJobs = filterJobsByProvider(employeeJobs, selectedProvider.id);
  
  // Generate greeting with job list
  const greeting = generateProviderSelectionGreeting(selectedProvider, filteredJobs);
  
  // Update state
  const updatedState = {
    ...callState,
    phase: 'job_selection',
    provider: {
      id: selectedProvider.id,
      name: selectedProvider.name,
      greeting: selectedProvider.greeting
    },
    employeeJobs: filteredJobs.map((job: any, index: number) => ({
      ...job,
      index: index + 1
    })),
    updatedAt: new Date().toISOString()
  };
  
  await saveState(updatedState);
  await generateAndSpeak(greeting.message);
}

/**
 * Handle job selection DTMF
 */
async function handleJobSelection(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState } = context;
  
  const selectionNum = parseInt(digit, 10);
  const jobResult = selectJob(callState.employeeJobs || [], selectionNum);
  
  if (!jobResult.success || !jobResult.job) {
    await generateAndSpeak(jobResult.error || 'Invalid job selection');
    return;
  }
  
  logger.info('Job selected', {
    jobCode: jobResult.job.jobTemplate.jobCode,
    jobTitle: jobResult.job.jobTemplate.title,
    type: 'job_selected'
  });

  // Track event
  const { ws } = context;
  if (ws.callEvents) {
    trackCallEvent(ws.callEvents, 'job_selection', 'job_selected', {
      jobCode: jobResult.job.jobTemplate.jobCode,
      jobTitle: jobResult.job.jobTemplate.title,
      patientName: jobResult.job.patient?.name
    });
  }
  
  // Generate job options message
  const options = generateJobOptionsMessage(jobResult.job);
  
  // Update state
  const updatedState = {
    ...callState,
    phase: 'job_options',
    jobTemplate: jobResult.job.jobTemplate,
    patient: jobResult.job.patient,
    jobCode: jobResult.job.jobTemplate.jobCode,
    updatedAt: new Date().toISOString()
  };
  
  await saveState(updatedState);
  await generateAndSpeak(options.message);
}

/**
 * Handle job options DTMF
 */
async function handleJobOptions(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws, streamSid } = context;
  
  if (digit === '1') {
    // Leave shift open for someone else
    try {
      // Track event
      if (ws.callEvents) {
        trackCallEvent(ws.callEvents, 'job_options', 'leave_open_selected', {
          jobCode: callState.jobTemplate?.jobCode,
          jobTitle: callState.jobTemplate?.title,
          patientName: callState.patient?.name
        });
      }
      
      // Update state to proceed with "leave open" action
      const updatedState = {
        ...callState,
        phase: 'occurrence_selection',
        actionType: 'leave_open',
        selectedOption: '1',
        updatedAt: new Date().toISOString()
      };
      
      await saveState(updatedState);
      await generateAndSpeak('Please wait while I look up your upcoming shifts.');
      
      // Fetch and present occurrences
      setTimeout(async () => {
        await handleOccurrenceSelection(context, updatedState);
      }, 800);
      
    } catch (error) {
      logger.error('Leave open processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'leave_open_error'
      });
      await generateAndSpeak("I'm having trouble processing that option. Please press 2 to connect with a representative.");
    }
  } else if (digit === '2') {
    // Transfer to representative
    await handleTransferToRepresentative(context);
  } else {
    await generateAndSpeak('Invalid selection. Please press 1 to leave this shift open for someone else, or press 2 to connect with a representative.');
  }
}

/**
 * Handle transfer to representative
 */
async function handleTransferToRepresentative(context: DTMFRoutingContext): Promise<void> {
  const { callState, generateAndSpeak, saveState, ws, streamSid } = context;

  // Track event
  if (ws.callEvents) {
    trackCallEvent(ws.callEvents, callState.phase, 'transferred_to_representative', {
      reason: 'user_request',
      fromPhase: callState.phase
    });
  }
  
  // Update state
  const updatedState = {
    ...callState,
    phase: 'representative_transfer',
    selectedOption: '3',
    updatedAt: new Date().toISOString()
  };
  
  await saveState(updatedState);
  await generateAndSpeak('Connecting you to a representative now. Please hold.');
  
  // Reduced delay for faster transfer
  setTimeout(async () => {
    try {
      const transferResult = await handleRepresentativeTransfer({
        callSid: callState.sid,
        callerPhone: callState.employee?.phone || '',
        callerName: callState.employee?.name,
        representativePhone: '+61490550941',
        jobInfo: {
          jobTitle: callState.jobTemplate?.title || 'Unknown Job',
          patientName: callState.patient?.name || 'Unknown Patient'
        }
      });
      
      // If successfully transferred to conference, mark WebSocket to stay open
      if (transferResult.status === 'transferred' && transferResult.conferenceName) {
        ws.inConference = true;
        ws.conferenceName = transferResult.conferenceName;
        logger.info('WebSocket marked for conference mode', {
          callSid: callState.sid,
          conferenceName: transferResult.conferenceName,
          type: 'ws_conference_mode'
        });
      }
      
      // Announce transfer status
      await generateAndSpeak(transferResult.message);
      
          // If enqueued, play hold music
          if (transferResult.status === 'enqueued') {
            setTimeout(() => {
              playHoldMusic(ws);
              
              // Set up periodic queue updates
              ws.queueUpdateInterval = setInterval(async () => {
                const updateMessage = await getQueueUpdateMessage(callState.sid);
                if (updateMessage) {
                  await generateAndSpeak(updateMessage);
                  // Resume hold music after announcement
                  setTimeout(() => {
                    playHoldMusic(ws);
                  }, 3000);
                } else {
                  // Call removed from queue
                  clearInterval(ws.queueUpdateInterval);
                  ws.queueUpdateInterval = undefined;
                }
              }, 30000); // Every 30 seconds
            }, 3000); // Start hold music 3 seconds after queue announcement
          }
        } catch (error) {
          logger.error('Transfer handling error', {
            callSid: callState.sid,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'transfer_handling_error'
          });
          await generateAndSpeak("I'm having trouble connecting you to a representative. Please try again later.");
        }
      }, 500);
}

/**
 * Handle back to job selection
 */
async function handleBackToJobSelection(context: DTMFRoutingContext): Promise<void> {
  const { callState, generateAndSpeak, saveState, ws } = context;
  
  // Get job list from cache
  const employeeJobs = ws.cachedData?.employeeJobs || [];
  
  // Filter jobs by current provider if set
  const filteredJobs = callState.provider?.id 
    ? filterJobsByProvider(employeeJobs, callState.provider.id)
    : employeeJobs;
  
  // Update state with job list (limited to 2 shifts)
  const jobsToPresent = filteredJobs.slice(0, 2);
  const updatedState = {
    ...callState,
    phase: 'job_selection',
    jobCode: null,
    jobTemplate: undefined,
    patient: undefined,
    employeeJobs: jobsToPresent.map((job: any, index: number) => ({
      ...job,
      index: index + 1
    })),
    updatedAt: new Date().toISOString()
  };
  
  await saveState(updatedState);
  
  // Generate job list message with date/time
  let jobListMessage = '';
  if (jobsToPresent.length === 1) {
    const job = jobsToPresent[0];
    const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
    const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
    jobListMessage = `You have one shift: ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. Press 1 to select this shift.`;
  } else {
    jobListMessage = `You have ${jobsToPresent.length} shifts. `;
    jobsToPresent.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
      const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. `;
    });
  }
  
  await generateAndSpeak(jobListMessage);
}

/**
 * Handle occurrence selection - fetch and present occurrences
 */
async function handleOccurrenceSelection(context: DTMFRoutingContext, state: any): Promise<void> {
  const { generateAndSpeak, saveState } = context;
  
  try {
    logger.info('Fetching occurrences for job', {
      jobCode: state.jobCode,
      actionType: state.actionType,
      type: 'occurrence_fetch_start'
    });
    
    // Import occurrence phase
    const { processOccurrenceSelectionPhase } = require('../fsm/phases/occurrence-phase');
    
    // Process occurrence selection with no input to trigger occurrence lookup
    const occurrenceResult = await processOccurrenceSelectionPhase(state, '', false);
    
    logger.info('Occurrence selection processed', {
      action: occurrenceResult.result.action,
      newPhase: occurrenceResult.newState.phase,
      type: 'occurrence_processed'
    });
    
    // Save the new state
    await saveState(occurrenceResult.newState);
    
    // Extract and speak the response
    const { extractResponseText } = require('../utils/text-extractor');
    const responseText = extractResponseText(occurrenceResult.result);
    
    if (responseText) {
      await generateAndSpeak(responseText);
    }
  } catch (error) {
    logger.error('Occurrence selection error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'occurrence_error'
    });
    await generateAndSpeak("I'm having trouble looking up your appointments. Please try again or press 4 to select a different job.");
  }
}

/**
 * Handle occurrence selection DTMF input
 */
async function handleOccurrenceSelectionDTMF(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws } = context;
  
  try {
    logger.info('Processing occurrence selection', {
      digit,
      type: 'occurrence_selection_dtmf'
    });
    
    // Import occurrence phase
    const { processOccurrenceSelectionPhase } = require('../fsm/phases/occurrence-phase');
    const { extractResponseText } = require('../utils/text-extractor');
    
    // Process the selection
    const occurrenceResult = await processOccurrenceSelectionPhase(callState, digit, true);
    
    logger.info('Occurrence selected', {
      action: occurrenceResult.result.action,
      newPhase: occurrenceResult.newState.phase,
      type: 'occurrence_selected'
    });

    // Track event
    if (ws.callEvents) {
      trackCallEvent(ws.callEvents, 'occurrence_selection', 'occurrence_selected', {
        occurrenceId: occurrenceResult.newState.selectedOccurrence?.id,
        date: occurrenceResult.newState.selectedOccurrence?.scheduledAt
      });
    }
    
    // Save the new state
    await saveState(occurrenceResult.newState);
    
    // Check if we need speech collection for date/time
    if (occurrenceResult.newState.phase === 'collect_day' || 
        occurrenceResult.newState.phase === 'collect_time') {
      
      const { startSpeechCollection } = require('../services/speech');
      const { generateInitialPrompt } = require('../services/speech/dialog-responses');
      
      const speechContext = {
        patientName: occurrenceResult.newState.patient?.name || 'the patient',
        appointmentDate: occurrenceResult.newState.selectedOccurrence?.displayDate || 'the appointment',
        jobTitle: occurrenceResult.newState.jobTemplate?.title || 'healthcare service',
        phase: occurrenceResult.newState.phase,
        attemptNumber: 1,
        callSid: callState.sid,
        updateState: async (updates: any) => {
          const updatedState = { ...occurrenceResult.newState, ...updates, updatedAt: new Date().toISOString() };
          await saveState(updatedState);
        }
      };
      
      const prompt = generateInitialPrompt(speechContext);
      
      logger.info('Starting speech collection for date/time', {
        phase: occurrenceResult.newState.phase,
        type: 'speech_collection_triggered'
      });
      
      // Start speech collection
      await startSpeechCollection(ws, prompt, speechContext, generateAndSpeak);
      return; // Don't call generateAndSpeak again
    }
    
    // Extract and speak the response for non-speech phases
    const responseText = extractResponseText(occurrenceResult.result);
    if (responseText) {
      await generateAndSpeak(responseText);
    }
  } catch (error) {
    logger.error('Occurrence selection DTMF error', {
      digit,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'occurrence_dtmf_error'
    });
    await generateAndSpeak("I'm having trouble with your selection. Please try again.");
  }
}

/**
 * Handle no occurrences found - offer representative or go back
 */
async function handleNoOccurrencesFound(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState } = context;
  
  if (digit === '1') {
    // Talk to representative
    logger.info('No occurrences - transferring to representative', {
      callSid: callState.sid,
      type: 'no_occurrences_transfer'
    });
    
    await handleTransferToRepresentative(context);
  } else if (digit === '2') {
    // Go back to job options (not job selection)
    logger.info('No occurrences - going back to job options', {
      callSid: callState.sid,
      type: 'no_occurrences_back_to_options'
    });
    
    // Update state back to job_options phase
    const updatedState = {
      ...callState,
      phase: 'job_options',
      selectedOption: null,
      actionType: null,
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
    
    // Re-present job options
    const jobTitle = callState.jobTemplate?.title || 'this job';
    const patientLastName = callState.patient?.name ? callState.patient.name.split(' ').pop() : 'the patient';
    const optionsMessage = `You selected ${jobTitle} for ${patientLastName}. What would you like to do? Press 1 to reschedule, Press 2 to leave the job open for someone else, Press 3 to talk to a representative, or Press 4 to select a different job.`;
    
    await generateAndSpeak(optionsMessage);
  } else {
    await generateAndSpeak('Invalid selection. Press 1 to talk to a representative, or press 2 to go back.');
  }
}

/**
 * Handle date/time confirmation DTMF
 */
async function handleDateTimeConfirmation(context: DTMFRoutingContext): Promise<void> {
  const { digit, callState, generateAndSpeak, saveState, ws } = context;
  
  logger.info('Handling datetime confirmation', {
    digit,
    callSid: callState.sid,
    type: 'datetime_confirmation'
  });
  
  if (digit === '1') {
    // User confirmed - update Airtable
    const collectedDateTime = (ws as any).collectedDateTime;
    
    if (!collectedDateTime || !collectedDateTime.dateISO || !collectedDateTime.timeISO) {
      await generateAndSpeak("I'm sorry, there was an error. Please try again or press 3 to talk to a representative.");
      return;
    }
    
    if (!callState.selectedOccurrence || !callState.selectedOccurrence.id) {
      await generateAndSpeak("I'm sorry, I couldn't find the appointment to reschedule. Please press 3 to talk to a representative.");
      return;
    }
    
    try {
      // Import and call reschedule service
      const { jobOccurrenceService } = await import('../services/airtable');
      
      await generateAndSpeak("Please wait while I update your appointment.");
      
      const rescheduleResult = await jobOccurrenceService.rescheduleOccurrence(
        callState.selectedOccurrence.id,
        collectedDateTime.dateISO,  // YYYY-MM-DD
        collectedDateTime.timeISO.replace(':', '')  // Convert "10:00" to "1000"
      );
      
      if (rescheduleResult.success) {
        logger.info('Appointment rescheduled successfully', {
          occurrenceId: callState.selectedOccurrence.id,
          newDate: collectedDateTime.dateISO,
          newTime: collectedDateTime.timeISO,
          type: 'reschedule_success'
        });

        // Track event
        if (ws.callEvents) {
          trackCallEvent(ws.callEvents, 'confirm_datetime', 'reschedule_confirmed', {
            occurrenceId: callState.selectedOccurrence.id,
            oldDate: callState.selectedOccurrence.scheduledAt,
            newDate: collectedDateTime.dateISO,
            newTime: collectedDateTime.timeISO,
            displayDateTime: collectedDateTime.displayText
          });
        }
        
        // Update state to workflow_complete
        const updatedState = {
          ...callState,
          phase: 'workflow_complete',
          updatedAt: new Date().toISOString()
        };
        
        await saveState(updatedState);
        
        const oldDate = callState.selectedOccurrence.displayDate || 'your original appointment';
        const newDateTime = collectedDateTime.displayText || `${collectedDateTime.dateISO} at ${collectedDateTime.timeISO}`;
        
        await generateAndSpeak(
          `Great! Your appointment has been rescheduled from ${oldDate} to ${newDateTime}. ` +
          `Would you like to do anything else? Press 1 to select another job, or press 2 to talk to a representative.`
        );
        
      } else {
        logger.error('Appointment reschedule failed', {
          occurrenceId: callState.selectedOccurrence.id,
          error: rescheduleResult.error,
          type: 'reschedule_failed'
        });
        
        await generateAndSpeak(
          "I'm sorry, I couldn't update your appointment in the system. " +
          "Press 1 to try again, or press 2 to talk to a representative who can help you."
        );
      }
      
    } catch (error) {
      logger.error('Error during reschedule', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'reschedule_error'
      });
      
      await generateAndSpeak(
        "I'm sorry, there was a system error. Please press 2 to talk to a representative."
      );
    }
    
  } else if (digit === '2') {
    // User said no - restart speech collection
    logger.info('User rejected datetime, restarting collection', {
      callSid: callState.sid,
      type: 'datetime_rejected'
    });
    
    // Go back to collect_day phase
    const updatedState = {
      ...callState,
      phase: 'collect_day',
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
    
    // Restart speech collection
    const { startSpeechCollection } = require('../services/speech');
    const { generateInitialPrompt } = require('../services/speech/dialog-responses');
    
    const speechContext = {
      phase: 'collect_day',
      attemptNumber: 1,
      callSid: callState.sid,
      updateState: async (updates: any) => {
        const updatedState = { ...callState, ...updates, updatedAt: new Date().toISOString() };
        await saveState(updatedState);
      }
    };
    
    const prompt = generateInitialPrompt(speechContext);
    await startSpeechCollection(ws, prompt, speechContext, generateAndSpeak);
    
  } else {
    await generateAndSpeak('Invalid selection. Press 1 to confirm, or 2 to try again.');
  }
}

/**
 * Handle workflow complete options
 */
async function handleWorkflowComplete(context: DTMFRoutingContext): Promise<void> {
  const { digit, callState, generateAndSpeak, saveState, ws } = context;
  
  logger.info('Handling workflow complete options', {
    digit,
    callSid: callState.sid,
    type: 'workflow_complete_handler'
  });
  
  if (digit === '1') {
    // Go back to job selection
    logger.info('User wants to select another job', {
      callSid: callState.sid,
      type: 'select_another_job'
    });
    
    // Get jobs from cache (stored during initial auth)
    const employeeJobs = (ws as any).cachedData?.employeeJobs || callState.employeeJobs || [];
    
    // Filter by provider if set
    const filteredJobs = callState.provider?.id 
      ? filterJobsByProvider(employeeJobs, callState.provider.id)
      : employeeJobs;
    
    // Limit to 2 shifts
    const jobs = filteredJobs.slice(0, 2);
    
    if (jobs.length === 0) {
      await generateAndSpeak("You don't have any more shifts at the moment. Thank you for calling. Goodbye!");
      return;
    }
    
    // Reset to job_selection phase
    const updatedState = {
      ...callState,
      phase: 'job_selection',
      selectedJob: null,
      selectedOccurrence: null,
      selectedOption: null,
      actionType: null,
      dateTimeInput: null,
      employeeJobs: jobs.map((job: any, index: number) => ({
        ...job,
        index: index + 1
      })),
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
    
    // Present job list with date/time
    let message = `You have ${jobs.length} shift${jobs.length > 1 ? 's' : ''}. `;
    jobs.forEach((job: any, index: number) => {
      const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
      const jobTitle = job.jobTemplate?.title || job.title || 'Job';
      const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
      message += `Press ${index + 1} for ${jobTitle} for ${patientFirstName} at ${shiftDetails}. `;
    });
    
    await generateAndSpeak(message);
    
  } else if (digit === '2') {
    // Transfer to representative
    logger.info('User requested transfer from workflow complete', {
      callSid: callState.sid,
      type: 'transfer_from_complete'
    });
    
    await handleTransferToRepresentative(context);
    
  } else {
    await generateAndSpeak('Invalid selection. Press 1 to select another job, or press 2 to talk to a representative.');
  }
}
