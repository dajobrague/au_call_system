/**
 * State factory for creating initial call states
 * Pure functions for state creation and initialization
 */

import { PHASES, DEFAULT_LANGUAGE } from '../constants';
import type { CallState } from '../types';

/**
 * Create initial call state
 */
export function createInitialState(callSid: string): CallState {
  const now = new Date().toISOString();
  return {
    sid: callSid,
    phase: PHASES.PHONE_AUTH, // Start with phone authentication
    clientId: null,    // Legacy field
    jobNumber: null,   // Legacy field
    jobCode: null,     // New job code field
    selectedOption: null,
    employee: undefined,
    provider: undefined,
    jobTemplate: undefined,
    patient: undefined,
    jobOccurrences: undefined,
    selectedOccurrence: undefined,
    actionType: undefined,
    authMethod: null,
    attempts: {
      clientId: 0,
      confirmClientId: 0,
      jobNumber: 0,
      confirmJobNumber: 0,
      jobOptions: 0,
      occurrenceSelection: 0,
    },
    lang: DEFAULT_LANGUAGE,
    createdAt: now,
    updatedAt: now,
    lastGatherAttempt: undefined,
  };
}
