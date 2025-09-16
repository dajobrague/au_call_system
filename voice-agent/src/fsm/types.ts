/**
 * FSM types for call state management
 */

export type CallPhase = 'phone_auth' | 'pin_auth' | 'provider_selection' | 'provider_greeting' | 'collect_job_code' | 'confirm_job_code' | 'job_options' | 'occurrence_selection' | 'collect_reason' | 'confirm_leave_open' | 'collect_day' | 'collect_month' | 'collect_time' | 'confirm_datetime' | 'schedule_new_occurrence' | 'workflow_complete' | 'done' | 'error';

export type InputSource = 'speech' | 'dtmf' | 'none';

export type StateAction = 'prompt' | 'reprompt' | 'transition' | 'confirm' | 'goodbye' | 'error' | 'duplicate' | 'restart' | 'phone_auth_success' | 'phone_auth_failed' | 'pin_auth_success' | 'pin_auth_failed' | 'pin_auth_max_attempts' | 'pin_auth_reprompt' | 'pin_auth_invalid_format' | 'pin_auth_invalid_reprompt' | 'pin_auth_not_found' | 'pin_auth_not_found_reprompt' | 'system_error' | 'schedule_new_not_implemented';

export interface CallAttempts {
  clientId: number;        // Reused for PIN attempts
  confirmClientId: number; // Reused for job code confirmation
  jobNumber: number;       // Reused for job code attempts
  confirmJobNumber: number;
  jobOptions: number;
  occurrenceSelection: number; // NEW: For occurrence selection attempts
}

export interface CallState {
  sid: string;
  phase: CallPhase;
  clientId: string | null;        // Legacy - may be removed
  jobNumber: string | null;       // Legacy - may be removed  
  jobCode: string | null;         // New job code field
  selectedOption: string | null;  // For job options (1, 2, or 3)
  employee?: {                    // Authenticated employee data
    id: string;
    name: string;
    pin: number;
    phone: string;
    providerId: string;
    jobTemplateIds: string[];
    notes?: string;
    active: boolean;
  };
  provider?: {                    // Provider data for greetings
    id: string;
    name: string;
    greeting?: string;
  } | null;
  availableProviders?: Array<{    // For multi-provider employees
    id: string;
    name: string;
    greeting?: string;
    selectionNumber: number;
  }>;
  jobTemplate?: {                 // Current job template data
    id: string;
    jobCode: string;
    title: string;
    serviceType: string;
    patientId: string;
    occurrenceIds: string[];     // Array of occurrence IDs from job template
  };
  patient?: {                     // Current patient data
    id: string;
    name: string;
    patientId: number;
  };
  jobOccurrences?: Array<{        // Future occurrences for current job
    id: string;
    occurrenceId: string;
    scheduledAt: string;
    displayDate: string;
    status: string;
  }>;
  selectedOccurrence?: {          // Selected occurrence for action
    id: string;
    occurrenceId: string;
    scheduledAt: string;
    displayDate: string;
  };
  actionType?: 'reschedule' | 'leave_open'; // Selected action type
  rescheduleReason?: string;      // Speech-to-text reason for leaving job open
  dateTimeInput?: {               // Date/time collection for rescheduling
    day?: string;                 // DD format (01-31)
    month?: string;               // MM format (01-12)
    time?: string;                // HHMM or HH format
    fullDate?: string;            // YYYY-MM-DD format
    displayDateTime?: string;     // "October 15th at 7:30 PM" for voice
  };
  authMethod: 'phone' | 'pin' | null; // How the user was authenticated
  attempts: CallAttempts;
  lang: string;
  createdAt: string;
  updatedAt: string;
  lastGatherAttempt?: string; // Track last processed GatherAttempt for idempotency
}

export interface TwilioWebhookData {
  CallSid: string;
  From: string;
  To: string;
  SpeechResult?: string;
  Digits?: string;
  GatherAttempt?: string;
}

export interface ProcessingResult {
  twiml: string;
  action: StateAction;
  shouldDeleteState: boolean;
  logData?: {
    phase: CallPhase;
    hasInput?: boolean;
    inputSource?: InputSource;
    attempts?: CallAttempts;
    action: StateAction;
    [key: string]: any; // Allow additional log fields
  };
}
