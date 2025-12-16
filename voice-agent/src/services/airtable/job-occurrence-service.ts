/**
 * Job Occurrence Service
 * Handles job occurrence lookup, scheduling, and management
 */

import { airtableClient } from './client';
import { airtableConfig } from '../../config/airtable';
import https from 'https';
import { logger } from '../../lib/logger';
import type { 
  JobOccurrence, 
  JobOccurrenceRecord,
  JobOccurrenceFields,
  Employee,
  JobTemplate,
  AirtableResponse
} from './types';

/**
 * Transform Airtable job occurrence record to our JobOccurrence type
 */
function transformJobOccurrenceRecord(record: JobOccurrenceRecord): JobOccurrence {
  const fields = record.fields;
  
  // Parse the scheduled date and time
  const scheduledAt = fields['Scheduled At'] || '';
  const time = fields['Time'] || '00:00'; // Default to midnight if not set
  
  // Create display format with date and time
  const displayDate = formatDateTimeForVoice(scheduledAt, time);
  
  return {
    id: record.id,
    occurrenceId: fields['Occurrence ID'] || '',
    jobTemplateId: fields['Job Template']?.[0] || '', // First job template ID
    scheduledAt,
    time, // Include the time field from Airtable
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
 * Format date relative to today for voice output
 * Returns "today", "tomorrow", day name, or full date
 */
function formatRelativeDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString + 'T00:00:00'); // Parse as local date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Same day
    if (daysDiff === 0) {
      return 'today';
    }
    
    // Tomorrow
    if (daysDiff === 1) {
      return 'tomorrow';
    }
    
    // Within 7 days - use day name
    if (daysDiff > 1 && daysDiff <= 7) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return dayNames[date.getDay()];
    }
    
    // Beyond 7 days - use full date
    return formatDateForVoice(dateString);
  } catch (error) {
    return dateString;
  }
}

/**
 * Format date and time together for voice output
 * e.g., "4:00 PM today" or "8:30 AM tomorrow"
 */
function formatDateTimeForGreeting(dateString: string, timeString: string): string {
  const relativeDate = formatRelativeDate(dateString);
  const formattedTime = formatTimeStringForVoice(timeString);
  
  return `${formattedTime} ${relativeDate}`;
}

/**
 * Extract first name from full name
 */
function extractFirstName(fullName: string): string {
  if (!fullName) return 'the patient';
  const parts = fullName.trim().split(' ');
  return parts[0] || 'the patient';
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
 * Enriched occurrence with job and patient details for greeting
 */
export interface EnrichedOccurrence {
  occurrenceId: string;
  occurrenceRecordId: string;
  jobTemplate: {
    id: string;
    jobCode: string;
    title: string;
  };
  patient: {
    id: string;
    fullName: string;
    firstName: string;
  };
  scheduledAt: string;  // YYYY-MM-DD
  time: string;         // HH:MM
  displayDateTime: string;  // "4:00 PM today" or "8:00 AM tomorrow"
  status: string;
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
   * Get all employee occurrences enriched with job and patient details
   * Fetches occurrences for all employee jobs and flattens into single list
   * If no jobs are found, fetches occurrences directly from Job Occurrences table
   * @param employeeJobs - Array of { jobTemplate, patient } objects
   * @param employeeId - Employee ID for filtering
   * @returns Flat array of enriched occurrences sorted by date/time
   */
  async getAllEmployeeOccurrencesEnriched(
    employeeJobs: Array<{ jobTemplate: JobTemplate; patient: any }>,
    employeeId: string
  ): Promise<EnrichedOccurrence[]> {
    const startTime = Date.now();
    
    logger.info('Fetching all employee occurrences enriched', {
      employeeId,
      jobCount: employeeJobs.length,
      type: 'enriched_occurrences_start'
    });

    try {
      // ALWAYS fetch occurrences via both paths:
      // 1. Via job templates (if any exist)
      // 2. Direct query (to catch occurrences not linked to templates)
      
      let templateOccurrences: EnrichedOccurrence[] = [];
      
      // Path 1: Fetch occurrences via job templates
      if (employeeJobs && employeeJobs.length > 0) {
        logger.info('Fetching occurrences via job templates', {
          employeeId,
          jobCount: employeeJobs.length,
          type: 'enriched_occurrences_via_templates'
        });
        
        const occurrencePromises = employeeJobs.map(async ({ jobTemplate, patient }) => {
          const result = await this.getFutureOccurrences(jobTemplate, employeeId);
          
          if (!result.success || result.occurrences.length === 0) {
            return [];
          }
          
          // Enrich each occurrence with job and patient details
          return result.occurrences.map(occurrence => ({
            occurrenceId: occurrence.occurrenceId,
            occurrenceRecordId: occurrence.id,
            jobTemplate: {
              id: jobTemplate.id,
              jobCode: jobTemplate.jobCode,
              title: jobTemplate.title
            },
            patient: {
              id: patient?.id || '',
              fullName: patient?.name || 'Unknown Patient',
              firstName: extractFirstName(patient?.name || '')
            },
            scheduledAt: occurrence.scheduledAt,
            time: occurrence.time,
            displayDateTime: formatDateTimeForGreeting(occurrence.scheduledAt, occurrence.time),
            status: occurrence.status
          }));
        });
        
        const allOccurrencesNested = await Promise.all(occurrencePromises);
        templateOccurrences = allOccurrencesNested.flat();
        
        logger.info('Occurrences fetched via templates', {
          employeeId,
          count: templateOccurrences.length,
          type: 'template_occurrences_fetched'
        });
      }
      
      // Path 2: ALWAYS fetch occurrences directly (to catch non-template-linked occurrences)
      logger.info('Fetching occurrences directly from Job Occurrences table', {
        employeeId,
        type: 'enriched_occurrences_direct_fetch'
      });
      
      const directOccurrences = await this.getOccurrencesDirectly(employeeId);
      
      logger.info('Occurrences fetched directly', {
        employeeId,
        count: directOccurrences.length,
        type: 'direct_occurrences_fetched'
      });
      
      // Merge occurrences and remove duplicates (by occurrenceRecordId)
      const occurrenceMap = new Map<string, EnrichedOccurrence>();
      
      // Add template occurrences first (they have complete job template info)
      for (const occ of templateOccurrences) {
        occurrenceMap.set(occ.occurrenceRecordId, occ);
      }
      
      // Add direct occurrences (only if not already in map)
      for (const occ of directOccurrences) {
        if (!occurrenceMap.has(occ.occurrenceRecordId)) {
          occurrenceMap.set(occ.occurrenceRecordId, occ);
        }
      }
      
      const allOccurrences = Array.from(occurrenceMap.values());
      
      // Sort by date, then by time (earliest first)
      allOccurrences.sort((a, b) => {
        const dateCompare = a.scheduledAt.localeCompare(b.scheduledAt);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
      
      const duration = Date.now() - startTime;
      
      logger.info('Employee occurrences enriched successfully', {
        employeeId,
        templateCount: templateOccurrences.length,
        directCount: directOccurrences.length,
        totalOccurrences: allOccurrences.length,
        duration,
        type: 'enriched_occurrences_success'
      });
      
      return allOccurrences;
      
    } catch (error) {
      logger.error('Error fetching enriched occurrences', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'enriched_occurrences_error'
      });
      
      return [];
    }
  }

  /**
   * Fetch occurrences directly from Job Occurrences table by employee ID
   * Used when employee has no Job Templates assigned but has direct occurrence assignments
   * @param employeeId - Employee record ID
   * @returns Enriched occurrences with job template and patient details fetched
   */
  private async getOccurrencesDirectly(employeeId: string): Promise<EnrichedOccurrence[]> {
    const startTime = Date.now();
    
    try {
      // Get employee details to use name for query
      const employee = await airtableClient.getEmployeeById(employeeId);
      
      if (!employee) {
        logger.warn('Employee not found for direct occurrence fetch', {
          employeeId,
          type: 'direct_occurrence_fetch_no_employee'
        });
        return [];
      }
      
      const employeeName = employee.fields['Display Name'];
      
      logger.info('Fetching occurrences directly by employee record ID', {
        employeeId,
        employeeName,
        type: 'direct_occurrence_fetch_start'
      });
      
      // Query Job Occurrences by recordId (from Assigned Employee) lookup field
      const today = new Date().toISOString().split('T')[0];
      const filterFormula = `AND(FIND('${employeeId}', ARRAYJOIN({recordId (from Assigned Employee)})), {Status} = 'Scheduled', {Scheduled At} >= '${today}')`;
      
      const response = await new Promise<AirtableResponse<JobOccurrenceFields>>((resolve, reject) => {
        const params = new URLSearchParams({
          filterByFormula: filterFormula,
          maxRecords: '9'
        });
        
        // Add all field parameters
        const fields = ['Occurrence ID', 'Job Template', 'Scheduled At', 'Time', 'Status', 'Assigned Employee', 'Provider', 'Patient TXT', 'Employee TXT', 'recordId (from Assigned Employee)'];
        fields.forEach(field => params.append('fields[]', field));
        
        // Add sort parameter (Airtable expects sort[0][field] and sort[0][direction])
        params.append('sort[0][field]', 'Scheduled At');
        params.append('sort[0][direction]', 'asc');
        
        const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Job Occurrences')}?${params.toString()}`;
        
        const req = https.request({
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (error) {
              reject(new Error('Failed to parse response'));
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });
      
      logger.info('Direct occurrence query complete', {
        employeeId,
        employeeName,
        found: response.records?.length || 0,
        hasRecords: !!response.records,
        type: 'direct_occurrence_fetch_complete'
      });
      
      if (!response.records || response.records.length === 0) {
        logger.warn('No records in response', {
          employeeId,
          responseKeys: Object.keys(response || {}),
          error: (response as any).error,
          type: 'direct_occurrence_no_records'
        });
        return [];
      }
      
      // Transform and enrich each occurrence
      const enrichedOccurrences: EnrichedOccurrence[] = [];
      
      for (const record of response.records) {
        const occurrence = transformJobOccurrenceRecord(record as JobOccurrenceRecord);
        
        // Fetch job template and patient details
        const jobTemplateId = occurrence.jobTemplateId;
        const patientId = occurrence.patientId;
        
        const [jobTemplate, patient] = await Promise.all([
          jobTemplateId ? airtableClient.getJobTemplateById(jobTemplateId) : null,
          patientId ? airtableClient.getPatientById(patientId) : null
        ]);
        
        enrichedOccurrences.push({
          occurrenceId: occurrence.occurrenceId,
          occurrenceRecordId: occurrence.id,
          jobTemplate: {
            id: jobTemplate?.id || jobTemplateId,
            jobCode: jobTemplate?.fields['Job Code'] || 'Unknown',
            title: jobTemplate?.fields['Title'] || 'Healthcare Service'
          },
          patient: {
            id: patientId,
            fullName: patient?.fields['Patient Full Name'] || record.fields['Patient TXT'] || 'Unknown Patient',
            firstName: extractFirstName(patient?.fields['Patient Full Name'] || record.fields['Patient TXT'] || '')
          },
          scheduledAt: occurrence.scheduledAt,
          time: occurrence.time,
          displayDateTime: formatDateTimeForGreeting(occurrence.scheduledAt, occurrence.time),
          status: occurrence.status
        });
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('Direct occurrences enriched successfully', {
        employeeId,
        count: enrichedOccurrences.length,
        duration,
        type: 'direct_occurrence_enrich_success'
      });
      
      return enrichedOccurrences;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Error fetching occurrences directly', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'direct_occurrence_fetch_error'
      });
      
      return [];
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
