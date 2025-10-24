/**
 * Call Log Types
 * For tracking and logging all call activities to Airtable
 */

export interface CallEvent {
  timestamp: string;
  phase: string;
  action: string;
  details?: any;
}

export interface CallLogCreateData {
  callSid: string;
  providerId?: string;
  employeeId?: string;
  direction: 'Inbound' | 'Outbound';
  startedAt: string;
}

export interface CallLogUpdateData {
  endedAt: string;
  seconds: number;
  recordingUrl?: string;
  detectedIntent?: string;
  rawPayload: string;
  patientId?: string;
  relatedOccurrenceId?: string;
  notes?: string;
}

export interface CallLogResult {
  success: boolean;
  recordId?: string;
  error?: string;
}
