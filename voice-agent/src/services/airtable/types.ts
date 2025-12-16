/**
 * Airtable API Types
 * Type definitions for Airtable records and API responses
 */

// Base Airtable record structure
export interface AirtableRecord<T = Record<string, any>> {
  id: string;
  fields: T;
  createdTime: string;
}

// API Response structure
export interface AirtableResponse<T = Record<string, any>> {
  records: AirtableRecord<T>[];
  offset?: string;
}

// API Error structure
export interface AirtableError {
  type: string;
  message: string;
}

// Employee record from Airtable
export interface EmployeeFields {
  'Display Name': string;
  'Employee PIN': number;
  'Provider': string[]; // Array of provider record IDs
  'Phone': string;
  'Notes'?: string;
  'Job Templates'?: string[]; // Array of job template record IDs
  'Active'?: boolean;
}

export type EmployeeRecord = AirtableRecord<EmployeeFields>;

// Provider record from Airtable
export interface ProviderFields {
  'Name': string;
  'Provider ID': number;
  'State'?: string;
  'Suburb'?: string;
  'Address'?: string;
  'Timezone'?: string;
  'Greeting (IVR)'?: string;
  'Transfer Number'?: string;
  'Logo'?: Array<{
    id: string;
    url: string;
    filename: string;
    size: number;
    type: string;
    width: number;
    height: number;
    thumbnails?: {
      small?: { url: string; width: number; height: number };
      large?: { url: string; width: number; height: number };
      full?: { url: string; width: number; height: number };
    };
  }>;
  'Active'?: boolean;
}

export type ProviderRecord = AirtableRecord<ProviderFields>;

// Job Template record from Airtable
export interface JobTemplateFields {
  'Job Code': string;
  'Provider': string[];
  'Patient': string[];
  'Default Employee': string[];
  'Title': string;
  'Service Type': string;
  'Priority': string;
  'Time Window Start'?: string;
  'Time Window End'?: string;
  'Active'?: boolean;
  'Occurrences': string[]; // Array of job occurrence record IDs
  'Provider ID': number[];
  'Patient ID': number[];
  'Unique Job Number': number;
}

export type JobTemplateRecord = AirtableRecord<JobTemplateFields>;

// Patient record from Airtable
export interface PatientFields {
  'Patient Full Name': string;
  'Patient ID': number;
  'DOB': string;
  'Phone': string;
  'Address'?: string;
  'Important Notes'?: string;
  'Provider': string[];
  'Job Templates': string[];
  'Active'?: boolean;
}

export type PatientRecord = AirtableRecord<PatientFields>;

// Job Occurrence record from Airtable
export interface JobOccurrenceFields {
  'Occurrence ID': string;
  'Job Template': string[];      // Array of job template record IDs
  'Scheduled At': string;        // Date in YYYY-MM-DD format
  'Status': string;              // "Scheduled", "Open", "Completed", "Cancelled", etc.
  'Assigned Employee': string[]; // Array of employee record IDs
  'Occurrence Label': string;    // Display label
  'Provider': string[];          // Array of provider record IDs
  'Patient': string[];           // Array of patient record IDs
  'Time': string;                // Time in HH:MM format (single select)
  'Reschedule Reason'?: string;  // Reason why job was left open (speech-to-text)
  'Patient TXT'?: string;        // Lookup field showing patient name
  'Employee TXT'?: string;       // Lookup field showing employee name
  'recordId (from Assigned Employee)'?: string[]; // Lookup field with employee record IDs
}

export type JobOccurrenceRecord = AirtableRecord<JobOccurrenceFields>;

// Processed employee data for our application
export interface Employee {
  id: string;
  name: string;
  pin: number;
  phone: string;
  providerId: string;
  jobTemplateIds: string[];
  notes?: string;
  active: boolean;
}

// Processed provider data for our application
export interface Provider {
  id: string;
  name: string;
  providerId: number;
  greeting?: string;
  timezone?: string;
  transferNumber?: string;
  active: boolean;
}

// Processed job template data for our application
export interface JobTemplate {
  id: string;
  jobCode: string;
  title: string;
  serviceType: string;
  priority: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  patientId: string;
  providerId: string;
  defaultEmployeeId: string;
  uniqueJobNumber: number;
  occurrenceIds: string[]; // Array of job occurrence record IDs
  active: boolean;
}

// Processed patient data for our application
export interface Patient {
  id: string;
  name: string;
  patientId: number;
  phone: string;
  dateOfBirth: string;
  address?: string;
  notes?: string;
  providerId: string;
  active: boolean;
}

// Processed job occurrence data for our application
export interface JobOccurrence {
  id: string;
  occurrenceId: string;        // "050505 — 2025-09-15 00:00"
  jobTemplateId: string;       // Link to Job Template
  scheduledAt: string;         // "2025-09-15" 
  time: string;                // "14:30" (HH:MM format from Airtable Time field)
  status: string;              // "Scheduled", "Completed", etc.
  assignedEmployeeId: string;  // Employee assigned to this occurrence
  occurrenceLabel: string;     // Display label for voice
  providerId: string;          // Provider for this occurrence
  patientId: string;           // Patient for this occurrence
  displayDate: string;         // "September 15th" for voice output
}

// Authentication result
export interface AuthResult {
  success: boolean;
  employee?: Employee;
  provider?: Provider | null;
  error?: string;
}

// Cache configuration
export interface CacheConfig {
  employeeTTL: number;    // Employee data cache TTL (seconds)
  providerTTL: number;    // Provider data cache TTL (seconds)
  jobTemplateTTL: number; // Job template cache TTL (seconds)
  patientTTL: number;     // Patient data cache TTL (seconds)
}

// Airtable client configuration
export interface AirtableConfig {
  apiKey: string;
  baseId: string;
  cache: CacheConfig;
}

// Query options for Airtable API
export interface QueryOptions {
  filterByFormula?: string;
  maxRecords?: number;
  fields?: string[];
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  view?: string;
}
