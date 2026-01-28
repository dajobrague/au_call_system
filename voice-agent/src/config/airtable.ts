/**
 * Airtable Configuration
 * Centralized configuration for Airtable API and caching
 */

import type { AirtableConfig } from '../services/airtable/types';

// Read Airtable configuration from environment
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Validate required environment variables
if (!AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY environment variable is required');
}

if (!AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID environment variable is required');
}

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  EMPLOYEE: 3600,      // 1 hour - employee data changes infrequently
  PROVIDER: 14400,     // 4 hours - provider info is very stable
  JOB_TEMPLATE: 1800,  // 30 minutes - job templates may change more often
  PATIENT: 7200,       // 2 hours - patient info is relatively stable
} as const;

// Airtable table names
export const AIRTABLE_TABLES = {
  EMPLOYEES: 'Employees',
  PROVIDERS: 'Providers', 
  JOB_TEMPLATES: 'Job Templates',
  PATIENTS: 'Patients',
  CALL_LOGS: 'Call Logs',
} as const;

// Main Airtable configuration
export const airtableConfig: AirtableConfig = {
  apiKey: AIRTABLE_API_KEY,
  baseId: AIRTABLE_BASE_ID,
  cache: {
    employeeTTL: CACHE_TTL.EMPLOYEE,
    providerTTL: CACHE_TTL.PROVIDER,
    jobTemplateTTL: CACHE_TTL.JOB_TEMPLATE,
    patientTTL: CACHE_TTL.PATIENT,
  },
};

// API endpoints
export const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Request timeout (in milliseconds)
// Increased to handle Airtable being under load or rate-limited
export const REQUEST_TIMEOUT = 8000; // 8 seconds

// Maximum records to fetch in a single request
export const MAX_RECORDS_PER_REQUEST = 100;

// Retry configuration
// Airtable rate limit: 5 requests/second per base
// Conservative retry strategy to avoid hitting rate limits
export const RETRY_CONFIG = {
  maxRetries: 2, // Only 2 retries (3 total attempts) to reduce load
  retryDelay: 2000, // 2 seconds base delay to respect rate limits
  backoffMultiplier: 2.5, // Longer backoff: 2s, 5s
} as const;

/**
 * Validate Airtable configuration
 */
export function validateAirtableConfig(): void {
  if (!airtableConfig.apiKey || !airtableConfig.baseId) {
    throw new Error('Airtable configuration is incomplete. Check AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables.');
  }
  
  // Validate API key format (should start with 'key' or 'pat')
  if (!airtableConfig.apiKey.startsWith('key') && !airtableConfig.apiKey.startsWith('pat')) {
    throw new Error('Invalid Airtable API key format. API key should start with "key" or "pat".');
  }
  
  // Validate base ID format (should start with 'app')
  if (!airtableConfig.baseId.startsWith('app')) {
    throw new Error('Invalid Airtable base ID format. Base ID should start with "app".');
  }
}

// Validate configuration on module load
validateAirtableConfig();
