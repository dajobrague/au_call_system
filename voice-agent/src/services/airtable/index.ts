/**
 * Airtable Services - Main Export
 * Centralized exports for all Airtable-related services
 */

// Core client and caching
export { airtableClient } from './client';
export { 
  airtableCacheService, 
  EmployeeCache, 
  ProviderCache, 
  JobTemplateCache, 
  PatientCache 
} from './cache-service';

// High-level services
export { employeeService } from './employee-service';
export { jobService } from './job-service';
export { jobOccurrenceService } from './job-occurrence-service';
export { multiProviderService } from './multi-provider-service';
export * from './call-log-service';

// Types
export type {
  Employee,
  Provider,
  JobTemplate,
  Patient,
  JobOccurrence,
  AuthResult,
  EmployeeRecord,
  ProviderRecord,
  JobTemplateRecord,
  PatientRecord,
  JobOccurrenceRecord,
  EmployeeFields,
  ProviderFields,
  JobTemplateFields,
  PatientFields,
  JobOccurrenceFields,
  AirtableRecord,
  AirtableResponse,
  QueryOptions,
  CacheConfig,
  AirtableConfig
} from './types';

// Utilities
export { normalizePhoneNumber, phoneNumbersEqual, extractTwilioPhoneNumber } from '../../utils/phone-formatter';
