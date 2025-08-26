/**
 * FSM types for call state management
 */

export type CallPhase = 'collect_client_id' | 'collect_job_number' | 'done' | 'error';

export type InputSource = 'speech' | 'dtmf' | 'none';

export type StateAction = 'prompt' | 'reprompt' | 'transition' | 'confirm' | 'goodbye' | 'error';

export interface CallAttempts {
  clientId: number;
  jobNumber: number;
}

export interface CallState {
  sid: string;
  phase: CallPhase;
  clientId: string | null;
  jobNumber: string | null;
  attempts: CallAttempts;
  lang: string;
  createdAt: string;
  updatedAt: string;
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
