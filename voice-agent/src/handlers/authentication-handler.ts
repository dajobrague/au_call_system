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
    logger.info('Phone authentication attempt', {
      phone: callerPhone,
      type: 'auth_attempt_phone'
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
 * Loads provider and job information in parallel
 * @param employee - Authenticated employee
 * @returns Background data including providers and jobs
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
    
    logger.info('Background data prefetch complete', {
      employeeId: employee.id,
      providersCount: providerResult?.providers?.length || 0,
      jobsCount: employeeJobsResult.jobs?.length || 0,
      duration: Date.now() - startTime,
      type: 'background_data_complete'
    });
    
    return {
      providers: providerResult,
      employeeJobs: employeeJobsResult.jobs || [],
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
