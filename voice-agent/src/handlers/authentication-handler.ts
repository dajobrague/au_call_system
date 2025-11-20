/**
 * Authentication Handler
 * Handles phone-based authentication and initial data prefetching
 */

import { employeeService } from '../services/airtable/employee-service';
import { multiProviderService } from '../services/airtable/multi-provider-service';
import { jobService } from '../services/airtable/job-service';
import { logger } from '../lib/logger';

export interface AuthenticationResult {
  success: boolean;
  employee?: any;
  provider?: any;
  error?: string;
}

export interface BackgroundDataResult {
  providers?: any;
  employeeJobs?: any[];
  loadedAt?: number;
}

/**
 * Authenticate user by phone number
 * @param callerPhone - Phone number to authenticate
 * @returns Authentication result with employee data
 */
export async function authenticateByPhone(callerPhone: string): Promise<AuthenticationResult> {
  const startTime = Date.now();
  
  try {
    // DEEP DEBUG: Log what authentication handler receives
    logger.info('🔍 DEEP DEBUG: Authentication handler called', {
      callerPhone,
      phoneType: typeof callerPhone,
      phoneLength: callerPhone?.length || 0,
      phoneCharCodes: callerPhone ? Array.from(callerPhone).map(c => c.charCodeAt(0)) : [],
      type: 'auth_handler_debug'
    });
    
    const authResult = await employeeService.authenticateByPhone(callerPhone);
    
    if (authResult.success && authResult.employee) {
      logger.info('Phone authentication successful', {
        phone: callerPhone,
        employeeId: authResult.employee.id,
        employeeName: authResult.employee.name,
        duration: Date.now() - startTime,
        type: 'auth_success_phone'
      });
      
      return {
        success: true,
        employee: authResult.employee,
        provider: authResult.provider
      };
    } else {
      logger.warn('Phone authentication failed', {
        phone: callerPhone,
        duration: Date.now() - startTime,
        type: 'auth_failed_phone'
      });
      
      return {
        success: false,
        error: 'Phone number not found'
      };
    }
  } catch (error) {
    logger.error('Phone authentication error', {
      phone: callerPhone,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'auth_error_phone'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error'
    };
  }
}

/**
 * Prefetch background data for authenticated employee
 * Loads provider and job information in parallel, enriched with next occurrence
 * @param employee - Authenticated employee
 * @returns Background data including providers and jobs with occurrence info
 */
export async function prefetchBackgroundData(employee: any): Promise<BackgroundDataResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting background data prefetch', {
      employeeId: employee.id,
      employeeName: employee.name,
      type: 'background_data_start'
    });
    
    const [providerResult, employeeJobsResult] = await Promise.all([
      multiProviderService.getEmployeeProviders(employee),
      jobService.getEmployeeJobs(employee, employee.providerId)
    ]);
    
    // Enrich each job with its next occurrence for better prompts
    const enrichedJobs = await Promise.all(
      (employeeJobsResult.jobs || []).map(async (job: any) => {
        try {
          // Fetch future occurrences for this job
          const { jobOccurrenceService } = await import('../services/airtable');
          const fullJobTemplate = {
            ...job.jobTemplate,
            priority: 'Normal',
            providerId: employee.providerId || '',
            defaultEmployeeId: employee.id,
            uniqueJobNumber: 0,
            active: true,
          };
          
          const occurrenceResult = await jobOccurrenceService.getFutureOccurrences(
            fullJobTemplate,
            employee.id
          );
          
          // Add the next occurrence to the job object
          return {
            ...job,
            nextOccurrence: occurrenceResult.occurrences?.[0] || null
          };
        } catch (error) {
          // If occurrence fetch fails, return job without occurrence data
          return { ...job, nextOccurrence: null };
        }
      })
    );
    
    logger.info('Background data prefetch complete', {
      employeeId: employee.id,
      providersCount: providerResult?.providers?.length || 0,
      jobsCount: enrichedJobs.length,
      duration: Date.now() - startTime,
      type: 'background_data_complete'
    });
    
    return {
      providers: providerResult,
      employeeJobs: enrichedJobs,
      loadedAt: Date.now()
    };
  } catch (error) {
    logger.error('Background data prefetch error', {
      employeeId: employee.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'background_data_error'
    });
    
    return {};
  }
}
