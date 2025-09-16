/**
 * Job Occurrence Service
 * Handles job occurrence lookup, scheduling, and management
 */

import { airtableClient } from './client';
import { logger } from '../../lib/logger';
import type { 
  JobOccurrence, 
  JobOccurrenceRecord,
  JobOccurrenceFields,
  Employee,
  JobTemplate
} from './types';

/**
 * Transform Airtable job occurrence record to our JobOccurrence type
 */
function transformJobOccurrenceRecord(record: JobOccurrenceRecord): JobOccurrence {
  const fields = record.fields;
  
  // Parse the scheduled date and create display format
  const scheduledAt = fields['Scheduled At'] || '';
  const time = fields['Time'] || '';
  
  // Create display format with date and time
  const displayDate = formatDateTimeForVoice(scheduledAt, time);
  
  return {
    id: record.id,
    occurrenceId: fields['Occurrence ID'] || '',
    jobTemplateId: fields['Job Template']?.[0] || '', // First job template ID
    scheduledAt,
    status: fields['Status'] || 'Unknown',
    assignedEmployeeId: fields['Assigned Employee']?.[0] || '', // First employee ID
    occurrenceLabel: fields['Occurrence Label'] || '',
    providerId: fields['Provider']?.[0] || '', // First provider ID
    patientId: fields['Patient']?.[0] || '', // First patient ID
    displayDate,
  };
}

/**
 * Format date and time for voice output
 * Converts "2025-09-15" + "19:30" to "September 15th at 7:30 PM"
 */
function formatDateTimeForVoice(dateString: string, timeString: string): string {
  const datePart = formatDateForVoice(dateString);
  
  if (!timeString) {
    return datePart;
  }
  
  // Convert HH:MM to voice format
  const timePart = formatTimeStringForVoice(timeString);
  
  return `${datePart} at ${timePart}`;
}

/**
 * Format time string for voice output
 * Converts "19:30" to "7:30 PM"
 */
function formatTimeStringForVoice(timeString: string): string {
  if (!timeString || !timeString.includes(':')) {
    return timeString;
  }
  
  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  if (isNaN(hour) || isNaN(minute)) {
    return timeString;
  }
  
  if (hour === 0) {
    // Midnight
    return minute === 0 ? 'midnight' : `12:${minute.toString().padStart(2, '0')} AM`;
  } else if (hour < 12) {
    // AM
    return minute === 0 ? `${hour} AM` : `${hour}:${minute.toString().padStart(2, '0')} AM`;
  } else if (hour === 12) {
    // Noon
    return minute === 0 ? 'noon' : `12:${minute.toString().padStart(2, '0')} PM`;
  } else {
    // PM
    const hour12 = hour - 12;
    return minute === 0 ? `${hour12} PM` : `${hour12}:${minute.toString().padStart(2, '0')} PM`;
  }
}

/**
 * Format date string for voice output
 * Converts "2025-09-15" to "September 15th"
 */
function formatDateForVoice(dateString: string): string {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    
    // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const ordinalSuffix = getOrdinalSuffix(day);
    
    return `${month} ${day}${ordinalSuffix}`;
  } catch (error) {
    logger.error('Date formatting error', {
      dateString,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'date_format_error'
    });
    return 'Unknown date';
  }
}

/**
 * Get ordinal suffix for day numbers
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Job Occurrence lookup result
 */
export interface OccurrenceLookupResult {
  success: boolean;
  occurrences: JobOccurrence[];
  error?: string;
  hasNoFutureOccurrences?: boolean;
}

/**
 * Job Occurrence Service Class
 */
export class JobOccurrenceService {
  /**
   * Get future occurrences for a job template assigned to an employee
   * Uses the Job Template's Occurrences field for efficiency
   */
  async getFutureOccurrences(jobTemplate: JobTemplate, employeeId: string): Promise<OccurrenceLookupResult> {
    const startTime = Date.now();
    
    logger.info('Future occurrences lookup via job template', {
      jobTemplateId: jobTemplate.id,
      jobCode: jobTemplate.jobCode,
      employeeId,
      occurrenceIds: jobTemplate.occurrenceIds,
      type: 'occurrence_lookup_start'
    });

    try {
      if (!jobTemplate.occurrenceIds || jobTemplate.occurrenceIds.length === 0) {
        logger.info('No occurrences linked to job template', {
          jobTemplateId: jobTemplate.id,
          jobCode: jobTemplate.jobCode,
          duration: Date.now() - startTime,
          type: 'occurrence_lookup_empty'
        });
        
        return {
          success: true,
          occurrences: [],
          hasNoFutureOccurrences: true
        };
      }
      
      // Fetch all occurrences linked to this job template
      const occurrencePromises = jobTemplate.occurrenceIds.map(occurrenceId => 
        airtableClient.getJobOccurrenceById(occurrenceId)
      );
      
      const occurrenceRecords = await Promise.all(occurrencePromises);
      
      // Filter for valid records
      const validRecords = occurrenceRecords.filter(record => record !== null) as JobOccurrenceRecord[];
      
      // Transform to our format
      const allOccurrences = validRecords.map(transformJobOccurrenceRecord);
      
      // Filter for future occurrences assigned to this employee with "Scheduled" status
      const today = new Date().toISOString().split('T')[0];
      const futureOccurrences = allOccurrences.filter(occurrence => {
        const isScheduled = occurrence.status === 'Scheduled';
        const isFuture = occurrence.scheduledAt >= today;
        const isAssignedToEmployee = occurrence.assignedEmployeeId === employeeId;
        
        return isScheduled && isFuture && isAssignedToEmployee;
      });
      
      // Sort by scheduled date (earliest first) and limit to 3
      futureOccurrences.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      const limitedOccurrences = futureOccurrences.slice(0, 3);
      
      const duration = Date.now() - startTime;
      
      if (limitedOccurrences.length === 0) {
        logger.info('No future occurrences found after filtering', {
          jobTemplateId: jobTemplate.id,
          jobCode: jobTemplate.jobCode,
          employeeId,
          totalOccurrences: allOccurrences.length,
          futureOccurrences: futureOccurrences.length,
          duration,
          type: 'occurrence_lookup_empty_filtered'
        });
        
        return {
          success: true,
          occurrences: [],
          hasNoFutureOccurrences: true
        };
      }
      
      logger.info('Future occurrences found via job template', {
        jobTemplateId: jobTemplate.id,
        jobCode: jobTemplate.jobCode,
        employeeId,
        totalOccurrences: allOccurrences.length,
        futureOccurrences: futureOccurrences.length,
        limitedCount: limitedOccurrences.length,
        dates: limitedOccurrences.map(o => o.scheduledAt),
        duration,
        type: 'occurrence_lookup_success'
      });
      
      return {
        success: true,
        occurrences: limitedOccurrences
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Future occurrences lookup error', {
        jobTemplateId: jobTemplate.id,
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'occurrence_lookup_error'
      });
      
      return {
        success: false,
        occurrences: [],
        error: 'System error during occurrence lookup'
      };
    }
  }

  /**
   * Generate dynamic occurrence selection message
   */
  generateOccurrenceSelectionMessage(
    occurrences: JobOccurrence[], 
    actionType: 'reschedule' | 'leave_open'
  ): string {
    if (occurrences.length === 0) {
      return `No upcoming appointments found for this job. Would you like to schedule one? Press 1 for yes, or 2 to speak with a representative.`;
    }
    
    const actionText = actionType === 'reschedule' ? 'reschedule' : 'leave open';
    
    if (occurrences.length === 1) {
      return `I found 1 upcoming appointment to ${actionText}. Press 1 for ${occurrences[0].displayDate}.`;
    } else if (occurrences.length === 2) {
      return `I found 2 upcoming appointments to ${actionText}. Press 1 for ${occurrences[0].displayDate}, Press 2 for ${occurrences[1].displayDate}.`;
    } else if (occurrences.length === 3) {
      return `I found 3 upcoming appointments to ${actionType}. Press 1 for ${occurrences[0].displayDate}, Press 2 for ${occurrences[1].displayDate}, Press 3 for ${occurrences[2].displayDate}.`;
    }
    
    return `Please select an appointment to ${actionText}.`;
  }

  /**
   * Validate occurrence selection
   */
  validateOccurrenceSelection(occurrences: JobOccurrence[], selection: string): JobOccurrence | null {
    const selectionNum = parseInt(selection, 10);
    
    if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > occurrences.length) {
      return null;
    }
    
    return occurrences[selectionNum - 1]; // Convert 1-based to 0-based index
  }

  /**
   * Update job occurrence date and time in Airtable
   */
  async rescheduleOccurrence(
    occurrenceId: string, 
    newDate: string, 
    newTime: string
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    
    logger.info('Rescheduling job occurrence', {
      occurrenceId,
      newDate,
      newTime,
      type: 'occurrence_reschedule_start'
    });

    try {
      // Convert military time to HH:MM format for Airtable
      const formattedTime = this.formatTimeForAirtable(newTime);
      
      // Update both Scheduled At and Time fields
      const updates = {
        'Scheduled At': newDate,  // YYYY-MM-DD format
        'Time': formattedTime     // HH:MM format for single select
      };
      
      const success = await airtableClient.updateJobOccurrence(occurrenceId, updates);
      
      const duration = Date.now() - startTime;
      
      if (success) {
        logger.info('Job occurrence rescheduled successfully', {
          occurrenceId,
          newDate,
          newTime,
          formattedTime,
          duration,
          type: 'occurrence_reschedule_success'
        });
        
        return { success: true };
      } else {
        logger.error('Job occurrence reschedule failed', {
          occurrenceId,
          newDate,
          newTime,
          duration,
          type: 'occurrence_reschedule_failed'
        });
        
        return { success: false, error: 'Failed to update appointment in system' };
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job occurrence reschedule error', {
        occurrenceId,
        newDate,
        newTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'occurrence_reschedule_error'
      });
      
      return { success: false, error: 'System error during appointment update' };
    }
  }

  /**
   * Convert military time (HHMM) to HH:MM format for Airtable
   */
  private formatTimeForAirtable(militaryTime: string): string {
    if (militaryTime.length === 4) {
      // HHMM -> HH:MM
      return `${militaryTime.substring(0, 2)}:${militaryTime.substring(2, 4)}`;
    } else if (militaryTime.length === 2) {
      // HH -> HH:00
      return `${militaryTime}:00`;
    }
    
    return militaryTime; // Return as-is if already formatted
  }

  /**
   * Update job occurrence status in Airtable
   */
  async updateOccurrenceStatus(occurrenceId: string, newStatus: string): Promise<boolean> {
    try {
      const updates = {
        'Status': newStatus
      };
      
      const success = await airtableClient.updateJobOccurrence(occurrenceId, updates);
      
      logger.info('Job occurrence status update', {
        occurrenceId,
        newStatus,
        success,
        type: 'occurrence_status_update'
      });
      
      return success;
    } catch (error) {
      logger.error('Job occurrence status update error', {
        occurrenceId,
        newStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'occurrence_status_update_error'
      });
      
      return false;
    }
  }

  /**
   * Leave job open - remove employee assignment and change status to "Open"
   */
  async leaveJobOpen(
    occurrenceId: string, 
    employeeId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    
    logger.info('Leaving job open', {
      occurrenceId,
      employeeId,
      type: 'leave_job_open_start'
    });

    try {
      // Update Status, remove Assigned Employee, and add reason if provided
      const updates: Partial<JobOccurrenceFields> = {
        'Status': 'Open',           // Change status to Open
        'Assigned Employee': []     // Remove all assigned employees (empty array)
      };
      
      // Add reason if provided
      if (reason) {
        updates['Reschedule Reason'] = reason;
      }
      
      const success = await airtableClient.updateJobOccurrence(occurrenceId, updates);
      
      const duration = Date.now() - startTime;
      
      if (success) {
        logger.info('Job left open successfully', {
          occurrenceId,
          employeeId,
          duration,
          type: 'leave_job_open_success'
        });
        
        return { success: true };
      } else {
        logger.error('Failed to leave job open', {
          occurrenceId,
          employeeId,
          duration,
          type: 'leave_job_open_failed'
        });
        
        return { success: false, error: 'Failed to update job in system' };
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Leave job open error', {
        occurrenceId,
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'leave_job_open_error'
      });
      
      return { success: false, error: 'System error during job update' };
    }
  }

  /**
   * Remove employee assignment from job occurrence (legacy function)
   */
  async removeEmployeeAssignment(occurrenceId: string, employeeId: string): Promise<boolean> {
    // Use the new leaveJobOpen function
    const result = await this.leaveJobOpen(occurrenceId, employeeId);
    return result.success;
  }

  /**
   * Send reschedule confirmation SMS to employee
   */
  async sendRescheduleConfirmationSMS(
    employeePhone: string,
    employeeName: string,
    oldDateTime: string,
    newDateTime: string,
    patientName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import Twilio SMS service
      const { twilioSMSService } = await import('../sms/twilio-sms-service');
      
      // Create short reschedule confirmation SMS (under 160 characters)
      const shortMessage = `RESCHEDULED: ${patientName} moved to ${newDateTime}. Confirmation sent. - Healthcare Services`;
      
      logger.info('Sending reschedule confirmation SMS', {
        employeePhone,
        employeeName,
        oldDateTime,
        newDateTime,
        patientName,
        messageLength: shortMessage.length,
        type: 'reschedule_sms_start'
      });
      
      // Send SMS
      const smsResult = await twilioSMSService.sendSMS(
        employeePhone,
        shortMessage,
        { type: 'reschedule_confirmation', employeeName }
      );
      
      if (smsResult.success) {
        logger.info('Reschedule confirmation SMS sent successfully', {
          employeePhone,
          employeeName,
          messageSid: smsResult.messageSid,
          type: 'reschedule_sms_success'
        });
        
        return { success: true };
      } else {
        logger.error('Reschedule confirmation SMS failed', {
          employeePhone,
          employeeName,
          error: smsResult.error,
          type: 'reschedule_sms_failed'
        });
        
        return { success: false, error: smsResult.error };
      }
      
    } catch (error) {
      logger.error('Reschedule confirmation SMS error', {
        employeePhone,
        employeeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'reschedule_sms_error'
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'SMS sending error' 
      };
    }
  }

  /**
   * Health check for job occurrence service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test a simple occurrence lookup
      const today = new Date().toISOString().split('T')[0];
      
      // Try to query occurrences for today or future
      const testQuery = await airtableClient.findFutureOccurrences('test', 'test');
      
      return {
        healthy: true,
        message: 'Job occurrence service healthy',
        details: {
          testQuery: 'completed',
          today
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Job occurrence service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const jobOccurrenceService = new JobOccurrenceService();
