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
  // Outbound calling fields (Phase 1)
  callPurpose?: 'IVR Session' | 'Outbound Job Offer' | 'Transfer to Representative';
  attemptRound?: number; // Which round this call was in (1, 2, 3, etc.)
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
  // Outbound calling fields (Phase 1)
  callOutcome?: 'Accepted' | 'Declined' | 'No Answer' | 'Busy' | 'Failed' | 'Voicemail';
  dtmfResponse?: string; // The digit pressed by staff ("1" or "2")
}

export interface CallLogResult {
  success: boolean;
  recordId?: string;
  error?: string;
}
