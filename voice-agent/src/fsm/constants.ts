/**
 * FSM constants and configuration
 */

import type { CallPhase } from './types';

export const MAX_ATTEMPTS_PER_FIELD = 2; // First prompt + 1 retry

export const PHASES: Record<string, CallPhase> = {
  COLLECT_CLIENT_ID: 'collect_client_id',
  CONFIRM_CLIENT_ID: 'confirm_client_id',
  COLLECT_JOB_NUMBER: 'collect_job_number',
  CONFIRM_JOB_NUMBER: 'confirm_job_number',
  JOB_OPTIONS: 'job_options',
  WORKFLOW_COMPLETE: 'workflow_complete',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const DEFAULT_LANGUAGE = 'en-AU';

export const VOICE_CONFIG = {
  voice: 'Google.en-AU-Wavenet-A', // Google Australian Neural voice
  language: 'en-AU',
} as const;

export const GATHER_CONFIG = {
  input: 'speech dtmf',
  language: 'en-AU',
  timeout: 10,
  speechTimeout: 3,
  finishOnKey: '#',
  action: '/api/twilio/voice',
  method: 'POST',
} as const;
