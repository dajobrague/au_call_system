/**
 * Speech Collection State Manager
 * Manages the lifecycle states of speech collection
 */

export enum SpeechState {
  IDLE = 'idle',
  PROMPT_PLAYING = 'prompt_playing',
  BEEP_PLAYING = 'beep_playing',
  RECORDING = 'recording',
  PROCESSING = 'processing'
}

export interface SpeechCollectionContext {
  patientName?: string;
  appointmentDate?: string;
  jobTitle?: string;
  phase: 'collect_day' | 'collect_time' | 'collect_reason';
  attemptNumber?: number;
  callSid?: string;
  updateState?: (updates: any) => Promise<void>;
  // Accumulated partial results
  partialDate?: string;  // ISO date from previous attempt
  partialTime?: string;  // ISO time from previous attempt
  partialDisplayDate?: string;  // Human-readable date
  partialDisplayTime?: string;  // Human-readable time
}

export interface SpeechCollectionState {
  state: SpeechState;
  context?: SpeechCollectionContext;
  startedAt?: number;
  recordingStartedAt?: number;
}

/**
 * Create initial speech collection state
 */
export function createSpeechState(
  context: SpeechCollectionContext
): SpeechCollectionState {
  return {
    state: SpeechState.IDLE,
    context,
    attemptNumber: context.attemptNumber || 1
  };
}

/**
 * Transition to a new speech state
 */
export function transitionState(
  current: SpeechCollectionState,
  newState: SpeechState
): SpeechCollectionState {
  const now = Date.now();
  
  return {
    ...current,
    state: newState,
    startedAt: newState === SpeechState.PROMPT_PLAYING ? now : current.startedAt,
    recordingStartedAt: newState === SpeechState.RECORDING ? now : current.recordingStartedAt
  };
}

/**
 * Check if state is actively recording
 */
export function isRecording(state: SpeechCollectionState): boolean {
  return state.state === SpeechState.RECORDING;
}

/**
 * Check if state is processing
 */
export function isProcessing(state: SpeechCollectionState): boolean {
  return state.state === SpeechState.PROCESSING;
}

/**
 * Check if state is idle
 */
export function isIdle(state: SpeechCollectionState): boolean {
  return state.state === SpeechState.IDLE;
}

/**
 * Get recording duration in milliseconds
 */
export function getRecordingDuration(state: SpeechCollectionState): number {
  if (!state.recordingStartedAt) return 0;
  return Date.now() - state.recordingStartedAt;
}

/**
 * Reset state to idle
 */
export function resetState(state: SpeechCollectionState): SpeechCollectionState {
  return {
    ...state,
    state: SpeechState.IDLE,
    recordingStartedAt: undefined
  };
}
