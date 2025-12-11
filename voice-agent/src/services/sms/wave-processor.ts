/**
 * Wave Processor
 * Handles execution of scheduled SMS waves
 */

import { logger } from '../../lib/logger';
import { airtableClient } from '../airtable/client';
import { jobNotificationService } from './job-notification-service';
import { twilioSMSService } from './twilio-sms-service';
import type { WaveJobData } from '../queue/sms-wave-queue';
import type { JobNotificationDetails } from './job-notification-service';

/**
 * Process a scheduled wave
 * This function is called by the Bull queue worker when a wave job is due
 */
export async function processScheduledWave(waveJob: WaveJobData): Promise<void> {
  const { occurrenceId, waveNumber, providerId, jobDetails, scheduledAt } = waveJob;
  
  logger.info(`Processing wave ${waveNumber}`, {
    occurrenceId,
    waveNumber,
    providerId,
    type: 'wave_processing_start'
  });

  try {
    // Step 1: Check if job is still open in Airtable
    const jobOccurrence = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!jobOccurrence) {
      logger.warn('Job occurrence not found, skipping wave', {
        occurrenceId,
        waveNumber,
        type: 'wave_job_not_found'
      });
      return;
    }
    
    const jobStatus = jobOccurrence.fields['Status'];
    
    if (jobStatus !== 'Open') {
      logger.info('Job no longer open, skipping wave', {
        occurrenceId,
        waveNumber,
        currentStatus: jobStatus,
        type: 'wave_job_not_open'
      });
      return;
    }

    logger.info('Job still open, proceeding with wave', {
      occurrenceId,
      waveNumber,
      type: 'wave_job_still_open'
    });

    // Step 2: Get all employees for this provider
    const employees = await jobNotificationService.findProviderEmployees(providerId);
    
    if (employees.length === 0) {
      logger.warn('No employees found for provider', {
        occurrenceId,
        waveNumber,
        providerId,
        type: 'wave_no_employees'
      });
      return;
    }

    logger.info(`Found ${employees.length} employees for wave ${waveNumber}`, {
      occurrenceId,
      waveNumber,
      employeeCount: employees.length,
      type: 'wave_employees_found'
    });

    // Step 3: Generate SMS content with privacy-safe format
    const { getBaseUrl } = await import('../../config/base-url');
    const baseUrl = getBaseUrl();
    
    // Send SMS to each employee
    const smsPromises = employees.map(async (employee) => {
      const jobUrl = `${baseUrl}/job/${occurrenceId}?emp=${employee.id}`;
      
      // Privacy-safe format: FirstName LastInitial
      const privacyName = formatPrivacyName(jobDetails.patientFullName);
      
      // Extract date and time from jobDetails
      const shortDate = formatDateForSMS(scheduledAt);
      const shortTime = extractTimeFromDisplay(jobDetails.displayDate);
      
      const smsContent = `JOB AVAILABLE (Wave ${waveNumber}): ${privacyName}, ${shortDate} ${shortTime}. Reply or view: ${jobUrl}`;
      
      return twilioSMSService.sendSMS(
        employee.phone,
        smsContent,
        { occurrenceId, employeeId: employee.id, waveNumber }
      );
    });

    const results = await Promise.all(smsPromises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info(`Wave ${waveNumber} sent`, {
      occurrenceId,
      waveNumber,
      totalEmployees: employees.length,
      successCount,
      failureCount,
      type: 'wave_sent'
    });

    // Step 4: If this is wave 3 and job is still open, mark as UNFILLED
    if (waveNumber === 3) {
      logger.info('Wave 3 complete, checking if job still open for UNFILLED status', {
        occurrenceId,
        type: 'wave_3_complete_check'
      });

      // Small delay to allow any pending assignments to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Re-check job status
      const finalCheck = await airtableClient.getJobOccurrenceById(occurrenceId);
      
      if (finalCheck && finalCheck.fields['Status'] === 'Open') {
        logger.warn('Job still open after wave 3, marking as UNFILLED_AFTER_SMS', {
          occurrenceId,
          type: 'marking_unfilled'
        });

        const updated = await airtableClient.updateJobOccurrence(occurrenceId, {
          Status: 'UNFILLED_AFTER_SMS',
          'Reschedule Reason': `Job left open - No response after 3 SMS waves. Original reason: ${finalCheck.fields['Reschedule Reason'] || 'Not provided'}`,
        });

        if (updated) {
          logger.info('Job marked as UNFILLED_AFTER_SMS', {
            occurrenceId,
            type: 'unfilled_marked'
          });
        } else {
          logger.error('Failed to mark job as UNFILLED_AFTER_SMS', {
            occurrenceId,
            type: 'unfilled_mark_failed'
          });
        }
      } else {
        logger.info('Job was assigned before UNFILLED check', {
          occurrenceId,
          currentStatus: finalCheck?.fields['Status'],
          type: 'job_assigned_before_unfilled'
        });
      }
    }

  } catch (error) {
    logger.error(`Wave ${waveNumber} processing error`, {
      occurrenceId,
      waveNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'wave_processing_error'
    });
    throw error; // Re-throw to let Bull retry
  }
}

/**
 * Format patient name for privacy: FirstName LastInitial
 */
function formatPrivacyName(fullName: string): string {
  if (!fullName) return 'Patient';
  
  const parts = fullName.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0];
  }
  
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  
  return `${firstName} ${lastInitial}.`;
}

/**
 * Format date for SMS (short format)
 */
function formatDateForSMS(dateString: string): string {
  if (!dateString) return 'TBD';
  
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-AU', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch (error) {
    return 'TBD';
  }
}

/**
 * Extract time from display date string
 */
function extractTimeFromDisplay(displayDate: string): string {
  if (!displayDate) return 'TBD';
  
  // Try to extract time from "September 9th at 4:30 PM" format
  const timeMatch = displayDate.match(/(\d{1,2}:\d{2}\s?(AM|PM))/i);
  if (timeMatch) {
    return timeMatch[0];
  }
  
  return 'TBD';
}
