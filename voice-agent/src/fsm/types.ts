/**
 * FSM types for call state management
 */

export type CallPhase = 'collect_client_id' | 'confirm_client_id' | 'collect_job_number' | 'confirm_job_number' | 'job_options' | 'workflow_complete' | 'done' | 'error';

export type InputSource = 'speech' | 'dtmf' | 'none';

export type StateAction = 'prompt' | 'reprompt' | 'transition' | 'confirm' | 'goodbye' | 'error' | 'duplicate' | 'restart';

export interface CallAttempts {
  clientId: number;
  confirmClientId: number;
  jobNumber: number;
  confirmJobNumber: number;
  jobOptions: number;
}

export interface CallState {
  sid: string;
  phase: CallPhase;
  clientId: string | null;
  jobNumber: string | null;
  selectedOption: string | null; // For job options (1, 2, or 3)
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
  logData: {
    phase: CallPhase;
    hasInput: boolean;
    inputSource: InputSource;
    attempts: CallAttempts;
    action: StateAction;
  };
}
