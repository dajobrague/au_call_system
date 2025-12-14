/**
 * Airtable Client for Provider Portal
 * Reuses configuration and client from voice-agent
 */

import https from 'https';
import { airtableDateToYYYYMMDD } from './timezone-utils';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const USER_TABLE_ID = process.env.USER_TABLE_ID || 'tblLiBIYIt9jDwQGT';

if (!AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY environment variable is required');
}

if (!AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID environment variable is required');
}

const REQUEST_TIMEOUT = 5000;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

/**
 * Make a request to Airtable API
 */
function makeAirtableRequest(
  tableName: string,
  options: {
    filterByFormula?: string;
    maxRecords?: number;
    fields?: string[];
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  } = {}
): Promise<AirtableResponse> {
  return new Promise((resolve, reject) => {
    const { filterByFormula, maxRecords, fields, sort } = options;
    
    const params = new URLSearchParams();
    
    if (filterByFormula) {
      params.append('filterByFormula', filterByFormula);
    }
    
    if (maxRecords) {
      params.append('maxRecords', maxRecords.toString());
    }
    
    if (fields && fields.length > 0) {
      fields.forEach(field => params.append('fields[]', field));
    }
    
    if (sort && sort.length > 0) {
      sort.forEach((sortItem, index) => {
        params.append(`sort[${index}][field]`, sortItem.field);
        params.append(`sort[${index}][direction]`, sortItem.direction);
      });
    }

    const queryString = params.toString();
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}${queryString ? '?' + queryString : ''}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
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
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData as AirtableResponse);
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Airtable request timeout after ${REQUEST_TIMEOUT}ms`));
    });

    req.end();
  });
}

/**
 * Get a single record by ID
 */
function getRecordById(tableName: string, recordId: string): Promise<AirtableRecord | null> {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
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
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData as AirtableRecord);
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Record lookup timeout'));
    });

    req.end();
  });
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<AirtableRecord | null> {
  const filterFormula = `{Email} = '${email.replace(/'/g, "\\'")}'`;
  
  const response = await makeAirtableRequest(USER_TABLE_ID, {
    filterByFormula: filterFormula,
    maxRecords: 1,
    fields: ['Email', 'Pass', 'First Name', 'Provider']
  });
  
  return response.records.length > 0 ? response.records[0] : null;
}

/**
 * Get provider ID from user record
 */
export function getProviderIdFromUser(user: AirtableRecord): string | null {
  const provider = user.fields.Provider;
  if (Array.isArray(provider) && provider.length > 0) {
    return provider[0]; // Provider is a linked record, get first ID
  }
  return null;
}

/**
 * Find records by provider ID
 */
export async function findRecordsByProvider(
  tableName: string,
  providerId: string,
  fields?: string[]
): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({Provider}))`;
  
  const response = await makeAirtableRequest(tableName, {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields
  });
  
  return response.records;
}

/**
 * Get provider details by ID
 */
export async function getProviderById(providerId: string): Promise<AirtableRecord | null> {
  return getRecordById('Providers', providerId);
}

/**
 * Get provider with logo
 */
export async function getProviderWithLogo(providerId: string): Promise<AirtableRecord | null> {
  const provider = await getRecordById('Providers', providerId);
  return provider;
}

/**
 * Get employees for a provider
 */
export async function getEmployeesByProvider(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
  
  const response = await makeAirtableRequest('Employees', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: ['Display Name', 'Phone', 'Employee PIN', 'Email', 'Role', 'Active', 'Notes']
  });
  
  return response.records;
}

/**
 * Get patients for a provider
 */
export async function getPatientsByProvider(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
  
  const response = await makeAirtableRequest('Patients', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: ['Patient Full Name', 'Phone', 'Address', 'Important Notes']
  });
  
  return response.records;
}

/**
 * Get job templates for a provider
 */
export async function getJobTemplatesByProvider(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
  
  const response = await makeAirtableRequest('Job Templates', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: [
      'Job Code', 
      'Title', 
      'Service Type', 
      'Priority', 
      'Patient', 
      'Active',
      'Time Window Start',
      'Time Window End',
      'Default Employee'
    ]
  });
  
  return response.records;
}

/**
 * Get job occurrences for a provider
 */
export async function getOccurrencesByProvider(providerId: string): Promise<AirtableRecord[]> {
  // Filter by provider through multiple paths:
  // 1. Job Template (for template-based occurrences)
  // 2. Assigned Employee (for manual occurrences without template)
  const filterFormula = `OR(
    FIND('${providerId}', ARRAYJOIN({recordId (from Provider) (from Job Template)})),
    FIND('${providerId}', ARRAYJOIN({recordId (from Provider) (from Assigned Employee)}))
  )`;
  
  const response = await makeAirtableRequest('Job Occurrences', {
    filterByFormula: filterFormula,
    maxRecords: 1000,
    fields: [
      'Patient TXT',
      'Employee TXT',
      'Scheduled At',
      'Time',
      'Time Window End',
      'Status',
      'Patient (Link)',
      'Assigned Employee',
      'Job Template'
    ],
    sort: [{ field: 'Scheduled At', direction: 'desc' }]
  });
  
  return response.records;
}

/**
 * Get call logs for a provider
 */
export async function getCallLogsByProvider(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
  
  const response = await makeAirtableRequest('Call Logs', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: ['Call SID', 'From', 'To', 'Status', 'Duration', 'Start Time', 'Employee', 'Recording URL']
  });
  
  return response.records;
}

/**
 * Get reports for a provider with optional date filtering
 */
export async function getReportsByProvider(
  providerId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<AirtableRecord[]> {
  try {
    let filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
    
    // Add date range filtering if provided
    // Using >= and <= for inclusive date ranges
    if (startDate && endDate) {
      filterFormula = `AND(${filterFormula}, IS_AFTER(OR(IS_SAME({Date}, '${startDate}'), IS_AFTER({Date}, '${startDate}'))), IS_BEFORE(OR(IS_SAME({Date}, '${endDate}'), IS_BEFORE({Date}, '${endDate}'))))`;
    } else if (startDate) {
      filterFormula = `AND(${filterFormula}, OR(IS_SAME({Date}, '${startDate}'), IS_AFTER({Date}, '${startDate}')))`;
    } else if (endDate) {
      filterFormula = `AND(${filterFormula}, OR(IS_SAME({Date}, '${endDate}'), IS_BEFORE({Date}, '${endDate}')))`;
    }
    
    const response = await makeAirtableRequest('Reports', {
      filterByFormula: filterFormula,
      maxRecords: 1000,
      fields: ['Name', 'Date', 'PDF', 'Provider']
    });
    
    // Additional client-side filtering to ensure correct date range (backup)
    let filteredRecords = response.records;
    if (startDate || endDate) {
      filteredRecords = response.records.filter((record: AirtableRecord) => {
        const recordDate = record.fields.Date as string;
        if (!recordDate) return false;
        
        if (startDate && endDate) {
          return recordDate >= startDate && recordDate <= endDate;
        } else if (startDate) {
          return recordDate >= startDate;
        } else if (endDate) {
          return recordDate <= endDate;
        }
        return true;
      });
    }
    
    // Sort by date descending (most recent first)
    const sortedRecords = filteredRecords.sort((a, b) => {
      const dateA = new Date(a.fields.Date as string);
      const dateB = new Date(b.fields.Date as string);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedRecords;
  } catch (err) {
    console.error('Error fetching reports:', err);
    return [];
  }
}

/**
 * Get call logs for a provider within a date range
 */
export async function getCallLogsByDateRange(
  providerId: string,
  startDate: string,
  endDate: string
): Promise<AirtableRecord[]> {
  try {
    // Filter by provider only - we'll do date filtering client-side
    const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
    
    const response = await makeAirtableRequest('Call Logs', {
      filterByFormula: filterFormula,
      maxRecords: 1000,
      fields: [
        'CallSid',
        'Provider',
        'Employee',
        'Patient',
        'Direction',
        'Started At',
        'Ended At',
        'Detected Intent/Action',
        'Seconds',
        'Recording URL (Twilio/S3)',
        'Notes',
        'recordId (from Provider)'
      ]
    });
    
    // Parse the date range - we're comparing against dates in DD/MM/YYYY format
    // So we need to compare just the date parts, not worry about timezones
    
    // Filter by date range in memory (since "Started At" is a text field with time)
    // Compare dates as strings to avoid timezone issues
    const filteredRecords = response.records.filter((record: AirtableRecord) => {
      const startedAt = record.fields['Started At'] as string;
      if (!startedAt) return false;
      
      try {
        // Use timezone utility to convert Airtable date to YYYY-MM-DD
        const recordDateStr = airtableDateToYYYYMMDD(startedAt);
        if (!recordDateStr) return false;
        
        // Compare date strings (YYYY-MM-DD format)
        return recordDateStr >= startDate && recordDateStr <= endDate;
      } catch (err) {
        console.warn('Failed to parse date:', startedAt, err);
        return false;
      }
    });
    
    // Sort by Started At descending (most recent first)
    const sortedRecords = filteredRecords.sort((a: AirtableRecord, b: AirtableRecord) => {
      const dateA = a.fields['Started At'] as string;
      const dateB = b.fields['Started At'] as string;
      return dateB.localeCompare(dateA);
    });
    
    return sortedRecords;
  } catch (err) {
    console.error('Error fetching call logs:', err);
    return [];
  }
}

/**
 * Update a record in Airtable
 */
function updateAirtableRecord(
  tableName: string,
  recordId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>
): Promise<AirtableRecord> {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    const bodyData = JSON.stringify({ fields });
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
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
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData as AirtableRecord);
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Update request timeout'));
    });

    req.write(bodyData);
    req.end();
  });
}

/**
 * Create a new record in Airtable
 */
function createAirtableRecord(
  tableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>
): Promise<AirtableRecord> {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
    const bodyData = JSON.stringify({ fields });
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
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
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData as AirtableRecord);
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Create request timeout'));
    });

    req.write(bodyData);
    req.end();
  });
}

/**
 * Delete a record from Airtable
 */
function deleteAirtableRecord(
  tableName: string,
  recordId: string
): Promise<{ deleted: boolean; id: string }> {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
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
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData as { deleted: boolean; id: string });
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Delete request timeout'));
    });

    req.end();
  });
}

/**
 * Update provider information
 */
export async function updateProvider(
  providerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Partial<Record<string, any>>
): Promise<AirtableRecord> {
  return updateAirtableRecord('Providers', providerId, fields);
}

/**
 * Create a new employee
 */
export async function createEmployee(
  fields: {
    'Display Name': string;
    'Phone': string;
    'Employee PIN': number;
    'Provider': string[];
    'Email'?: string;
    'Role'?: string;
    'Notes'?: string;
    'Active'?: boolean;
  }
): Promise<AirtableRecord> {
  return createAirtableRecord('Employees', fields);
}

/**
 * Update an employee
 */
export async function updateEmployee(
  recordId: string,
  fields: Partial<{
    'Display Name': string;
    'Phone': string;
    'Employee PIN': number;
    'Email': string;
    'Role': string;
    'Notes': string;
    'Active': boolean;
  }>
): Promise<AirtableRecord> {
  return updateAirtableRecord('Employees', recordId, fields);
}

/**
 * Delete an employee
 */
export async function deleteEmployee(recordId: string): Promise<{ deleted: boolean; id: string }> {
  return deleteAirtableRecord('Employees', recordId);
}

/**
 * Create a new patient
 */
export async function createPatient(
  fields: {
    'Patient Full Name': string;
    'Phone': string;
    'DOB': string;
    'Provider': string[];
    'Address'?: string;
    'Important Notes'?: string;
    'Active'?: boolean;
  }
): Promise<AirtableRecord> {
  return createAirtableRecord('Patients', fields);
}

/**
 * Update a patient
 */
export async function updatePatient(
  recordId: string,
  fields: Partial<{
    'Patient Full Name': string;
    'Phone': string;
    'DOB': string;
    'Address': string;
    'Important Notes': string;
    'Active': boolean;
  }>
): Promise<AirtableRecord> {
  return updateAirtableRecord('Patients', recordId, fields);
}

/**
 * Delete a patient
 */
export async function deletePatient(recordId: string): Promise<{ deleted: boolean; id: string }> {
  return deleteAirtableRecord('Patients', recordId);
}

/**
 * Create a new job occurrence
 */
export async function createOccurrence(
  fields: {
    patientRecordId: string;
    employeeRecordId: string;
    scheduledAt: string;
    time: string;
    timeWindowEnd: string;
  }
): Promise<AirtableRecord> {
  const occurrenceFields = {
    'Patient (Link)': [fields.patientRecordId],
    'Assigned Employee': [fields.employeeRecordId],
    'Scheduled At': fields.scheduledAt,
    'Time': fields.time,
    'Time Window End': fields.timeWindowEnd,
    'Status': 'Scheduled'
  };
  
  return createAirtableRecord('Job Occurrences', occurrenceFields);
}

/**
 * Update a job occurrence
 */
export async function updateOccurrence(
  recordId: string,
  fields: {
    patientRecordId?: string;
    employeeRecordId?: string;
    scheduledAt?: string;
    time?: string;
    timeWindowEnd?: string;
    status?: string;
  }
): Promise<AirtableRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFields: Record<string, any> = {};
  
  if (fields.patientRecordId) {
    updateFields['Patient (Link)'] = [fields.patientRecordId];
  }
  if (fields.employeeRecordId) {
    updateFields['Assigned Employee'] = [fields.employeeRecordId];
  }
  if (fields.scheduledAt) {
    updateFields['Scheduled At'] = fields.scheduledAt;
  }
  if (fields.time) {
    updateFields['Time'] = fields.time;
  }
  if (fields.timeWindowEnd) {
    updateFields['Time Window End'] = fields.timeWindowEnd;
  }
  if (fields.status) {
    updateFields['Status'] = fields.status;
  }
  
  return updateAirtableRecord('Job Occurrences', recordId, updateFields);
}

/**
 * Delete a job occurrence
 */
export async function deleteOccurrence(recordId: string): Promise<{ deleted: boolean; id: string }> {
  return deleteAirtableRecord('Job Occurrences', recordId);
}

/**
 * Get all users for a provider
 */
export async function getProviderUsers(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
  
  const response = await makeAirtableRequest('Provider Users', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: ['First Name', 'Last Name', 'Email', 'Phone', 'uuid', 'recordId (from Provider)']
  });
  
  return response.records;
}

/**
 * Get a specific provider user by record ID
 */
export async function getProviderUser(recordId: string): Promise<AirtableRecord> {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/Provider%20Users/${recordId}`;
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
      timeout: REQUEST_TIMEOUT,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.error) {
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          resolve(jsonData);
        } catch (err) {
          reject(err);
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
}

/**
 * Create a new provider user
 */
export async function createProviderUser(
  fields: {
    'First Name': string;
    'Last Name': string;
    'Email': string;
    'Phone': string;
    'Pass': string;
    'Provider': string[];
  }
): Promise<AirtableRecord> {
  return createAirtableRecord('Provider Users', fields);
}

/**
 * Update a provider user
 */
export async function updateProviderUser(
  recordId: string,
  fields: Partial<{
    'First Name': string;
    'Last Name': string;
    'Email': string;
    'Phone': string;
    'Pass': string;
  }>
): Promise<AirtableRecord> {
  return updateAirtableRecord('Provider Users', recordId, fields);
}

/**
 * Delete a provider user
 */
export async function deleteProviderUser(recordId: string): Promise<{ deleted: boolean; id: string }> {
  return deleteAirtableRecord('Provider Users', recordId);
}

/**
 * Create a new job template
 */
export async function createJobTemplate(
  fields: {
    'Title': string;
    'Service Type': string;
    'Priority': string;
    'Provider': string[];
    'Patient': string[];
    'Default Employee'?: string[];
    'Time Window Start'?: string;
    'Time Window End'?: string;
    'Active'?: boolean;
  }
): Promise<AirtableRecord> {
  return createAirtableRecord('Job Templates', fields);
}

/**
 * Update a job template
 */
export async function updateJobTemplate(
  recordId: string,
  fields: Partial<{
    'Title': string;
    'Service Type': string;
    'Priority': string;
    'Patient': string[];
    'Default Employee': string[];
    'Time Window Start': string;
    'Time Window End': string;
    'Active': boolean;
  }>
): Promise<AirtableRecord> {
  return updateAirtableRecord('Job Templates', recordId, fields);
}

/**
 * Delete a job template
 */
export async function deleteJobTemplate(recordId: string): Promise<{ deleted: boolean; id: string }> {
  return deleteAirtableRecord('Job Templates', recordId);
}

