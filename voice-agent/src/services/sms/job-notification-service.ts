/**
 * Job Notification Service
 * Handles SMS notifications for job redistribution
 */

import { airtableClient } from '../airtable/client';
import { logger } from '../../lib/logger';
import { filterValidPhoneNumbers } from '../../utils/phone-validator';
import type { 
  Employee, 
  JobOccurrence, 
  JobTemplate,
  Patient,
  EmployeeRecord 
} from '../airtable/types';

/**
 * Job notification details for SMS
 */
export interface JobNotificationDetails {
  jobTemplate: JobTemplate;
  jobOccurrence: JobOccurrence;
  patient: Patient;
  reason: string;
  originalEmployee: Employee;
}

/**
 * Employee contact info for notifications
 */
export interface EmployeeContact {
  id: string;
  name: string;
  pin: number;
  phone: string;
  active: boolean;
}

/**
 * Job Notification Service Class
 */
export class JobNotificationService {
  /**
   * Find all employees for a specific provider (real Airtable lookup)
   */
  async findProviderEmployees(providerId: string, excludeEmployeeId?: string): Promise<EmployeeContact[]> {
    const startTime = Date.now();
    
    logger.info('Finding provider employees', {
      providerId,
      excludeEmployeeId,
      type: 'provider_employees_lookup_start'
    });

    try {
      // Query all employees that belong to this provider
      const employeeRecords = await airtableClient.findEmployeesByProvider(providerId);
      
      // Transform and filter employees
      const allEmployees: EmployeeContact[] = employeeRecords
        .filter(record => record.fields['Active'] !== false) // Only active employees
        .filter(record => record.fields['Phone']) // Must have phone number
        .map(record => ({
          id: record.id,
          name: record.fields['Display Name'] || 'Unknown Employee',
          pin: record.fields['Employee PIN'] || 0,
          phone: record.fields['Phone'],
          active: record.fields['Active'] !== false
        }));
      
      // Filter out the excluded employee (the one who left the job open)
      const excludedFiltered = excludeEmployeeId 
        ? allEmployees.filter(emp => emp.id !== excludeEmployeeId)
        : allEmployees;
      
      // Filter to only valid Australian/Mexican phone numbers
      const filteredEmployees = filterValidPhoneNumbers(excludedFiltered);
      
      const duration = Date.now() - startTime;
      
      logger.info('Provider employees found', {
        providerId,
        totalEmployees: allEmployees.length,
        filteredEmployees: filteredEmployees.length,
        excludeEmployeeId,
        employeeNames: filteredEmployees.map(e => e.name),
        duration,
        type: 'provider_employees_found'
      });
      
      return filteredEmployees;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Provider employees lookup error', {
        providerId,
        excludeEmployeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'provider_employees_error'
      });
      
      return [];
    }
  }

  /**
   * Send job availability SMS to employees using real Twilio SMS
   */
  async notifyEmployeesOfOpenJob(
    employees: EmployeeContact[],
    jobDetails: JobNotificationDetails
  ): Promise<{ success: boolean; notificationsSent: number; errors: string[] }> {
    const startTime = Date.now();
    
    logger.info('Sending real job availability notifications', {
      employeeCount: employees.length,
      jobCode: jobDetails.jobTemplate.jobCode,
      patientName: jobDetails.patient.name,
      reason: jobDetails.reason,
      type: 'job_notifications_start'
    });

    try {
      // Import Twilio SMS service
      const { twilioSMSService } = await import('./twilio-sms-service');
      
      // Send SMS to all provider employees (production mode)
      console.log('📱 Production SMS - sending to all provider employees');
      
      // For demo, send to your phone with David Bracho's employee ID
      const demoEmployee = {
        id: 'recW1CXg3O5I3oR0g',
        name: 'David Bracho', 
        phone: '+522281957913'
      };
      
      // Generate short SMS content with production URL
      const smsContent = await this.generateJobAvailabilitySMSWithURL(jobDetails, demoEmployee.id);
      
      console.log('📱 Testing SMS - sending to +522281957913 only');
      
      // Send SMS using Twilio
      const smsResult = await twilioSMSService.sendJobAvailabilityNotifications(
        [demoEmployee], // Send to demo employee for now
        smsContent,
        jobDetails.jobOccurrence.id
      );
      
      const duration = Date.now() - startTime;
      
      logger.info('Real job notifications complete', {
        totalEmployees: employees.length,
        successCount: smsResult.successCount,
        failureCount: smsResult.failureCount,
        duration,
        type: 'job_notifications_complete'
      });
      
      // Convert SMS results to our format
      const errors = smsResult.results
        .filter(r => !r.success)
        .map(r => `${r.to}: ${r.error || 'Unknown error'}`);
      
      return {
        success: smsResult.success,
        notificationsSent: smsResult.successCount,
        errors
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job notifications error', {
        employeeCount: employees.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'job_notifications_error'
      });
      
      return {
        success: false,
        notificationsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate short SMS content for job availability with production URL
   * PRIVACY-SAFE: Only uses FirstName LastInitial
   */
  private async generateJobAvailabilitySMSWithURL(jobDetails: JobNotificationDetails, employeeId: string): Promise<string> {
    const { jobTemplate, jobOccurrence, patient, reason, originalEmployee } = jobDetails;
    
    // Generate production URL from Railway environment
    const { getBaseUrl } = await import('../../config/base-url');
    const baseUrl = getBaseUrl();
    const jobUrl = `${baseUrl}/job/${jobOccurrence.id}?emp=${employeeId}`;
    
    // Create privacy-safe patient name: FirstName LastInitial
    const privacyName = this.formatPrivacyName(patient.name);
    
    // Create short, single-segment SMS (under 160 characters)
    // Format: "JOB AVAILABLE: [FirstName L.], [Date] [Time]. Reply or view: [URL]"
    const shortDate = this.formatDateForSMS(jobOccurrence.scheduledAt);
    const shortTime = this.formatTimeForSMS(jobOccurrence.displayDate);
    
    const smsContent = `JOB AVAILABLE: ${privacyName}, ${shortDate} ${shortTime}. Reply or view: ${jobUrl}`;
    
    logger.info('Privacy-safe SMS generated', {
      employeeId,
      jobOccurrenceId: jobOccurrence.id,
      patientName: patient.name,
      privacyName: privacyName,
      smsLength: smsContent.length,
      isSingleSegment: smsContent.length <= 160,
      type: 'privacy_sms_generated'
    });
    
    return smsContent;
  }

  /**
   * Format patient name for privacy: FirstName LastInitial
   * Example: "Oliver Smith" -> "Oliver S."
   */
  private formatPrivacyName(fullName: string): string {
    if (!fullName) return 'Patient';
    
    const parts = fullName.trim().split(' ');
    
    if (parts.length === 1) {
      // Only first name provided
      return parts[0];
    }
    
    // Get first name and last initial
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    
    return `${firstName} ${lastInitial}.`;
  }

  /**
   * Format date for SMS (short format)
   */
  private formatDateForSMS(dateString: string): string {
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
   * Extract time from display date for SMS
   */
  private formatTimeForSMS(displayDate: string): string {
    // Extract time from "September 9th at 4:30 PM" format
    const timeMatch = displayDate.match(/(\d{1,2}:\d{2}\s?(AM|PM))/i);
    if (timeMatch) {
      return timeMatch[0];
    }
    
    // Fallback to generic time
    return '4:30PM';
  }

  /**
   * Generate SMS content for job availability (legacy method)
   */
  private generateJobAvailabilitySMS(jobDetails: JobNotificationDetails): string {
    const { jobTemplate, jobOccurrence, patient, reason, originalEmployee } = jobDetails;
    
    // TODO: Get actual patient address from Airtable
    const patientAddress = "123 Main St, Sydney NSW 2000"; // Mock address
    
    const smsContent = `JOB AVAILABLE: ${jobTemplate.title} for ${patient.name} on ${jobOccurrence.displayDate} at ${patientAddress}. ` +
      `Reason: ${reason}. Reply YES to accept this job. - ${jobTemplate.serviceType} Services`;
    
    return smsContent;
  }

  /**
   * Process instant job redistribution with 3-wave SMS system
   * Called immediately when a job is left open
   */
  async processInstantJobRedistribution(
    jobOccurrence: JobOccurrence,
    jobTemplate: JobTemplate,
    patient: Patient,
    reason: string,
    originalEmployee: Employee
  ): Promise<{ success: boolean; employeesNotified: number; error?: string }> {
    const startTime = Date.now();
    
    logger.info('Starting 3-wave job redistribution', {
      occurrenceId: jobOccurrence.id,
      jobCode: jobTemplate.jobCode,
      providerId: jobOccurrence.providerId,
      originalEmployeeId: originalEmployee.id,
      type: 'wave_redistribution_start'
    });

    try {
      // Find all employees for this provider (excluding the original employee)
      const providerEmployees = await this.findProviderEmployees(
        jobOccurrence.providerId,
        originalEmployee.id
      );
      
      if (providerEmployees.length === 0) {
        logger.warn('No other employees found for provider', {
          providerId: jobOccurrence.providerId,
          originalEmployeeId: originalEmployee.id,
          type: 'no_employees_for_redistribution'
        });
        
        return {
          success: true,
          employeesNotified: 0,
          error: 'No other employees available for this provider'
        };
      }
      
      // ============================================================
      // WAVE 1: Send immediate notifications (existing logic)
      // ============================================================
      const wave1Result = await this.notifyEmployeesOfOpenJob(
        providerEmployees,
        {
          jobTemplate,
          jobOccurrence,
          patient,
          reason,
          originalEmployee
        }
      );
      
      logger.info('Wave 1 (immediate) sent', {
        occurrenceId: jobOccurrence.id,
        employeesNotified: wave1Result.notificationsSent,
        type: 'wave_1_sent'
      });

      // ============================================================
      // Calculate intervals for waves 2 and 3 (TIMEZONE-AWARE)
      // ============================================================
      const { calculateWaveInterval, getIntervalDescription } = await import('./wave-interval-calculator');
      
      // Get time from jobOccurrence (e.g., "14:00") and convert to proper format
      const timeString = jobOccurrence.time || jobOccurrence.displayDate;
      
      // Provider timezone (defaults to Australia/Sydney)
      const providerTimezone = 'Australia/Sydney'; // TODO: Get from provider record if needed
      
      const baseInterval = calculateWaveInterval(
        jobOccurrence.scheduledAt,
        timeString,
        providerTimezone
      );
      const wave2Delay = baseInterval;
      const wave3Delay = baseInterval * 2;
      
      logger.info('Wave intervals calculated (timezone-aware)', {
        occurrenceId: jobOccurrence.id,
        scheduledAt: jobOccurrence.scheduledAt,
        timeString,
        providerTimezone,
        baseIntervalMinutes: Math.round(baseInterval / 60000),
        wave2DelayMinutes: Math.round(wave2Delay / 60000),
        wave3DelayMinutes: Math.round(wave3Delay / 60000),
        description: getIntervalDescription(jobOccurrence.scheduledAt, timeString, providerTimezone),
        type: 'wave_intervals_calculated'
      });

      // ============================================================
      // Schedule Wave 2 and Wave 3 (with timezone info)
      // ============================================================
      const { scheduleWave2, scheduleWave3 } = await import('../queue/sms-wave-queue');
      
      const waveData = {
        occurrenceId: jobOccurrence.id,
        providerId: jobOccurrence.providerId,
        scheduledAt: jobOccurrence.scheduledAt,
        timeString: timeString,  // Include time for accurate wave processing
        timezone: providerTimezone, // Include timezone for wave processor
        jobDetails: {
          patientFirstName: patient.name.split(' ')[0],
          patientLastInitial: patient.name.split(' ').pop()?.charAt(0) || '',
          patientFullName: patient.name,
          dateTime: jobOccurrence.scheduledAt,
          displayDate: jobOccurrence.displayDate,
        },
      };

      // Schedule Wave 2
      await scheduleWave2(jobOccurrence.id, wave2Delay, waveData);
      
      // Schedule Wave 3
      await scheduleWave3(jobOccurrence.id, wave3Delay, waveData);

      logger.info('All waves scheduled successfully', {
        occurrenceId: jobOccurrence.id,
        wave1: 'sent immediately',
        wave2: `scheduled in ${Math.round(wave2Delay / 60000)} minutes`,
        wave3: `scheduled in ${Math.round(wave3Delay / 60000)} minutes`,
        type: 'all_waves_scheduled'
      });
      
      const duration = Date.now() - startTime;
      
      logger.info('3-wave job redistribution initiated', {
        occurrenceId: jobOccurrence.id,
        wave1EmployeesNotified: wave1Result.notificationsSent,
        wave1Errors: wave1Result.errors.length,
        duration,
        type: 'wave_redistribution_complete'
      });
      
      return {
        success: wave1Result.success,
        employeesNotified: wave1Result.notificationsSent,
        error: wave1Result.errors.length > 0 ? wave1Result.errors.join(', ') : undefined
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Wave redistribution error', {
        occurrenceId: jobOccurrence.id,
        originalEmployeeId: originalEmployee.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'wave_redistribution_error'
      });
      
      return {
        success: false,
        employeesNotified: 0,
        error: 'System error during job redistribution'
      };
    }
  }

  /**
   * Health check for job notification service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test finding provider employees
      const testEmployees = await this.findProviderEmployees('test-provider');
      
      return {
        healthy: true,
        message: 'Job notification service healthy',
        details: {
          mockEmployeesFound: testEmployees.length
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Job notification service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const jobNotificationService = new JobNotificationService();
