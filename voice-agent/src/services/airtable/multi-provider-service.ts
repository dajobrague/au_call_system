/**
 * Multi-Provider Service
 * Handles employees who work for multiple healthcare providers
 */

import { airtableClient } from './client';
import { logger } from '../../lib/logger';
import type { Employee, Provider, ProviderRecord } from './types';

/**
 * Transform provider record for multi-provider context
 */
function transformProviderForSelection(record: ProviderRecord, index: number): ProviderSelectionOption {
  const fields = record.fields;
  
  return {
    id: record.id,
    name: fields['Name'] || 'Unknown Provider',
    providerId: fields['Provider ID'] || 0,
    greeting: fields['Greeting (IVR)'],
    selectionNumber: index + 1, // 1-based selection (Press 1, Press 2, etc.)
    active: fields['Active'] !== false,
  };
}

/**
 * Provider selection option for voice menus
 */
export interface ProviderSelectionOption {
  id: string;
  name: string;
  providerId: number;
  greeting?: string;
  selectionNumber: number; // 1, 2, 3, etc.
  active: boolean;
}

/**
 * Multi-provider detection result
 */
export interface MultiProviderResult {
  hasMultipleProviders: boolean;
  providers: ProviderSelectionOption[];
  totalProviders: number;
}

/**
 * Multi-Provider Service Class
 */
export class MultiProviderService {
  /**
   * Check if employee works for multiple providers and get provider options
   */
  async getEmployeeProviders(employee: Employee): Promise<MultiProviderResult> {
    const startTime = Date.now();
    
    logger.info('Multi-provider check', {
      employeeId: employee.id,
      employeeName: employee.name,
      employeePin: employee.pin,
      singleProviderId: employee.providerId, // Current single provider from auth
      type: 'multi_provider_check_start'
    });

    try {
      // For multi-provider employees, the employee.providerId might be just the first one
      // We need to get the full employee record to see all providers
      const employeeRecord = await airtableClient.findEmployeeByPin(employee.pin);
      
      if (!employeeRecord || !employeeRecord.fields['Provider']) {
        logger.warn('Could not get employee provider list', {
          employeeId: employee.id,
          employeePin: employee.pin,
          type: 'multi_provider_no_data'
        });
        
        // Fallback to single provider
        return {
          hasMultipleProviders: false,
          providers: [],
          totalProviders: 1
        };
      }
      
      const providerIds = employeeRecord.fields['Provider'] || [];
      
      if (providerIds.length <= 1) {
        logger.info('Employee has single provider', {
          employeeId: employee.id,
          employeeName: employee.name,
          providerCount: providerIds.length,
          type: 'multi_provider_single'
        });
        
        // Fetch the single provider's details
        let singleProvider = null;
        if (providerIds.length === 1) {
          const providerRecord = await airtableClient.getProviderById(providerIds[0]);
          if (providerRecord && providerRecord.fields['Active'] !== false) {
            singleProvider = transformProviderForSelection(providerRecord, 0);
          }
        }
        
        return {
          hasMultipleProviders: false,
          providers: singleProvider ? [singleProvider] : [],
          totalProviders: providerIds.length
        };
      }
      
      // Employee has multiple providers - fetch provider details
      logger.info('Employee has multiple providers', {
        employeeId: employee.id,
        employeeName: employee.name,
        providerCount: providerIds.length,
        providerIds,
        type: 'multi_provider_detected'
      });
      
      // Fetch all provider records in parallel
      const providerPromises = providerIds.map(providerId => 
        airtableClient.getProviderById(providerId)
      );
      
      const providerRecords = await Promise.all(providerPromises);
      
      // Filter out null records and transform to selection options
      const validProviders = providerRecords
        .filter(record => record !== null)
        .filter(record => record!.fields['Active'] !== false) // Only active providers
        .map((record, index) => transformProviderForSelection(record!, index));
      
      const duration = Date.now() - startTime;
      
      logger.info('Multi-provider analysis complete', {
        employeeId: employee.id,
        employeeName: employee.name,
        totalProviders: providerIds.length,
        activeProviders: validProviders.length,
        providerNames: validProviders.map(p => p.name),
        duration,
        type: 'multi_provider_analysis_complete'
      });
      
      return {
        hasMultipleProviders: validProviders.length > 1,
        providers: validProviders,
        totalProviders: validProviders.length
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Multi-provider analysis error', {
        employeeId: employee.id,
        employeePin: employee.pin,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'multi_provider_error'
      });
      
      // Fallback to single provider on error
      return {
        hasMultipleProviders: false,
        providers: [],
        totalProviders: 1
      };
    }
  }

  /**
   * Generate dynamic provider selection message
   */
  generateProviderSelectionMessage(providers: ProviderSelectionOption[]): string {
    if (providers.length === 0) {
      return 'No active providers found. Connecting you with a representative.';
    }
    
    if (providers.length === 1) {
      return `Continuing with ${providers[0].name}.`;
    }
    
    const providerOptions = providers.map(provider => 
      `Press ${provider.selectionNumber} for ${provider.name}`
    ).join(', ');
    
    return `I see you work for multiple providers. ${providerOptions}.`;
  }

  /**
   * Validate provider selection
   */
  validateProviderSelection(providers: ProviderSelectionOption[], selection: string): ProviderSelectionOption | null {
    const selectionNum = parseInt(selection, 10);
    
    if (isNaN(selectionNum) || selectionNum < 1 || selectionNum > providers.length) {
      return null;
    }
    
    return providers.find(p => p.selectionNumber === selectionNum) || null;
  }

  /**
   * Filter job templates by provider
   * This will be used to show only jobs relevant to the selected provider
   */
  async filterJobTemplatesByProvider(jobTemplateIds: string[], providerId: string): Promise<string[]> {
    // For now, return all job templates
    // In a more complex system, you'd filter based on provider relationships
    logger.info('Job template filtering by provider', {
      providerId,
      totalJobTemplates: jobTemplateIds.length,
      type: 'job_template_provider_filter'
    });
    
    return jobTemplateIds;
  }

  /**
   * Health check for multi-provider service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test with David Bracho (known multi-provider employee)
      const testEmployee = {
        id: 'recW1CXg3O5I3oR0g',
        name: 'David Bracho',
        pin: 2001,
        phone: '+522281957913',
        providerId: 'recexHQJ13oafJkxZ',
        jobTemplateIds: [],
        active: true
      };
      
      const result = await this.getEmployeeProviders(testEmployee);
      
      return {
        healthy: true,
        message: 'Multi-provider service healthy',
        details: {
          testEmployee: 'David Bracho',
          hasMultipleProviders: result.hasMultipleProviders,
          providerCount: result.totalProviders
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Multi-provider service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const multiProviderService = new MultiProviderService();
