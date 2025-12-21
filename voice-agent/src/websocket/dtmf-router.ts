/**
 * DTMF Router
 * Routes DTMF input to appropriate phase handlers
 */

import { logger } from '../lib/logger';
import { selectJob, generateJobOptionsMessage, filterJobsByProvider } from '../handlers/job-handler';
import { generateProviderSelectionGreeting, generateOccurrenceBasedGreeting } from '../handlers/provider-handler';
import { getQueueUpdateMessage } from '../handlers/transfer-handler';
import { generateSpeech, streamAudioToTwilio } from '../services/elevenlabs';
import { stopRecordingAndProcess, isRecording } from '../services/speech';
import { trackCallEvent } from '../services/airtable/call-log-service';
import { WebSocketWithExtensions } from './connection-handler';
import { paginateOccurrences, validateOccurrenceSelection, generateOccurrenceListPrompt } from '../handlers/occurrence-pagination';
import { jobNotificationService } from '../services/sms/job-notification-service';

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
      greeting: selectedProvider.greeting,
      transferNumber: selectedProvider.transferNumber
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
 * Handle job options DTMF (SIMPLIFIED FLOW)
 * NEW: Only 2 options: 1=leave open, 2=representative
 */
async function handleJobOptions(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws } = context;
  
  if (digit === '1') {
    // Leave this shift open for someone else
    logger.info('User selected to leave shift open', {
      callSid: callState.sid,
      occurrenceId: callState.selectedOccurrence?.occurrenceId,
      type: 'leave_shift_open'
    });
    
    // Track event
    if (ws.callEvents) {
      trackCallEvent(ws.callEvents, 'job_options', 'leave_open_selected', {
        occurrenceId: callState.selectedOccurrence?.occurrenceId,
        patientFirstName: callState.selectedOccurrence?.patient?.firstName
      });
    }
    
    try {
      // Import leave open service
      const { jobOccurrenceService } = await import('../services/airtable');
      
      await generateAndSpeak("Please wait while I update this shift.");
      
      // Leave job open in Airtable
      const result = await jobOccurrenceService.leaveJobOpen(
        callState.selectedOccurrence?.occurrenceRecordId,
        callState.employee?.id,
        'Worker called to leave shift open via voice system'
      );
      
      if (result.success) {
        logger.info('Shift left open successfully', {
          occurrenceId: callState.selectedOccurrence?.occurrenceId,
          type: 'leave_open_success'
        });
        
        // Trigger instant job redistribution (non-blocking)
        try {
          // Get provider ID from enriched occurrences or cached data
          const providerId = callState.provider?.id || (ws as any).cachedData?.providers?.providers?.[0]?.id;
          
          if (providerId) {
            // Build full objects for notification service
            const fullJobTemplate = {
              id: callState.selectedOccurrence?.jobTemplate?.id || '',
              jobCode: callState.selectedOccurrence?.jobTemplate?.jobCode || '',
              title: callState.selectedOccurrence?.jobTemplate?.title || 'Healthcare Service',
              serviceType: 'Healthcare',
              priority: 'Normal',
              patientId: callState.selectedOccurrence?.patient?.id || '',
              providerId: providerId,
              defaultEmployeeId: '',
              uniqueJobNumber: 0,
              occurrenceIds: [],
              active: true,
            };
            
            const fullJobOccurrence = {
              id: callState.selectedOccurrence?.occurrenceRecordId || '',
              occurrenceId: callState.selectedOccurrence?.occurrenceId || '',
              jobTemplateId: callState.selectedOccurrence?.jobTemplate?.id || '',
              scheduledAt: callState.selectedOccurrence?.scheduledAt || '',
              time: callState.selectedOccurrence?.time || '',
              status: 'Open',
              assignedEmployeeId: '',
              occurrenceLabel: callState.selectedOccurrence?.occurrenceId || '',
              providerId: providerId,
              patientId: callState.selectedOccurrence?.patient?.id || '',
              displayDate: callState.selectedOccurrence?.displayDateTime || '',
            };
            
            const fullPatient = {
              id: callState.selectedOccurrence?.patient?.id || '',
              name: callState.selectedOccurrence?.patient?.fullName || 'Unknown Patient',
              patientId: 0,
              phone: '',
              dateOfBirth: '',
              providerId: providerId,
              active: true,
            };
            
            // Trigger redistribution without waiting (non-blocking)
            jobNotificationService.processInstantJobRedistribution(
              fullJobOccurrence,
              fullJobTemplate,
              fullPatient,
              'Worker called to leave shift open via voice system',
              callState.employee
            ).then(redistributionResult => {
              logger.info('Job redistribution complete', {
                occurrenceId: callState.selectedOccurrence?.occurrenceId,
                employeesNotified: redistributionResult.employeesNotified,
                success: redistributionResult.success,
                type: 'redistribution_background_complete'
              });
            }).catch(redistributionError => {
              logger.error('Job redistribution failed (non-critical)', {
                occurrenceId: callState.selectedOccurrence?.occurrenceId,
                error: redistributionError instanceof Error ? redistributionError.message : 'Unknown error',
                type: 'redistribution_background_error'
              });
            });
            
            logger.info('Job redistribution triggered in background', {
              occurrenceId: callState.selectedOccurrence?.occurrenceId,
              providerId: providerId,
              type: 'redistribution_triggered'
            });
          } else {
            logger.warn('Cannot trigger redistribution: provider ID not found', {
              occurrenceId: callState.selectedOccurrence?.occurrenceId,
              type: 'redistribution_no_provider'
            });
          }
        } catch (notificationError) {
          // Log error but don't fail the call
          logger.error('Failed to trigger job redistribution (non-critical)', {
            occurrenceId: callState.selectedOccurrence?.occurrenceId,
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            type: 'redistribution_trigger_error'
          });
        }
        
        // Update state to workflow_complete
        const updatedState = {
          ...callState,
          phase: 'workflow_complete',
          updatedAt: new Date().toISOString()
        };
        
        await saveState(updatedState);
        
        const patientFirstName = callState.selectedOccurrence?.patient?.firstName || 'the patient';
        const displayDateTime = callState.selectedOccurrence?.displayDateTime || 'the shift';
        
        await generateAndSpeak(
          `Done! Your shift with ${patientFirstName} at ${displayDateTime} has been left open. ` +
          `Your team members are being notified now. ` +
          `Is there anything else? Press 1 to handle another shift, or press 2 to end this call.`
        );
      } else {
        logger.error('Failed to leave shift open', {
          occurrenceId: callState.selectedOccurrence?.occurrenceId,
          error: result.error,
          type: 'leave_open_failed'
        });
        
        await generateAndSpeak(
          "I'm sorry, I couldn't update the shift in the system. " +
          "Press 1 to try again, or press 2 to talk to a representative."
        );
      }
    } catch (error) {
      logger.error('Error leaving shift open', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'leave_open_error'
      });
      
      await generateAndSpeak(
        "I'm sorry, there was a system error. Press 2 to talk to a representative."
      );
    }
    
  } else if (digit === '2') {
    // Connect with representative
    await handleTransferToRepresentative(context);
    
  } else {
    // Invalid selection
    await generateAndSpeak('Invalid selection. Press 1 to leave this shift open, or press 2 to connect with a representative.');
  }
  
  // OLD FLOW (commented out - had reschedule option):
  /*
  if (digit === '1') {
    // Reschedule option (removed per client feedback)
  } else if (digit === '2') {
    // Leave open
  } else if (digit === '3') {
    // Representative
  } else if (digit === '4') {
    // Different job
  }
  */
}

/**
 * Handle transfer to representative
 * Uses Twilio action URL pattern - DO NOT close WebSocket until after update
 */
async function handleTransferToRepresentative(context: DTMFRoutingContext): Promise<void> {
  const { callState, generateAndSpeak, saveState, ws } = context;

  // Track event
  if (ws.callEvents) {
    trackCallEvent(ws.callEvents, callState.phase, 'transferred_to_representative', {
      reason: 'user_request',
      fromPhase: callState.phase
    });
  }
  
  // Get transfer number from provider, with fallbacks
  const transferNumber = callState.provider?.transferNumber 
    || process.env.REPRESENTATIVE_PHONE 
    || '+61490550941';
  
  const transferNumberSource = callState.provider?.transferNumber 
    ? 'provider' 
    : (process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default');
  
  const callerPhone = callState.employee?.phone || callState.from || 'Unknown';
  
  // Use parent CallSid for REST API operations (the original call leg)
  const parentCallSid = callState.parentCallSid || callState.sid;
  
  logger.info('Transfer number resolved', {
    transferNumber,
    source: transferNumberSource,
    providerName: callState.provider?.name,
    type: 'transfer_number_resolved'
  });
  
  logger.info('Initiating representative transfer', {
    callSid: callState.sid,
    parentCallSid: parentCallSid,
    representativePhone: transferNumber,
    callerPhone,
    type: 'transfer_start'
  });
  
  // Announce transfer
  await generateAndSpeak('Transferring you to a representative now. Please hold.');
  
  // CORRECT APPROACH per Twilio documentation:
  // You CANNOT update a call via REST API while a Media Stream is active
  // Instead:
  // 1. Set pendingTransfer in call state
  // 2. Close the WebSocket
  // 3. Twilio will call the action URL on <Connect>
  // 4. The action URL handler will see pendingTransfer and return <Dial> TwiML
  
  logger.info('Setting pending transfer and closing WebSocket', {
    callSid: callState.sid,
    parentCallSid: parentCallSid,
    representativePhone: transferNumber,
    type: 'transfer_via_action_url'
  });
  
  // Save state with pending transfer
  const transferState = {
    ...callState,
    phase: 'representative_transfer',
    pendingTransfer: {
      representativePhone: transferNumber,
      callerPhone: callerPhone,
      initiatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };
  
  await saveState(transferState);
  
  logger.info('Transfer state saved, closing WebSocket to trigger action URL', {
    callSid: callState.sid,
    type: 'transfer_closing_ws_for_action'
  });
  
  // Close WebSocket - this will cause Twilio to call the action URL
  if (ws.readyState === 1) {
    ws.close(1000, 'Transfer to representative');
  }
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
  
  // Update state with job list
  const updatedState = {
    ...callState,
    phase: 'job_selection',
    jobCode: null,
    jobTemplate: undefined,
    patient: undefined,
    employeeJobs: filteredJobs.map((job: any, index: number) => ({
      ...job,
      index: index + 1
    })),
    updatedAt: new Date().toISOString()
  };
  
  await saveState(updatedState);
  
  // Generate job list message
  let jobListMessage = '';
  if (filteredJobs.length === 1) {
    const job = filteredJobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    jobListMessage = `You have one job: ${job.jobTemplate.title} for ${patientLastName}. Press 1 to select this job.`;
  } else {
    jobListMessage = `You have ${filteredJobs.length} jobs. `;
    filteredJobs.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
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
 * Handle occurrence selection DTMF input (NEW FLOW - with pagination)
 */
async function handleOccurrenceSelectionDTMF(context: DTMFRoutingContext): Promise<void> {
  const { callState, digit, generateAndSpeak, saveState, ws } = context;
  
  try {
    logger.info('Processing occurrence selection', {
      digit,
      currentPage: callState.currentPage || 1,
      type: 'occurrence_selection_dtmf'
    });
    
    const enrichedOccurrences = callState.enrichedOccurrences || [];
    const currentPage = callState.currentPage || 1;
    
    // Paginate occurrences
    const paginationResult = paginateOccurrences(enrichedOccurrences, currentPage);
    
    // Validate selection
    const selectionIndex = validateOccurrenceSelection(
      digit,
      paginationResult.pageItems.length,
      paginationResult.hasNextPage
    );
    
    if (selectionIndex === null) {
      // Invalid selection
      await generateAndSpeak(`Invalid selection. Please press a number from 1 to ${paginationResult.pageItems.length}.`);
      return;
    }
    
    if (selectionIndex === -1) {
      // "More" option - go to next page
      const nextPage = currentPage + 1;
      const nextPaginationResult = paginateOccurrences(enrichedOccurrences, nextPage);
      
      logger.info('Moving to next page', {
        nextPage,
        itemsOnPage: nextPaginationResult.pageItems.length,
        type: 'occurrence_pagination_next'
      });
      
      // Update state with new page
      const updatedState = {
        ...callState,
        currentPage: nextPage,
        updatedAt: new Date().toISOString()
      };
      
      await saveState(updatedState);
      
      // Generate prompt for next page
      const nextPagePrompt = generateOccurrenceListPrompt(
        nextPaginationResult.pageItems,
        nextPaginationResult.currentPage,
        nextPaginationResult.hasNextPage
      );
      
      await generateAndSpeak(nextPagePrompt);
      return;
    }
    
    // Valid occurrence selection
    const selectedOccurrence = paginationResult.pageItems[selectionIndex];
    
    logger.info('Occurrence selected', {
      occurrenceId: selectedOccurrence.occurrenceId,
      patientFirstName: selectedOccurrence.patient.firstName,
      displayDateTime: selectedOccurrence.displayDateTime,
      type: 'occurrence_selected'
    });

    // Track event
    if (ws.callEvents) {
      trackCallEvent(ws.callEvents, 'occurrence_selection', 'occurrence_selected', {
        occurrenceId: selectedOccurrence.occurrenceId,
        occurrenceRecordId: selectedOccurrence.occurrenceRecordId,
        scheduledAt: selectedOccurrence.scheduledAt,
        patientFirstName: selectedOccurrence.patient.firstName
      });
    }
    
    // Update state with selected occurrence and move to job_options phase
    const updatedState = {
      ...callState,
      phase: 'job_options',
      selectedOccurrence: selectedOccurrence,
      jobTemplate: selectedOccurrence.jobTemplate,
      patient: selectedOccurrence.patient,
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
    
    // Generate simplified options message
    const optionsMessage = generateJobOptionsMessage(selectedOccurrence);
    await generateAndSpeak(optionsMessage.message);
    
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
  } else if (digit === '2' && callState.selectedOccurrence) {
    // Go back to job options (only valid if we have a selected occurrence/job to go back to)
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
    if (callState.selectedOccurrence) {
    await generateAndSpeak('Invalid selection. Press 1 to talk to a representative, or press 2 to go back.');
    } else {
      await generateAndSpeak('Invalid selection. Press 1 to talk to a representative.');
    }
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
 * Handle workflow complete options (NEW FLOW - occurrence based)
 */
async function handleWorkflowComplete(context: DTMFRoutingContext): Promise<void> {
  const { digit, callState, generateAndSpeak, saveState, ws } = context;
  
  logger.info('Handling workflow complete options', {
    digit,
    callSid: callState.sid,
    type: 'workflow_complete_handler'
  });
  
  if (digit === '1') {
    // Handle another shift
    logger.info('User wants to handle another shift', {
      callSid: callState.sid,
      type: 'handle_another_shift'
    });
    
    // Get enriched occurrences from cache
    const enrichedOccurrences = (ws as any).cachedData?.enrichedOccurrences || callState.enrichedOccurrences || [];
    
    if (enrichedOccurrences.length === 0) {
      await generateAndSpeak("You don't have any more shifts scheduled. Thank you for calling. Goodbye!");
      return;
    }
    
    // Reset to occurrence_selection phase
    const updatedState = {
      ...callState,
      phase: 'occurrence_selection',
      selectedOccurrence: null,
      selectedOption: null,
      currentPage: 1,
      updatedAt: new Date().toISOString()
    };
    
    await saveState(updatedState);
    
    // Generate occurrence list for page 1
    const paginationResult = paginateOccurrences(enrichedOccurrences, 1);
    const occurrencePrompt = generateOccurrenceListPrompt(
      paginationResult.pageItems,
      paginationResult.currentPage,
      paginationResult.hasNextPage
    );
    
    await generateAndSpeak(occurrencePrompt);
    
  } else if (digit === '2') {
    // End call
    logger.info('User ending call', {
      callSid: callState.sid,
      type: 'call_end_requested'
    });
    
    await generateAndSpeak("Thank you for calling. Have a great day! Goodbye.");
    // The call will naturally end
    
  } else {
    await generateAndSpeak('Invalid selection. Press 1 to handle another shift, or press 2 to end this call.');
  }
}
