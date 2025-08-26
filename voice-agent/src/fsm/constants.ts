/**
 * FSM constants and configuration
 */

import type { CallPhase } from './types';

export const MAX_ATTEMPTS_PER_FIELD = 2; // First prompt + 1 retry

export const PHASES: Record<string, CallPhase> = {
  COLLECT_CLIENT_ID: 'collect_client_id',
  COLLECT_JOB_NUMBER: 'collect_job_number',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const DEFAULT_LANGUAGE = 'en-AU';

export const VOICE_CONFIG = {
  voice: 'ys3XeJJA4ArWMhRpcX1D', // ElevenLabs Australian voice
  language: 'en-AU',
  ttsProvider: 'ElevenLabs',
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
