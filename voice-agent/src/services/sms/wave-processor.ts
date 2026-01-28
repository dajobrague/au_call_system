/**
 * Wave Processor
 * Handles execution of scheduled SMS waves
 */

import { logger } from '../../lib/logger';
import { airtableClient } from '../airtable/client';
import { jobNotificationService } from './job-notification-service';
import { twilioSMSService } from './twilio-sms-service';
import { scheduleOutboundCallAfterSMS } from '../queue/outbound-call-queue';
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

    // Step 2: Get all employees for this provider (excluding the one who left job open)
    const excludeEmployeeId = waveJob.excludeEmployeeId;
    const allEmployees = await jobNotificationService.findProviderEmployees(providerId, excludeEmployeeId);
    
    // Filter to staff pool only
    const staffPoolIds = waveJob.staffPoolIds || [];
    const employees = staffPoolIds.length > 0
      ? allEmployees.filter(emp => staffPoolIds.includes(emp.id))
      : [];
    
    if (employees.length === 0) {
      logger.warn('No staff pool employees found for wave', {
        occurrenceId,
        waveNumber,
        providerId,
        excludeEmployeeId,
        totalProviderEmployees: allEmployees.length,
        staffPoolSize: staffPoolIds.length,
        type: 'wave_no_staff_pool_employees'
      });
      return;
    }

    logger.info(`Found ${employees.length} staff pool employees for wave ${waveNumber}`, {
      occurrenceId,
      waveNumber,
      excludeEmployeeId,
      totalProviderEmployees: allEmployees.length,
      staffPoolEmployeeCount: employees.length,
      employeeNames: employees.map(e => e.name),
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
      
      // Extract date and times (use 24-hour format)
      const shortDate = formatDateForSMS(scheduledAt);
      const startTime = jobDetails.startTime || extract24HourTimeFromDisplay(jobDetails.displayDate);
      const endTime = jobDetails.endTime || '';
      const suburb = jobDetails.suburb || '';
      
      // Build time range string in 24-hour format
      const timeRange = endTime ? `${startTime}-${endTime}` : startTime;
      
      // Build SMS content - different for wave 3
      let smsContent: string;
      if (waveNumber === 3) {
        // URGENT message for wave 3
        smsContent = `URGENT: No cover found. ${privacyName}, ${shortDate} ${timeRange}${suburb ? `, ${suburb}` : ''}. Click link to pick up shift: ${jobUrl}`;
      } else {
        // Regular message for waves 1 and 2
        smsContent = `SHIFT AVAILABLE (Wave ${waveNumber}): ${privacyName}, ${shortDate} ${timeRange}${suburb ? `, ${suburb}` : ''}. Reply or view: ${jobUrl}`;
      }
      
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
        
        // Phase 5: Check if outbound calling is enabled for this provider
        try {
          const providerRecord = await airtableClient.getProviderById(providerId);
          
          if (!providerRecord) {
            logger.warn('Provider not found for outbound calling check', {
              occurrenceId,
              providerId,
              type: 'provider_not_found_outbound'
            });
            return;
          }
          
          const providerFields = providerRecord.fields;
          const outboundEnabled = providerFields['Outbound Call Enabled'] || false;
          
          if (outboundEnabled) {
            const waitMinutes = providerFields['Outbound Call Wait Minutes'] || 15;
            const maxRounds = providerFields['Outbound Call Max Rounds'] || 3;
            const messageTemplate = providerFields['Outbound Call Message Template'] || '';
            
            logger.info('Outbound calling enabled for provider, scheduling calls', {
              occurrenceId,
              providerId,
              waitMinutes,
              maxRounds,
              type: 'outbound_calling_scheduling'
            });
            
            // Schedule outbound calls after configured wait time
            const scheduledJob = await scheduleOutboundCallAfterSMS(
              occurrenceId,
              waitMinutes,
              {
                occurrenceId,
                providerId,
                staffPoolIds,
                maxRounds,
                jobDetails: {
                  patientName: jobDetails.patientFullName,
                  patientFirstName: formatPrivacyName(jobDetails.patientFullName).split(' ')[0],
                  patientLastInitial: formatPrivacyName(jobDetails.patientFullName).split(' ')[1]?.replace('.', '') || '',
                  scheduledDate: scheduledAt,
                  displayDate: formatDateForSMS(scheduledAt),
                  startTime: jobDetails.startTime || extract24HourTimeFromDisplay(jobDetails.displayDate),
                  endTime: jobDetails.endTime,
                  suburb: jobDetails.suburb,
                  messageTemplate
                }
              }
            );
            
            logger.info('Outbound calls scheduled successfully', {
              occurrenceId,
              providerId,
              staffPoolSize: staffPoolIds.length,
              scheduledJobId: scheduledJob.id,
              delayMinutes: waitMinutes,
              type: 'outbound_calls_scheduled'
            });
          } else {
            logger.info('Outbound calling not enabled for provider', {
              occurrenceId,
              providerId,
              enabled: outboundEnabled,
              type: 'outbound_calling_not_enabled'
            });
          }
        } catch (outboundError) {
          logger.error('Error checking/scheduling outbound calls', {
            occurrenceId,
            providerId,
            error: outboundError instanceof Error ? outboundError.message : 'Unknown error',
            type: 'outbound_calling_error'
          });
          // Don't throw - this is a non-critical enhancement
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
 * Extract time from display date string and convert to 24-hour format
 */
function extract24HourTimeFromDisplay(displayDate: string): string {
  if (!displayDate) return '09:00';
  
  // Try to extract time from "September 9th at 4:30 PM" format
  const timeMatch = displayDate.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const period = timeMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  return '09:00';
}
