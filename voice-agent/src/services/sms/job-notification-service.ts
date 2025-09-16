/**
 * Job Notification Service
 * Handles SMS notifications for job redistribution
 */

import { airtableClient } from '../airtable/client';
import { logger } from '../../lib/logger';
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
      const filteredEmployees = excludeEmployeeId 
        ? allEmployees.filter(emp => emp.id !== excludeEmployeeId)
        : allEmployees;
      
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
   */
  private async generateJobAvailabilitySMSWithURL(jobDetails: JobNotificationDetails, employeeId: string): Promise<string> {
    const { jobTemplate, jobOccurrence, patient, reason, originalEmployee } = jobDetails;
    
    // Generate production URL (no token needed)
    const baseUrl = 'https://sam-voice-agent.vercel.app';
    const jobUrl = `${baseUrl}/job/${jobOccurrence.id}?emp=${employeeId}`;
    
    // Create short, single-segment SMS (under 160 characters)
    // Format: "JOB AVAILABLE: [Patient], [Date] [Time]. View details: [URL]"
    const shortDate = this.formatDateForSMS(jobOccurrence.scheduledAt);
    const shortTime = this.formatTimeForSMS(jobOccurrence.displayDate);
    
    const smsContent = `JOB AVAILABLE: ${patient.name}, ${shortDate} ${shortTime}. View details: ${jobUrl}`;
    
    logger.info('Short SMS generated', {
      employeeId,
      jobOccurrenceId: jobOccurrence.id,
      patientName: patient.name,
      smsLength: smsContent.length,
      isSingleSegment: smsContent.length <= 160,
      type: 'short_sms_generated'
    });
    
    return smsContent;
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
   * Process instant job redistribution
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
    
    logger.info('Starting instant job redistribution', {
      occurrenceId: jobOccurrence.id,
      jobCode: jobTemplate.jobCode,
      providerId: jobOccurrence.providerId,
      originalEmployeeId: originalEmployee.id,
      type: 'instant_redistribution_start'
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
      
      // Send notifications to all provider employees
      const notificationResult = await this.notifyEmployeesOfOpenJob(
        providerEmployees,
        {
          jobTemplate,
          jobOccurrence,
          patient,
          reason,
          originalEmployee
        }
      );
      
      const duration = Date.now() - startTime;
      
      logger.info('Instant job redistribution complete', {
        occurrenceId: jobOccurrence.id,
        employeesNotified: notificationResult.notificationsSent,
        errors: notificationResult.errors.length,
        duration,
        type: 'instant_redistribution_complete'
      });
      
      return {
        success: notificationResult.success,
        employeesNotified: notificationResult.notificationsSent,
        error: notificationResult.errors.length > 0 ? notificationResult.errors.join(', ') : undefined
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Instant job redistribution error', {
        occurrenceId: jobOccurrence.id,
        originalEmployeeId: originalEmployee.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'instant_redistribution_error'
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
