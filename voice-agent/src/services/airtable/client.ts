/**
 * Core Airtable API Client
 * Handles all direct communication with Airtable API
 */

import https from 'https';
import { logger } from '../../lib/logger';
import { airtableConfig, AIRTABLE_API_BASE, REQUEST_TIMEOUT, MAX_RECORDS_PER_REQUEST, RETRY_CONFIG } from '../../config/airtable';
import type { 
  AirtableResponse, 
  AirtableError, 
  QueryOptions,
  EmployeeRecord,
  ProviderRecord,
  JobTemplateRecord,
  PatientRecord,
  JobOccurrenceRecord,
  JobOccurrenceFields
} from './types';

/**
 * HTTP request helper for Airtable API
 */
function makeAirtableRequest<T>(
  tableName: string, 
  options: QueryOptions = {}
): Promise<AirtableResponse<T>> {
  return new Promise((resolve, reject) => {
    const { filterByFormula, maxRecords, fields, sort, view } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filterByFormula) {
      params.append('filterByFormula', filterByFormula);
    }
    
    if (maxRecords) {
      params.append('maxRecords', Math.min(maxRecords, MAX_RECORDS_PER_REQUEST).toString());
    }
    
    if (fields && fields.length > 0) {
      fields.forEach(field => params.append('fields[]', field));
    }
    
    if (sort && sort.length > 0) {
      sort.forEach((sortOption, index) => {
        params.append(`sort[${index}][field]`, sortOption.field);
        params.append(`sort[${index}][direction]`, sortOption.direction);
      });
    }
    
    if (view) {
      params.append('view', view);
    }

    const queryString = params.toString();
    const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent(tableName)}${queryString ? '?' + queryString : ''}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${airtableConfig.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAgent/1.0',
      },
      timeout: REQUEST_TIMEOUT,
    };

    logger.info('Airtable API request', {
      table: tableName,
      path,
      filterByFormula,
      maxRecords,
      type: 'airtable_request'
    });

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          // Check for API errors
          if (jsonData.error) {
            const error = jsonData.error as AirtableError;
            logger.error('Airtable API error', {
              table: tableName,
              error: error.message,
              type: error.type,
              status: res.statusCode,
              type_log: 'airtable_api_error'
            });
            reject(new Error(`Airtable API error: ${error.message}`));
            return;
          }
          
          logger.info('Airtable API response', {
            table: tableName,
            recordCount: jsonData.records?.length || 0,
            status: res.statusCode,
            type: 'airtable_response'
          });
          
          resolve(jsonData as AirtableResponse<T>);
        } catch (parseError) {
          logger.error('Airtable response parse error', {
            table: tableName,
            error: parseError instanceof Error ? parseError.message : 'Parse error',
            rawData: data.substring(0, 200),
            type: 'airtable_parse_error'
          });
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Airtable request error', {
        table: tableName,
        error: error.message,
        type: 'airtable_request_error'
      });
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      logger.error('Airtable request timeout', {
        table: tableName,
        timeout: REQUEST_TIMEOUT,
        type: 'airtable_timeout'
      });
      reject(new Error(`Airtable request timeout after ${REQUEST_TIMEOUT}ms`));
    });

    req.end();
  });
}

/**
 * Retry wrapper for API requests
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error = new Error('No attempts made');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        logger.error('Airtable operation failed after retries', {
          context,
          attempts: attempt + 1,
          error: lastError.message,
          type: 'airtable_retry_exhausted'
        });
        break;
      }
      
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
      
      logger.warn('Airtable operation retry', {
        context,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        error: lastError.message,
        type: 'airtable_retry'
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Core Airtable Client
 */
export class AirtableClient {
  /**
   * Find employee by phone number
   */
  async findEmployeeByPhone(phone: string): Promise<EmployeeRecord | null> {
    const filterFormula = `{Phone} = '${phone}'`;
    
    return withRetry(async () => {
      const response = await makeAirtableRequest<EmployeeRecord['fields']>('Employees', {
        filterByFormula: filterFormula,
        maxRecords: 1,
        fields: ['Display Name', 'Employee PIN', 'Provider', 'Phone', 'Job Templates', 'Active', 'Notes']
      });
      
      return response.records.length > 0 ? response.records[0] as EmployeeRecord : null;
    }, `findEmployeeByPhone(${phone})`);
  }

  /**
   * Find employee by PIN
   */
  async findEmployeeByPin(pin: number): Promise<EmployeeRecord | null> {
    const filterFormula = `{Employee PIN} = ${pin}`;
    
    return withRetry(async () => {
      const response = await makeAirtableRequest<EmployeeRecord['fields']>('Employees', {
        filterByFormula: filterFormula,
        maxRecords: 1,
        fields: ['Display Name', 'Employee PIN', 'Provider', 'Phone', 'Job Templates', 'Active', 'Notes']
      });
      
      return response.records.length > 0 ? response.records[0] as EmployeeRecord : null;
    }, `findEmployeeByPin(${pin})`);
  }

  /**
   * Get provider by record ID
   */
  async getProviderById(providerId: string): Promise<ProviderRecord | null> {
    return withRetry(async () => {
      // For single record lookup by ID, we use the direct record endpoint
      const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Providers')}/${providerId}`;
      
      return new Promise<ProviderRecord | null>((resolve, reject) => {
        const requestOptions = {
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VoiceAgent/1.0',
          },
          timeout: REQUEST_TIMEOUT,
        };

        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.error) {
                if (jsonData.error.type === 'NOT_FOUND') {
                  resolve(null);
                  return;
                }
                
                logger.error('Provider lookup error', {
                  providerId,
                  error: jsonData.error.message,
                  type: 'airtable_provider_error'
                });
                reject(new Error(`Provider lookup error: ${jsonData.error.message}`));
                return;
              }
              
              resolve(jsonData as ProviderRecord);
            } catch (parseError) {
              reject(new Error(`Failed to parse provider response: ${parseError}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Provider lookup timeout'));
        });

        req.end();
      });
    }, `getProviderById(${providerId})`);
  }

  /**
   * Find job template by job code
   */
  async findJobTemplateByCode(jobCode: string): Promise<JobTemplateRecord | null> {
    const filterFormula = `{Job Code} = '${jobCode}'`;
    
    return withRetry(async () => {
      const response = await makeAirtableRequest<JobTemplateRecord['fields']>('Job Templates', {
        filterByFormula: filterFormula,
        maxRecords: 1,
        fields: [
          'Job Code', 'Title', 'Service Type', 'Priority', 
          'Time Window Start', 'Time Window End', 'Patient', 
          'Provider', 'Default Employee', 'Active', 'Unique Job Number',
          'Occurrences' // Include the occurrences field
        ]
      });
      
      return response.records.length > 0 ? response.records[0] as JobTemplateRecord : null;
    }, `findJobTemplateByCode(${jobCode})`);
  }

  /**
   * Get patient by record ID
   */
  async getPatientById(patientId: string): Promise<PatientRecord | null> {
    return withRetry(async () => {
      const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Patients')}/${patientId}`;
      
      return new Promise<PatientRecord | null>((resolve, reject) => {
        const requestOptions = {
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VoiceAgent/1.0',
          },
          timeout: REQUEST_TIMEOUT,
        };

        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.error) {
                if (jsonData.error.type === 'NOT_FOUND') {
                  resolve(null);
                  return;
                }
                
                logger.error('Patient lookup error', {
                  patientId,
                  error: jsonData.error.message,
                  type: 'airtable_patient_error'
                });
                reject(new Error(`Patient lookup error: ${jsonData.error.message}`));
                return;
              }
              
              resolve(jsonData as PatientRecord);
            } catch (parseError) {
              reject(new Error(`Failed to parse patient response: ${parseError}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Patient lookup timeout'));
        });

        req.end();
      });
    }, `getPatientById(${patientId})`);
  }

  /**
   * Find future job occurrences for a job template and employee
   */
  async findFutureOccurrences(jobTemplateId: string, employeeId: string): Promise<JobOccurrenceRecord[]> {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Build complex filter formula for future occurrences
    const filterFormula = `AND(
      {Status} = 'Scheduled',
      {Scheduled At} >= '${today}',
      FIND('${employeeId}', ARRAYJOIN({Assigned Employee})),
      FIND('${jobTemplateId}', ARRAYJOIN({Job Template}))
    )`;
    
    return withRetry(async () => {
      const response = await makeAirtableRequest<JobOccurrenceRecord['fields']>('Job Occurrences', {
        filterByFormula: filterFormula,
        maxRecords: 3, // Only get next 3 future occurrences
        fields: [
          'Occurrence ID', 'Job Template', 'Scheduled At', 'Status',
          'Assigned Employee', 'Occurrence Label', 'Provider', 'Patient', 'Time'
        ],
        sort: [{ field: 'Scheduled At', direction: 'asc' }] // Earliest first
      });
      
      return response.records as JobOccurrenceRecord[];
    }, `findFutureOccurrences(${jobTemplateId}, ${employeeId})`);
  }

  /**
   * Get job occurrence by ID
   */
  async getJobOccurrenceById(occurrenceId: string): Promise<JobOccurrenceRecord | null> {
    return withRetry(async () => {
      const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Job Occurrences')}/${occurrenceId}`;
      
      return new Promise<JobOccurrenceRecord | null>((resolve, reject) => {
        const requestOptions = {
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VoiceAgent/1.0',
          },
          timeout: REQUEST_TIMEOUT,
        };

        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.error) {
                if (jsonData.error.type === 'NOT_FOUND') {
                  resolve(null);
                  return;
                }
                
                logger.error('Job occurrence lookup error', {
                  occurrenceId,
                  error: jsonData.error.message,
                  type: 'airtable_occurrence_error'
                });
                reject(new Error(`Job occurrence lookup error: ${jsonData.error.message}`));
                return;
              }
              
              resolve(jsonData as JobOccurrenceRecord);
            } catch (parseError) {
              reject(new Error(`Failed to parse job occurrence response: ${parseError}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Job occurrence lookup timeout'));
        });

        req.end();
      });
    }, `getJobOccurrenceById(${occurrenceId})`);
  }

  /**
   * Update job occurrence record
   */
  async updateJobOccurrence(occurrenceId: string, updates: Partial<JobOccurrenceFields>): Promise<boolean> {
    return withRetry(async () => {
      const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Job Occurrences')}/${occurrenceId}`;
      
      const updateData = {
        fields: updates
      };
      
      return new Promise<boolean>((resolve, reject) => {
        const postData = JSON.stringify(updateData);
        
        const requestOptions = {
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VoiceAgent/1.0',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: REQUEST_TIMEOUT,
        };

        logger.info('Updating job occurrence', {
          occurrenceId,
          updates,
          type: 'airtable_update_occurrence'
        });

        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.error) {
                logger.error('Job occurrence update error', {
                  occurrenceId,
                  error: jsonData.error.message,
                  type: 'airtable_update_error'
                });
                reject(new Error(`Job occurrence update error: ${jsonData.error.message}`));
                return;
              }
              
              logger.info('Job occurrence updated successfully', {
                occurrenceId,
                updates,
                type: 'airtable_update_success'
              });
              
              resolve(true);
            } catch (parseError) {
              reject(new Error(`Failed to parse update response: ${parseError}`));
            }
          });
        });

        req.on('error', (error) => {
          logger.error('Job occurrence update request error', {
            occurrenceId,
            error: error.message,
            type: 'airtable_update_request_error'
          });
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          logger.error('Job occurrence update timeout', {
            occurrenceId,
            timeout: REQUEST_TIMEOUT,
            type: 'airtable_update_timeout'
          });
          reject(new Error('Job occurrence update timeout'));
        });

        req.write(postData);
        req.end();
      });
    }, `updateJobOccurrence(${occurrenceId})`);
  }

  /**
   * Find employees by provider ID
   */
  async findEmployeesByProvider(providerId: string): Promise<EmployeeRecord[]> {
    const filterFormula = `FIND('${providerId}', ARRAYJOIN({Provider}))`;
    
    return withRetry(async () => {
      const response = await makeAirtableRequest<EmployeeRecord['fields']>('Employees', {
        filterByFormula: filterFormula,
        maxRecords: 50, // Get up to 50 employees per provider
        fields: ['Display Name', 'Employee PIN', 'Provider', 'Phone', 'Job Templates', 'Active', 'Notes']
      });
      
      return response.records as EmployeeRecord[];
    }, `findEmployeesByProvider(${providerId})`);
  }

  /**
   * Health check - test Airtable connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connectivity
      await makeAirtableRequest('Employees', {
        maxRecords: 1,
        fields: ['Display Name']
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        message: 'Airtable connection successful',
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      };
    }
  }
}

// Export singleton instance
export const airtableClient = new AirtableClient();
