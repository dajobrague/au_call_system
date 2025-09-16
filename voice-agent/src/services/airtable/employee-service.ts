/**
 * Employee Service
 * High-level service for employee authentication and data management
 */

import { airtableClient } from './client';
import { EmployeeCache, ProviderCache } from './cache-service';
import { normalizePhoneNumber, phoneNumbersEqual } from '../../utils/phone-formatter';
import { airtableConfig } from '../../config/airtable';
import { logger } from '../../lib/logger';
import type { 
  Employee, 
  Provider, 
  AuthResult, 
  EmployeeRecord, 
  ProviderRecord,
  EmployeeFields,
  ProviderFields 
} from './types';

/**
 * Transform Airtable employee record to our Employee type
 */
function transformEmployeeRecord(record: EmployeeRecord): Employee {
  const fields = record.fields;
  
  return {
    id: record.id,
    name: fields['Display Name'] || 'Unknown Employee',
    pin: fields['Employee PIN'] || 0,
    phone: normalizePhoneNumber(fields['Phone'] || ''),
    providerId: fields['Provider']?.[0] || '', // First provider ID
    jobTemplateIds: fields['Job Templates'] || [],
    notes: fields['Notes'],
    active: fields['Active'] !== false, // Default to true if not specified
  };
}

/**
 * Transform Airtable provider record to our Provider type
 */
function transformProviderRecord(record: ProviderRecord): Provider {
  const fields = record.fields;
  
  return {
    id: record.id,
    name: fields['Name'] || 'Unknown Provider',
    providerId: fields['Provider ID'] || 0,
    greeting: fields['Greeting (IVR)'],
    timezone: fields['Timezone'],
    active: fields['Active'] !== false, // Default to true if not specified
  };
}

/**
 * Employee Service Class
 */
export class EmployeeService {
  /**
   * Authenticate employee by phone number
   */
  async authenticateByPhone(phoneNumber: string): Promise<AuthResult> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const startTime = Date.now();
    
    logger.info('Phone authentication attempt', {
      phone: normalizedPhone,
      type: 'auth_attempt_phone'
    });

    try {
      // Always query Airtable directly for real-time data accuracy
      logger.info('Querying Airtable for real-time employee data', {
        phone: normalizedPhone,
        type: 'airtable_query_phone'
      });
      
      const employeeRecord = await airtableClient.findEmployeeByPhone(normalizedPhone);
      
      if (!employeeRecord) {
        logger.info('Phone authentication failed - not found', {
          phone: normalizedPhone,
          duration: Date.now() - startTime,
          type: 'auth_failed_phone'
        });
        
        return {
          success: false,
          error: 'Phone number not found in system'
        };
      }
      
      // Transform the employee (no caching)
      const employee = transformEmployeeRecord(employeeRecord);
      
      // Check if employee is active
      if (!employee.active) {
        logger.warn('Inactive employee authentication attempt', {
          phone: normalizedPhone,
          employeeId: employee.id,
          employeeName: employee.name,
          type: 'auth_inactive_employee'
        });
        
        return {
          success: false,
          error: 'Employee account is inactive'
        };
      }
      
      // Don't pre-select provider for multi-provider employees
      // Provider selection will be handled in the FSM provider_selection phase
      
      logger.info('Phone authentication successful', {
        phone: normalizedPhone,
        employeeId: employee.id,
        employeeName: employee.name,
        duration: Date.now() - startTime,
        type: 'auth_success_phone'
      });
      
      return {
        success: true,
        employee,
        provider: null // Don't pre-select provider
      };
      
    } catch (error) {
      logger.error('Phone authentication error', {
        phone: normalizedPhone,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'auth_error_phone'
      });
      
      return {
        success: false,
        error: 'System error during phone authentication'
      };
    }
  }

  /**
   * Authenticate employee by PIN
   */
  async authenticateByPin(pin: number): Promise<AuthResult> {
    const startTime = Date.now();
    
    logger.info('PIN authentication attempt', {
      pin,
      type: 'auth_attempt_pin'
    });

    try {
      // Always query Airtable directly for real-time data accuracy
      logger.info('Querying Airtable for real-time employee data', {
        pin,
        type: 'airtable_query_pin'
      });
      
      const employeeRecord = await airtableClient.findEmployeeByPin(pin);
      
      if (!employeeRecord) {
        logger.info('PIN authentication failed - not found', {
          pin,
          duration: Date.now() - startTime,
          type: 'auth_failed_pin'
        });
        
        return {
          success: false,
          error: 'Employee PIN not found in system'
        };
      }
      
      // Transform the employee (no caching)
      const employee = transformEmployeeRecord(employeeRecord);
      
      // Check if employee is active
      if (!employee.active) {
        logger.warn('Inactive employee authentication attempt', {
          pin,
          employeeId: employee.id,
          employeeName: employee.name,
          type: 'auth_inactive_employee'
        });
        
        return {
          success: false,
          error: 'Employee account is inactive'
        };
      }
      
      // Don't pre-select provider for multi-provider employees
      // Provider selection will be handled in the FSM provider_selection phase
      
      logger.info('PIN authentication successful', {
        pin,
        employeeId: employee.id,
        employeeName: employee.name,
        duration: Date.now() - startTime,
        type: 'auth_success_pin'
      });
      
      return {
        success: true,
        employee,
        provider: null // Don't pre-select provider
      };
      
    } catch (error) {
      logger.error('PIN authentication error', {
        pin,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'auth_error_pin'
      });
      
      return {
        success: false,
        error: 'System error during PIN authentication'
      };
    }
  }

  /**
   * Get provider information for an employee
   */
  async getEmployeeProvider(employee: Employee): Promise<Provider | null> {
    if (!employee.providerId) {
      logger.warn('Employee has no provider ID', {
        employeeId: employee.id,
        employeeName: employee.name,
        type: 'employee_no_provider'
      });
      return null;
    }

    try {
      // Always query Airtable directly for real-time data accuracy
      logger.info('Querying Airtable for real-time provider data', {
        providerId: employee.providerId,
        type: 'airtable_query_provider'
      });
      
      const providerRecord = await airtableClient.getProviderById(employee.providerId);
      
      if (!providerRecord) {
        logger.warn('Provider not found', {
          providerId: employee.providerId,
          employeeId: employee.id,
          type: 'provider_not_found'
        });
        return null;
      }
      
      // Transform the provider (no caching)
      const provider = transformProviderRecord(providerRecord);
      
      return provider;
      
    } catch (error) {
      logger.error('Provider lookup error', {
        providerId: employee.providerId,
        employeeId: employee.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'provider_lookup_error'
      });
      
      return null;
    }
  }

  /**
   * Validate that a phone number matches an employee's registered phone
   */
  validateEmployeePhone(employee: Employee, incomingPhone: string): boolean {
    const normalizedIncoming = normalizePhoneNumber(incomingPhone);
    return phoneNumbersEqual(employee.phone, normalizedIncoming);
  }

  /**
   * Check if employee has access to a specific job template
   */
  hasJobAccess(employee: Employee, jobTemplateId: string): boolean {
    return employee.jobTemplateIds.includes(jobTemplateId);
  }

  /**
   * Get employee by ID (useful for lookups from cached data)
   */
  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    try {
      // Try cache first
      const cached = await EmployeeCache.getById(employeeId);
      if (cached) return cached;
      
      // This would require a direct record lookup
      // For now, we don't implement this as it's not needed for Phase 1
      logger.warn('Employee lookup by ID not implemented', {
        employeeId,
        type: 'employee_lookup_not_implemented'
      });
      
      return null;
    } catch (error) {
      logger.error('Employee lookup by ID error', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'employee_lookup_error'
      });
      
      return null;
    }
  }

  /**
   * Health check for employee service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test Airtable connectivity
      const airtableHealth = await airtableClient.healthCheck();
      
      if (!airtableHealth.healthy) {
        return {
          healthy: false,
          message: 'Airtable connection failed',
          details: airtableHealth
        };
      }
      
      // Test cache connectivity (try to set and get a test value)
      const testKey = 'health:test';
      const testValue = { test: true, timestamp: Date.now() };
      
      await EmployeeCache.setById(testKey, testValue as any, 10); // 10 second TTL
      const retrieved = await EmployeeCache.getById(testKey);
      
      if (!retrieved) {
        return {
          healthy: false,
          message: 'Cache connectivity failed'
        };
      }
      
      return {
        healthy: true,
        message: 'Employee service healthy',
        details: {
          airtable: airtableHealth,
          cache: 'operational'
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Employee service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const employeeService = new EmployeeService();
