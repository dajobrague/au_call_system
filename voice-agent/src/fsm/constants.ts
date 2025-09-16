/**
 * FSM constants and configuration
 */

import type { CallPhase } from './types';

export const MAX_ATTEMPTS_PER_FIELD = 2; // First prompt + 1 retry

export const PHASES: Record<string, CallPhase> = {
  PHONE_AUTH: 'phone_auth',
  PIN_AUTH: 'pin_auth',
  PROVIDER_SELECTION: 'provider_selection',
  PROVIDER_GREETING: 'provider_greeting',
  COLLECT_JOB_CODE: 'collect_job_code',
  CONFIRM_JOB_CODE: 'confirm_job_code',
  JOB_OPTIONS: 'job_options',
  OCCURRENCE_SELECTION: 'occurrence_selection',
  COLLECT_REASON: 'collect_reason',
  CONFIRM_LEAVE_OPEN: 'confirm_leave_open',
  COLLECT_DAY: 'collect_day',
  COLLECT_MONTH: 'collect_month',
  COLLECT_TIME: 'collect_time',
  CONFIRM_DATETIME: 'confirm_datetime',
  SCHEDULE_NEW_OCCURRENCE: 'schedule_new_occurrence',
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
  input: 'dtmf', // DTMF-only for reliability (no speech recognition)
  language: 'en-AU',
  timeout: 15, // Increased timeout since users need to find keypad
  finishOnKey: '#',
  action: '/api/twilio/voice',
  method: 'POST',
} as const;
