/**
 * Airtable Client for Provider Portal
 * Reuses configuration and client from voice-agent
 */

import https from 'https';

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
  fields: Record<string, any>;
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
  } = {}
): Promise<AirtableResponse> {
  return new Promise((resolve, reject) => {
    const { filterByFormula, maxRecords, fields } = options;
    
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
    fields: ['Display Name', 'Phone', 'Active', 'Notes']
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
    fields: ['Job Code', 'Title', 'Service Type', 'Priority', 'Patient', 'Active']
  });
  
  return response.records;
}

/**
 * Get job occurrences for a provider
 */
export async function getOccurrencesByProvider(providerId: string): Promise<AirtableRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider) (from Job Template)}))`;
  
  const response = await makeAirtableRequest('Job Occurrences', {
    filterByFormula: filterFormula,
    maxRecords: 100,
    fields: [
      'Patient TXT',
      'Employee TXT',
      'Scheduled At',
      'Time',
      'Status'
    ]
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
 * Get reports for a provider (assuming there's a Reports table)
 */
export async function getReportsByProvider(providerId: string): Promise<AirtableRecord[]> {
  // Check if Reports table exists, otherwise return empty array
  try {
    const filterFormula = `FIND('${providerId}', ARRAYJOIN({recordId (from Provider)}))`;
    
    const response = await makeAirtableRequest('Reports', {
      filterByFormula: filterFormula,
      maxRecords: 100,
      fields: ['Name', 'Created At', 'Type', 'PDF URL']
    });
    
    return response.records;
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
}

