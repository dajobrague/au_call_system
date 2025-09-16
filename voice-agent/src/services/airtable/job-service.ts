/**
 * Job Template Service
 * Handles job template validation, lookup, and authorization
 */

import { airtableClient } from './client';
import { JobTemplateCache, PatientCache } from './cache-service';
import { airtableConfig } from '../../config/airtable';
import { logger } from '../../lib/logger';
import type { 
  JobTemplate, 
  Patient, 
  JobTemplateRecord, 
  PatientRecord,
  Employee 
} from './types';

/**
 * Transform Airtable job template record to our JobTemplate type
 */
function transformJobTemplateRecord(record: JobTemplateRecord): JobTemplate {
  const fields = record.fields;
  
  return {
    id: record.id,
    jobCode: fields['Job Code'] || '',
    title: fields['Title'] || 'Unknown Job',
    serviceType: fields['Service Type'] || 'Other',
    priority: fields['Priority'] || 'Normal',
    timeWindowStart: fields['Time Window Start'],
    timeWindowEnd: fields['Time Window End'],
    patientId: fields['Patient']?.[0] || '', // First patient ID
    providerId: fields['Provider']?.[0] || '', // First provider ID
    defaultEmployeeId: fields['Default Employee']?.[0] || '', // First employee ID
    uniqueJobNumber: fields['Unique Job Number'] || 0,
    occurrenceIds: fields['Occurrences'] || [], // Array of occurrence IDs
    active: fields['Active'] !== false, // Default to true if not specified
  };
}

/**
 * Transform Airtable patient record to our Patient type
 */
function transformPatientRecord(record: PatientRecord): Patient {
  const fields = record.fields;
  
  return {
    id: record.id,
    name: fields['Patient Full Name'] || 'Unknown Patient',
    patientId: fields['Patient ID'] || 0,
    phone: fields['Phone'] || '',
    dateOfBirth: fields['DOB'] || '',
    address: fields['Address'],
    notes: fields['Important Notes'],
    providerId: fields['Provider']?.[0] || '', // First provider ID
    active: fields['Active'] !== false, // Default to true if not specified
  };
}

/**
 * Job validation result
 */
export interface JobValidationResult {
  success: boolean;
  jobTemplate?: JobTemplate;
  patient?: Patient | null;
  error?: string;
  errorType?: 'not_found' | 'not_authorized' | 'system_error';
}

/**
 * Job Template Service Class
 */
export class JobService {
  /**
   * Validate job code and get job details
   */
  async validateJobCode(jobCode: string): Promise<{ success: boolean; jobTemplate?: JobTemplate; error?: string }> {
    const startTime = Date.now();
    
    logger.info('Job code validation attempt', {
      jobCode,
      type: 'job_validation_start'
    });

    try {
      // Always query Airtable directly for real-time data accuracy
      logger.info('Querying Airtable for real-time job template data', {
        jobCode,
        type: 'airtable_query_job'
      });
      
      const jobTemplateRecord = await airtableClient.findJobTemplateByCode(jobCode);
      
      if (!jobTemplateRecord) {
        logger.info('Job code not found', {
          jobCode,
          duration: Date.now() - startTime,
          type: 'job_validation_failed'
        });
        
        return {
          success: false,
          error: 'Job code not found in system'
        };
      }
      
      // Transform the job template (no caching)
      const jobTemplate = transformJobTemplateRecord(jobTemplateRecord);
      
      // Check if job template is active
      if (!jobTemplate.active) {
        logger.warn('Inactive job template access attempt', {
          jobCode,
          jobTemplateId: jobTemplate.id,
          title: jobTemplate.title,
          type: 'job_validation_inactive'
        });
        
        return {
          success: false,
          error: 'Job template is inactive'
        };
      }
      
      logger.info('Job code validation successful', {
        jobCode,
        jobTemplateId: jobTemplate.id,
        title: jobTemplate.title,
        serviceType: jobTemplate.serviceType,
        duration: Date.now() - startTime,
        type: 'job_validation_success'
      });
      
      return {
        success: true,
        jobTemplate
      };
      
    } catch (error) {
      logger.error('Job code validation error', {
        jobCode,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'job_validation_error'
      });
      
      return {
        success: false,
        error: 'System error during job validation'
      };
    }
  }

  /**
   * Check if employee is authorized to access a job template
   */
  async checkJobAuthorization(employee: Employee, jobTemplate: JobTemplate): Promise<boolean> {
    logger.info('Job authorization check', {
      employeeId: employee.id,
      employeeName: employee.name,
      jobTemplateId: jobTemplate.id,
      jobCode: jobTemplate.jobCode,
      type: 'job_authorization_check'
    });

    // Check if the job template ID is in the employee's authorized job templates
    const isAuthorized = employee.jobTemplateIds.includes(jobTemplate.id);
    
    logger.info('Job authorization result', {
      employeeId: employee.id,
      jobTemplateId: jobTemplate.id,
      isAuthorized,
      type: 'job_authorization_result'
    });
    
    return isAuthorized;
  }

  /**
   * Get patient information for a job template
   */
  async getJobPatient(jobTemplate: JobTemplate): Promise<Patient | null> {
    if (!jobTemplate.patientId) {
      logger.warn('Job template has no patient ID', {
        jobTemplateId: jobTemplate.id,
        jobCode: jobTemplate.jobCode,
        type: 'job_no_patient'
      });
      return null;
    }

    try {
      // Always query Airtable directly for real-time data accuracy
      logger.info('Querying Airtable for real-time patient data', {
        patientId: jobTemplate.patientId,
        type: 'airtable_query_patient'
      });
      
      const patientRecord = await airtableClient.getPatientById(jobTemplate.patientId);
      
      if (!patientRecord) {
        logger.warn('Patient not found', {
          patientId: jobTemplate.patientId,
          jobTemplateId: jobTemplate.id,
          type: 'patient_not_found'
        });
        return null;
      }
      
      // Transform the patient (no caching)
      const patient = transformPatientRecord(patientRecord);
      
      return patient;
      
    } catch (error) {
      logger.error('Patient lookup error', {
        patientId: jobTemplate.patientId,
        jobTemplateId: jobTemplate.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'patient_lookup_error'
      });
      
      return null;
    }
  }

  /**
   * Complete job validation with authorization and patient lookup
   */
  async validateJobWithAuthorization(employee: Employee, jobCode: string): Promise<JobValidationResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Validate job code exists
      const jobValidation = await this.validateJobCode(jobCode);
      
      if (!jobValidation.success || !jobValidation.jobTemplate) {
        return {
          success: false,
          error: jobValidation.error || 'Job not found',
          errorType: 'not_found'
        };
      }
      
      const jobTemplate = jobValidation.jobTemplate;
      
      // Step 2: Check authorization
      const isAuthorized = await this.checkJobAuthorization(employee, jobTemplate);
      
      if (!isAuthorized) {
        logger.warn('Employee not authorized for job', {
          employeeId: employee.id,
          employeeName: employee.name,
          jobCode,
          jobTemplateId: jobTemplate.id,
          duration: Date.now() - startTime,
          type: 'job_not_authorized'
        });
        
        return {
          success: false,
          error: 'You are not assigned to this job',
          errorType: 'not_authorized'
        };
      }
      
      // Step 3: Get patient information
      const patient = await this.getJobPatient(jobTemplate);
      
      logger.info('Complete job validation successful', {
        employeeId: employee.id,
        jobCode,
        jobTemplateId: jobTemplate.id,
        patientId: patient?.id,
        patientName: patient?.name,
        duration: Date.now() - startTime,
        type: 'job_validation_complete'
      });
      
      return {
        success: true,
        jobTemplate,
        patient
      };
      
    } catch (error) {
      logger.error('Complete job validation error', {
        employeeId: employee.id,
        jobCode,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'job_validation_complete_error'
      });
      
      return {
        success: false,
        error: 'System error during job validation',
        errorType: 'system_error'
      };
    }
  }

  /**
   * Generate dynamic job options message
   */
  generateJobOptionsMessage(jobTemplate: JobTemplate, patient: Patient | null): string {
    const patientName = patient?.name || 'the patient';
    const jobTitle = jobTemplate.title;
    const serviceType = jobTemplate.serviceType;
    
    // Add time window if available
    let timeInfo = '';
    if (jobTemplate.timeWindowStart && jobTemplate.timeWindowEnd) {
      timeInfo = ` scheduled between ${jobTemplate.timeWindowStart} and ${jobTemplate.timeWindowEnd}`;
    }
    
    return `What do you want to do for ${patientName}'s ${jobTitle}${timeInfo}? Press 1 for re-scheduling, Press 2 to leave the job as open for someone else to take care of it, Press 3 to talk to a representative.`;
  }

  /**
   * Health check for job service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test a simple job template lookup
      const testResult = await this.validateJobCode('010101'); // Use a known job code from our analysis
      
      return {
        healthy: true,
        message: 'Job service healthy',
        details: {
          testJobValidation: testResult.success ? 'passed' : 'failed'
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Job service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const jobService = new JobService();
