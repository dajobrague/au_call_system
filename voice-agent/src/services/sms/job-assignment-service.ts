/**
 * Job Assignment Service
 * Handles SMS responses and job assignment logic
 */

import { airtableClient } from '../airtable/client';
import { twilioSMSService } from './twilio-sms-service';
import { cancelOutboundCalls } from '../queue/outbound-call-queue';
import { logger } from '../../lib/logger';
import { normalizePhoneNumber } from '../../utils/phone-formatter';
import type { EmployeeRecord, JobOccurrenceRecord, JobOccurrenceFields } from '../airtable/types';

/**
 * Job acceptance result
 */
export interface JobAcceptanceResult {
  success: boolean;
  assigned?: boolean;
  alreadyTaken?: boolean;
  employeeName?: string;
  error?: string;
}

/**
 * Handle job acceptance SMS response
 */
export async function handleJobAcceptance(
  fromPhone: string,
  messageSid: string
): Promise<JobAcceptanceResult> {
  const startTime = Date.now();
  const normalizedPhone = normalizePhoneNumber(fromPhone);
  
  logger.info('Processing job acceptance', {
    fromPhone: normalizedPhone,
    messageSid,
    type: 'job_acceptance_start'
  });

  try {
    // Step 1: Find employee by phone number
    const employeeRecord = await airtableClient.findEmployeeByPhone(normalizedPhone);
    
    if (!employeeRecord) {
      logger.warn('Job acceptance from unknown phone number', {
        fromPhone: normalizedPhone,
        messageSid,
        type: 'job_acceptance_unknown_employee'
      });
      
      // Send response to unknown number
      await twilioSMSService.sendSMS(
        normalizedPhone,
        'Phone number not found in our system. Please contact your supervisor.'
      );
      
      return {
        success: false,
        error: 'Employee not found'
      };
    }
    
    const employee = {
      id: employeeRecord.id,
      name: employeeRecord.fields['Display Name'] || 'Unknown Employee',
      pin: employeeRecord.fields['Employee PIN'] || 0,
      phone: employeeRecord.fields['Phone'] || '',
      providerId: employeeRecord.fields['Provider']?.[0] || ''
    };
    
    logger.info('Employee identified for job acceptance', {
      employeeId: employee.id,
      employeeName: employee.name,
      employeePin: employee.pin,
      providerId: employee.providerId,
      type: 'job_acceptance_employee_identified'
    });

    // Step 2: Find open job occurrences for this provider
    const openJobs = await findOpenJobsForProvider(employee.providerId);
    
    if (openJobs.length === 0) {
      logger.info('No open jobs available for employee response', {
        employeeId: employee.id,
        providerId: employee.providerId,
        type: 'job_acceptance_no_open_jobs'
      });
      
      // Send response - no jobs available
      await twilioSMSService.sendSMS(
        normalizedPhone,
        'No jobs are currently available for assignment. Thank you for your response.',
        { employeeId: employee.id }
      );
      
      return {
        success: true,
        assigned: false,
        error: 'No open jobs available'
      };
    }

    // Step 3: Assign first available job to this employee
    const jobToAssign = openJobs[0]; // First come, first served
    
    const assignmentResult = await assignJobToEmployee(jobToAssign.id, employee);
    
    const duration = Date.now() - startTime;
    
    if (assignmentResult.success) {
      logger.info('Job assigned successfully', {
        employeeId: employee.id,
        employeeName: employee.name,
        occurrenceId: jobToAssign.id,
        jobCode: jobToAssign.fields['Occurrence ID'],
        duration,
        type: 'job_assignment_success'
      });
      
      // Send confirmation SMS
      const confirmationMessage = `JOB ASSIGNED: You have been assigned to ${jobToAssign.fields['Occurrence ID']} on ${jobToAssign.fields['Scheduled At']} at ${jobToAssign.fields['Time']}. Check the system for full details.`;
      
      await twilioSMSService.sendSMS(
        normalizedPhone,
        confirmationMessage,
        { employeeId: employee.id, occurrenceId: jobToAssign.id }
      );
      
      return {
        success: true,
        assigned: true,
        employeeName: employee.name
      };
      
    } else if (assignmentResult.alreadyTaken) {
      logger.info('Job already taken by another employee', {
        employeeId: employee.id,
        employeeName: employee.name,
        occurrenceId: jobToAssign.id,
        duration,
        type: 'job_already_taken'
      });
      
      // Send "job no longer available" message
      await twilioSMSService.sendSMS(
        normalizedPhone,
        'Job no longer available - another team member has already accepted it. Thank you for your quick response!',
        { employeeId: employee.id }
      );
      
      return {
        success: true,
        assigned: false,
        alreadyTaken: true,
        employeeName: employee.name
      };
      
    } else {
      logger.error('Job assignment failed', {
        employeeId: employee.id,
        occurrenceId: jobToAssign.id,
        error: assignmentResult.error,
        duration,
        type: 'job_assignment_failed'
      });
      
      // Send error message
      await twilioSMSService.sendSMS(
        normalizedPhone,
        'System error assigning job. Please contact your supervisor.',
        { employeeId: employee.id }
      );
      
      return {
        success: false,
        error: assignmentResult.error || 'Assignment failed'
      };
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Job acceptance processing error', {
      fromPhone: normalizedPhone,
      messageSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'job_acceptance_processing_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Find open job occurrences for a provider
 */
async function findOpenJobsForProvider(providerId: string): Promise<JobOccurrenceRecord[]> {
  try {
    // Query for open jobs for this provider
    // For now, we'll use a simple approach - this would need a proper Airtable query
    
    logger.info('Finding open jobs for provider', {
      providerId,
      type: 'open_jobs_lookup'
    });
    
    // TODO: Implement proper Airtable query for open jobs
    // This would require a new method in airtableClient
    
    return []; // Return empty for now - will be implemented
    
  } catch (error) {
    logger.error('Open jobs lookup error', {
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'open_jobs_lookup_error'
    });
    
    return [];
  }
}

/**
 * Assign job to employee
 */
async function assignJobToEmployee(
  occurrenceId: string, 
  employee: { id: string; name: string; pin: number }
): Promise<{ success: boolean; alreadyTaken?: boolean; error?: string }> {
  try {
    logger.info('Assigning job to employee', {
      occurrenceId,
      employeeId: employee.id,
      employeeName: employee.name,
      type: 'job_assignment_start'
    });

    // Check if job is still open (race condition protection)
    const currentJob = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!currentJob) {
      return { success: false, error: 'Job occurrence not found' };
    }
    
    if (currentJob.fields['Status'] !== 'Open' && currentJob.fields['Status'] !== 'UNFILLED_AFTER_SMS') {
      logger.info('Job no longer open', {
        occurrenceId,
        currentStatus: currentJob.fields['Status'],
        type: 'job_no_longer_open'
      });
      
      return { success: false, alreadyTaken: true };
    }
    
    // Assign job to employee
    const updates: Partial<JobOccurrenceFields> = {
      'Status': 'Scheduled',
      'Assigned Employee': [employee.id] // Assign to this employee
    };
    
    const updateSuccess = await airtableClient.updateJobOccurrence(occurrenceId, updates);
    
    if (updateSuccess) {
      logger.info('Job assigned successfully', {
        occurrenceId,
        employeeId: employee.id,
        employeeName: employee.name,
        type: 'job_assignment_complete'
      });
      
      // Phase 5: Cancel any pending outbound calls for this job
      try {
        const cancelResult = await cancelOutboundCalls(occurrenceId);
        
        if (cancelResult.cancelled > 0) {
          logger.info('Cancelled outbound calls after SMS assignment', {
            occurrenceId,
            employeeId: employee.id,
            cancelledCount: cancelResult.cancelled,
            type: 'outbound_calls_cancelled_after_sms'
          });
        } else {
          logger.info('No outbound calls to cancel', {
            occurrenceId,
            employeeId: employee.id,
            type: 'no_outbound_calls_to_cancel'
          });
        }
      } catch (cancelError) {
        logger.warn('Error cancelling outbound calls (non-critical)', {
          occurrenceId,
          employeeId: employee.id,
          error: cancelError instanceof Error ? cancelError.message : 'Unknown error',
          type: 'outbound_cancel_error'
        });
        // Don't fail the assignment if cancel fails
      }
      
      return { success: true };
    } else {
      return { success: false, error: 'Failed to update job assignment' };
    }
    
  } catch (error) {
    logger.error('Job assignment error', {
      occurrenceId,
      employeeId: employee.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'job_assignment_error'
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Assignment error' 
    };
  }
}
