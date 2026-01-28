/**
 * Call Outcome Handler
 * Phase 4: Call Processing & Response Handling
 * 
 * Handles outcomes from outbound calls (accepted, declined, no-answer, etc.)
 */

import { logger } from '../../lib/logger';
import { airtableClient } from '../airtable/client';
import { updateCallLog } from '../airtable/call-log-service';
import { scheduleNextCallAttempt, cancelOutboundCalls } from '../queue/outbound-call-queue';
import { twilioSMSService } from '../sms/twilio-sms-service';
import type { OutboundCallJobData } from '../queue/outbound-call-queue';
import type { JobOccurrenceFields } from '../airtable/types';

/**
 * Handle job acceptance (staff pressed 1)
 */
export async function handleJobAcceptance(
  occurrenceId: string,
  employeeId: string,
  callSid: string,
  callLogRecordId?: string
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  
  logger.info('Processing job acceptance', {
    occurrenceId,
    employeeId,
    callSid,
    type: 'job_acceptance_start'
  });
  
  try {
    // Step 1: Get employee details
    const employee = await airtableClient.getEmployeeById(employeeId);
    
    if (!employee) {
      logger.error('Employee not found during acceptance', {
        occurrenceId,
        employeeId,
        type: 'acceptance_employee_not_found'
      });
      return { success: false, error: 'Employee not found' };
    }
    
    const employeeName = employee.fields['Display Name'] || 'Unknown Employee';
    const employeePhone = employee.fields['Phone'] || '';
    
    // Step 2: Check if job is still open (race condition protection)
    const jobOccurrence = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!jobOccurrence) {
      logger.error('Job occurrence not found during acceptance', {
        occurrenceId,
        employeeId,
        type: 'acceptance_job_not_found'
      });
      return { success: false, error: 'Job occurrence not found' };
    }
    
    const currentStatus = jobOccurrence.fields['Status'];
    
    if (currentStatus !== 'Open' && currentStatus !== 'UNFILLED_AFTER_SMS') {
      logger.warn('Job already assigned to someone else', {
        occurrenceId,
        employeeId,
        currentStatus,
        type: 'acceptance_job_already_taken'
      });
      return { success: false, error: 'Job already assigned' };
    }
    
    // Step 3: Assign job to employee
    const updates: Partial<JobOccurrenceFields> = {
      'Status': 'Scheduled',
      'Assigned Employee': [employeeId],
    };
    
    const updateSuccess = await airtableClient.updateJobOccurrence(occurrenceId, updates);
    
    if (!updateSuccess) {
      logger.error('Failed to assign job to employee', {
        occurrenceId,
        employeeId,
        type: 'acceptance_assignment_failed'
      });
      return { success: false, error: 'Failed to assign job' };
    }
    
    logger.info('Job assigned successfully', {
      occurrenceId,
      employeeId,
      employeeName,
      type: 'job_assigned'
    });
    
    // Step 4: Cancel all remaining outbound calls
    try {
      const cancelResult = await cancelOutboundCalls(occurrenceId);
      logger.info('Cancelled remaining outbound calls', {
        occurrenceId,
        cancelledCount: cancelResult.cancelled,
        type: 'outbound_calls_cancelled'
      });
    } catch (error) {
      logger.warn('Failed to cancel remaining calls (non-critical)', {
        occurrenceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'cancel_calls_warning'
      });
    }
    
    // Step 5: Update call log with successful outcome
    if (callLogRecordId) {
      try {
        await updateCallLog(callLogRecordId, {
          endedAt: new Date().toISOString(),
          seconds: Math.round((Date.now() - startTime) / 1000),
          callOutcome: 'Accepted',
          dtmfResponse: '1',
          relatedOccurrenceId: occurrenceId,
          notes: `Job accepted via outbound call - assigned to ${employeeName}`,
          rawPayload: JSON.stringify({ action: 'accepted', employeeId, occurrenceId }),
        });
      } catch (error) {
        logger.warn('Failed to update call log', {
          callLogRecordId,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'call_log_update_warning'
        });
      }
    }
    
    // Step 6: Send confirmation SMS
    if (employeePhone) {
      try {
        const jobDetails = jobOccurrence.fields;
        const confirmationMessage = `JOB ASSIGNED: You accepted ${jobDetails['Occurrence ID']} via phone call. Scheduled for ${jobDetails['Scheduled At']} at ${jobDetails['Time']}. Check the system for full details.`;
        
        await twilioSMSService.sendSMS(
          employeePhone,
          confirmationMessage,
          { employeeId, occurrenceId }
        );
        
        logger.info('Confirmation SMS sent', {
          occurrenceId,
          employeeId,
          type: 'confirmation_sms_sent'
        });
      } catch (error) {
        logger.warn('Failed to send confirmation SMS (non-critical)', {
          occurrenceId,
          employeeId,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'confirmation_sms_warning'
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Job acceptance processed successfully', {
      occurrenceId,
      employeeId,
      employeeName,
      duration,
      type: 'job_acceptance_complete'
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error('Job acceptance processing error', {
      occurrenceId,
      employeeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'job_acceptance_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Handle job decline (staff pressed 2)
 */
export async function handleJobDecline(
  jobData: OutboundCallJobData,
  employeeId: string,
  callSid: string,
  callLogRecordId?: string
): Promise<{ success: boolean; nextCallScheduled: boolean; error?: string }> {
  const { occurrenceId } = jobData;
  
  logger.info('Processing job decline', {
    occurrenceId,
    employeeId,
    callSid,
    type: 'job_decline_start'
  });
  
  try {
    // Step 1: Update call log with decline outcome
    if (callLogRecordId) {
      try {
        await updateCallLog(callLogRecordId, {
          endedAt: new Date().toISOString(),
          seconds: 10, // Approximate (actual duration tracked by Twilio)
          callOutcome: 'Declined',
          dtmfResponse: '2',
          relatedOccurrenceId: occurrenceId,
          notes: 'Staff member declined shift via outbound call',
          rawPayload: JSON.stringify({ action: 'declined', employeeId, occurrenceId }),
        });
      } catch (error) {
        logger.warn('Failed to update call log for decline', {
          callLogRecordId,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'call_log_decline_warning'
        });
      }
    }
    
    // Step 2: Schedule next call attempt
    const nextJob = await scheduleNextCallAttempt(jobData);
    
    if (nextJob) {
      logger.info('Next call attempt scheduled after decline', {
        occurrenceId,
        employeeId,
        nextJobId: nextJob.id,
        type: 'next_call_scheduled_after_decline'
      });
      
      return { success: true, nextCallScheduled: true };
    } else {
      logger.info('All rounds completed after decline', {
        occurrenceId,
        employeeId,
        type: 'all_rounds_complete_after_decline'
      });
      
      // Mark job as UNFILLED_AFTER_CALLS
      await markJobAsUnfilled(occurrenceId, jobData);
      
      return { success: true, nextCallScheduled: false };
    }
    
  } catch (error) {
    logger.error('Job decline processing error', {
      occurrenceId,
      employeeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'job_decline_error'
    });
    
    return {
      success: false,
      nextCallScheduled: false,
      error: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Handle no answer or timeout
 */
export async function handleNoAnswer(
  jobData: OutboundCallJobData,
  employeeId: string,
  callSid: string,
  callLogRecordId?: string
): Promise<{ success: boolean; nextCallScheduled: boolean; error?: string }> {
  const { occurrenceId } = jobData;
  
  logger.info('Processing no answer', {
    occurrenceId,
    employeeId,
    callSid,
    type: 'no_answer_start'
  });
  
  try {
    // Step 1: Update call log with no-answer outcome
    if (callLogRecordId) {
      try {
        await updateCallLog(callLogRecordId, {
          endedAt: new Date().toISOString(),
          seconds: 30, // Approximate timeout duration
          callOutcome: 'No Answer',
          relatedOccurrenceId: occurrenceId,
          notes: 'No answer from staff member on outbound call',
          rawPayload: JSON.stringify({ action: 'no_answer', employeeId, occurrenceId }),
        });
      } catch (error) {
        logger.warn('Failed to update call log for no-answer', {
          callLogRecordId,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'call_log_no_answer_warning'
        });
      }
    }
    
    // Step 2: Schedule next call attempt
    const nextJob = await scheduleNextCallAttempt(jobData);
    
    if (nextJob) {
      logger.info('Next call attempt scheduled after no-answer', {
        occurrenceId,
        employeeId,
        nextJobId: nextJob.id,
        type: 'next_call_scheduled_after_no_answer'
      });
      
      return { success: true, nextCallScheduled: true };
    } else {
      logger.info('All rounds completed after no-answer', {
        occurrenceId,
        employeeId,
        type: 'all_rounds_complete_after_no_answer'
      });
      
      // Mark job as UNFILLED_AFTER_CALLS
      await markJobAsUnfilled(occurrenceId, jobData);
      
      return { success: true, nextCallScheduled: false };
    }
    
  } catch (error) {
    logger.error('No answer processing error', {
      occurrenceId,
      employeeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'no_answer_error'
    });
    
    return {
      success: false,
      nextCallScheduled: false,
      error: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Mark job as UNFILLED_AFTER_CALLS when all rounds are exhausted
 */
async function markJobAsUnfilled(
  occurrenceId: string,
  jobData: OutboundCallJobData
): Promise<void> {
  try {
    const totalAttempts = Object.values(jobData.callAttemptsByStaff).reduce((sum, count) => sum + count, 0);
    const uniqueStaffCalled = Object.keys(jobData.callAttemptsByStaff).length;
    
    logger.warn('Marking job as UNFILLED_AFTER_CALLS', {
      occurrenceId,
      totalAttempts,
      uniqueStaffCalled,
      maxRounds: jobData.maxRounds,
      staffPoolSize: jobData.staffPoolIds.length,
      type: 'marking_unfilled_after_calls'
    });
    
    const updates: Partial<JobOccurrenceFields> = {
      'Status': 'UNFILLED_AFTER_CALLS',
      'Reschedule Reason': `No response after ${jobData.maxRounds} rounds of calling (${totalAttempts} total calls to ${uniqueStaffCalled} staff members).`,
    };
    
    const success = await airtableClient.updateJobOccurrence(occurrenceId, updates);
    
    if (success) {
      logger.info('Job marked as UNFILLED_AFTER_CALLS', {
        occurrenceId,
        totalAttempts,
        uniqueStaffCalled,
        type: 'unfilled_after_calls_marked'
      });
    } else {
      logger.error('Failed to mark job as UNFILLED_AFTER_CALLS', {
        occurrenceId,
        type: 'unfilled_mark_failed'
      });
    }
    
  } catch (error) {
    logger.error('Error marking job as unfilled', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'unfilled_mark_error'
    });
  }
}
