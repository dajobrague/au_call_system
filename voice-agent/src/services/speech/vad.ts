/**
 * Voice Activity Detection (VAD)
 * Energy-based detection to identify when user stops speaking
 */

export interface VADConfig {
  energyThreshold: number;      // RMS energy below this = silence
  silenceDurationMs: number;    // Duration of silence to trigger stop
  minSpeechDurationMs: number;  // Minimum speech duration required
}

export interface VoiceActivity {
  hasVoice: boolean;
  energy: number;
  peak: number;
}

export interface VADState {
  consecutiveSilentFrames: number;
  totalFrames: number;
  hasDetectedVoice: boolean;
}

// Default configuration
const DEFAULT_CONFIG: VADConfig = {
  energyThreshold: 500,
  silenceDurationMs: 800,
  minSpeechDurationMs: 500
};

/**
 * Calculate RMS (Root Mean Square) energy of audio chunk
 */
function calculateRMS(audioBuffer: Buffer): number {
  const samples = new Uint8Array(audioBuffer);
  let sumSquares = 0;
  
  for (let i = 0; i < samples.length; i++) {
    // Center around 128 (μ-law midpoint)
    const sample = samples[i] - 128;
    sumSquares += sample * sample;
  }
  
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Find peak level in audio chunk
 */
function findPeak(audioBuffer: Buffer): number {
  const samples = new Uint8Array(audioBuffer);
  let peak = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.abs(samples[i] - 128);
    peak = Math.max(peak, sample);
  }
  
  return peak;
}

/**
 * Detect voice activity in an audio chunk
 */
export function detectVoiceActivity(
  audioChunk: Buffer,
  config: VADConfig = DEFAULT_CONFIG
): VoiceActivity {
  const energy = calculateRMS(audioChunk);
  const peak = findPeak(audioChunk);
  
  // Voice detected if energy is above threshold AND peak is significant
  const hasVoice = energy > config.energyThreshold && peak > 50;
  
  return {
    hasVoice,
    energy,
    peak
  };
}

/**
 * Create initial VAD state
 */
export function createVADState(): VADState {
  return {
    consecutiveSilentFrames: 0,
    totalFrames: 0,
    hasDetectedVoice: false
  };
}

/**
 * Update VAD state with new voice activity
 */
export function updateVADState(
  state: VADState,
  activity: VoiceActivity
): VADState {
  const newState = {
    ...state,
    totalFrames: state.totalFrames + 1
  };
  
  if (activity.hasVoice) {
    // Voice detected - reset silent frame counter
    newState.consecutiveSilentFrames = 0;
    newState.hasDetectedVoice = true;
  } else {
    // Silence detected - increment counter
    newState.consecutiveSilentFrames = state.consecutiveSilentFrames + 1;
  }
  
  return newState;
}

/**
 * Check if recording should stop based on VAD state
 * Stops if: silence duration exceeded AND minimum speech detected
 */
export function shouldStopRecording(
  vadState: VADState,
  recordingDurationMs: number,
  config: VADConfig = DEFAULT_CONFIG
): boolean {
  // Each frame is 20ms (160 bytes at 8kHz)
  const silenceFramesThreshold = Math.ceil(config.silenceDurationMs / 20);
  
  // Check if we have enough consecutive silent frames
  const hasSufficientSilence = vadState.consecutiveSilentFrames >= silenceFramesThreshold;
  
  // Check if we've recorded minimum speech duration
  const hasMinimumSpeech = recordingDurationMs >= config.minSpeechDurationMs;
  
  // Check if we've detected any voice at all
  const hasVoiceDetected = vadState.hasDetectedVoice;
  
  return hasSufficientSilence && hasMinimumSpeech && hasVoiceDetected;
}

/**
 * Get silence duration in milliseconds
 */
export function getSilenceDurationMs(vadState: VADState): number {
  // Each frame is 20ms
  return vadState.consecutiveSilentFrames * 20;
}
