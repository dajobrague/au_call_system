/**
 * Outbound Call Processor
 * Phase 4: Call Processing & Response Handling
 * 
 * Core logic for making outbound calls and processing responses
 */

import { logger } from '../../lib/logger';
import { airtableClient } from '../airtable/client';
import { twilioConfig } from '../../config/twilio';
import { generateOutboundCallAudio } from './audio-pregenerator';
import { generateTwiMLUrl } from './twiml-generator';
import { createCallLog } from '../airtable/call-log-service';
import type { OutboundCallJobData } from '../queue/outbound-call-queue';
import { scheduleNextCallAttempt } from '../queue/outbound-call-queue';
const twilio = require('twilio');

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

/**
 * Process an outbound call job
 * This is the main entry point called by the worker
 */
export async function processOutboundCall(jobData: OutboundCallJobData): Promise<void> {
  const { 
    occurrenceId, 
    staffPoolIds, 
    currentStaffIndex, 
    currentRound, 
    jobDetails 
  } = jobData;
  
  const staffId = staffPoolIds[currentStaffIndex];
  
  logger.info('Processing outbound call', {
    occurrenceId,
    staffId,
    currentRound,
    currentStaffIndex,
    staffPoolSize: staffPoolIds.length,
    type: 'outbound_call_processing'
  });
  
  try {
    // Step 1: Check if job is still open
    const jobStatus = await checkJobStatus(occurrenceId);
    
    if (!jobStatus.isOpen) {
      logger.info('Job no longer open, skipping call', {
        occurrenceId,
        staffId,
        currentStatus: jobStatus.status,
        type: 'outbound_call_job_not_open'
      });
      return; // Don't schedule next call if job is assigned
    }
    
    // Step 2: Get employee details
    const employee = await airtableClient.getEmployeeById(staffId);
    
    if (!employee) {
      logger.error('Employee not found', {
        occurrenceId,
        staffId,
        type: 'outbound_call_employee_not_found'
      });
      
      // Schedule next call (skip this employee)
      await scheduleNextCallAttempt(jobData);
      return;
    }
    
    const employeePhone = employee.fields['Phone'];
    const employeeName = employee.fields['Display Name'] || 'there';
    
    if (!employeePhone) {
      logger.error('Employee has no phone number', {
        occurrenceId,
        staffId,
        employeeName,
        type: 'outbound_call_no_phone'
      });
      
      // Schedule next call (skip this employee)
      await scheduleNextCallAttempt(jobData);
      return;
    }
    
    logger.info('Employee details retrieved', {
      occurrenceId,
      staffId,
      employeeName,
      employeePhone,
      type: 'outbound_call_employee_found'
    });
    
    // Step 3: Generate personalized audio
    const callId = `${occurrenceId}-r${currentRound}-s${currentStaffIndex}`;
    
    const audioResult = await generateOutboundCallAudio(
      jobDetails.messageTemplate,
      {
        employeeName: employeeName.split(' ')[0], // First name only
        patientName: jobDetails.patientName,
        date: jobDetails.displayDate,
        time: jobDetails.startTime,
        startTime: jobDetails.startTime,
        endTime: jobDetails.endTime,
        suburb: jobDetails.suburb,
      },
      callId
    );
    
    if (!audioResult.success || !audioResult.audioUrl) {
      logger.error('Audio generation failed', {
        occurrenceId,
        staffId,
        error: audioResult.error,
        type: 'outbound_call_audio_failed'
      });
      
      // Schedule next call (skip this attempt)
      await scheduleNextCallAttempt(jobData);
      return;
    }
    
    logger.info('Audio generated successfully', {
      occurrenceId,
      staffId,
      callId,
      audioUrl: audioResult.audioUrl,
      type: 'outbound_call_audio_generated'
    });
    
    // Step 4: Create Call Log record
    const callLogResult = await createCallLog({
      callSid: 'pending', // Will be updated when Twilio call is created
      providerId: jobData.providerId,
      employeeId: staffId,
      direction: 'Outbound',
      startedAt: new Date().toISOString(),
      callPurpose: 'Outbound Job Offer',
      attemptRound: currentRound,
    });
    
    if (!callLogResult.success || !callLogResult.recordId) {
      logger.warn('Failed to create call log (continuing anyway)', {
        occurrenceId,
        staffId,
        error: callLogResult.error,
        type: 'outbound_call_log_warning'
      });
    }
    
    // Step 5: Generate TwiML URL
    const twimlUrl = generateTwiMLUrl(callId, occurrenceId, staffId, currentRound);
    
    // Step 6: Initiate Twilio call
    const { getBaseUrl } = await import('../../config/base-url');
    const baseUrl = getBaseUrl();
    
    logger.info('Initiating Twilio call', {
      occurrenceId,
      staffId,
      employeePhone,
      callId,
      twimlUrl,
      type: 'outbound_call_twilio_start'
    });
    
    const call = await twilioClient.calls.create({
      to: employeePhone,
      from: twilioConfig.phoneNumber,
      url: twimlUrl,
      method: 'POST',
      statusCallback: `${baseUrl}/api/outbound/status?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=${staffId}&round=${currentRound}`,
      statusCallbackEvent: ['answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30, // Ring for 30 seconds
      // Store metadata for tracking
      machineDetection: 'Enable', // Detect voicemail
      machineDetectionTimeout: 5000, // 5 seconds
    });
    
    logger.info('Twilio call initiated', {
      occurrenceId,
      staffId,
      callId,
      callSid: call.sid,
      to: call.to,
      status: call.status,
      type: 'outbound_call_initiated'
    });
    
    // Update call log with actual CallSid
    if (callLogResult.recordId) {
      try {
        await airtableClient.updateRecord(
          'tbl9BBKoeV45juYaj', // Call Logs table
          callLogResult.recordId,
          { 'CallSid': call.sid }
        );
      } catch (error) {
        logger.warn('Failed to update call log with CallSid', {
          callLogRecordId: callLogResult.recordId,
          callSid: call.sid,
          type: 'outbound_call_log_update_warning'
        });
      }
    }
    
    // Track this attempt
    if (!jobData.callAttemptsByStaff[staffId]) {
      jobData.callAttemptsByStaff[staffId] = 0;
    }
    jobData.callAttemptsByStaff[staffId]++;
    
    logger.info('Outbound call processing complete', {
      occurrenceId,
      staffId,
      callId,
      callSid: call.sid,
      attemptNumber: jobData.callAttemptsByStaff[staffId],
      type: 'outbound_call_complete'
    });
    
    // Note: Next call scheduling is handled by response/status webhooks
    // If declined or no-answer, the webhook will call scheduleNextCallAttempt()
    
  } catch (error) {
    logger.error('Outbound call processing error', {
      occurrenceId,
      staffId,
      currentRound,
      currentStaffIndex,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_call_error'
    });
    
    // Schedule next call on error
    try {
      await scheduleNextCallAttempt(jobData);
    } catch (scheduleError) {
      logger.error('Failed to schedule next call after error', {
        occurrenceId,
        scheduleError: scheduleError instanceof Error ? scheduleError.message : 'Unknown error',
        type: 'outbound_call_schedule_error'
      });
    }
    
    throw error; // Re-throw to let Bull handle retries
  }
}

/**
 * Check if job occurrence is still open
 */
async function checkJobStatus(occurrenceId: string): Promise<{ isOpen: boolean; status: string }> {
  try {
    const jobOccurrence = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!jobOccurrence) {
      logger.warn('Job occurrence not found', {
        occurrenceId,
        type: 'job_status_not_found'
      });
      return { isOpen: false, status: 'Not Found' };
    }
    
    const status = jobOccurrence.fields['Status'];
    const isOpen = status === 'Open' || status === 'UNFILLED_AFTER_SMS';
    
    logger.info('Job status checked', {
      occurrenceId,
      status,
      isOpen,
      type: 'job_status_checked'
    });
    
    return { isOpen, status };
    
  } catch (error) {
    logger.error('Job status check error', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'job_status_check_error'
    });
    
    // Assume job is not open on error (safer)
    return { isOpen: false, status: 'Error' };
  }
}
