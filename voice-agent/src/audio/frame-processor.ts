/**
 * Audio Frame Processing
 * Handles slicing audio into frames for streaming
 */

/**
 * Slice μ-law audio into 20ms frames (160 bytes at 8kHz)
 * @param muBytes - μ-law encoded audio data
 * @returns Array of 20ms audio frames
 */
export function sliceInto20msFrames(muBytes: Uint8Array): Uint8Array[] {
  const frameSize = 160; // 20ms at 8kHz = 160 samples
  const frames: Uint8Array[] = [];
  
  for (let i = 0; i + frameSize <= muBytes.length; i += frameSize) {
    frames.push(muBytes.subarray(i, i + frameSize));
  }
  
  return frames;
}

/**
 * Legacy function name for compatibility
 * @deprecated Use sliceInto20msFrames instead
 */
export function sliceInto20msChunks(audioBuffer: ArrayBuffer): Uint8Array[] {
  return sliceInto20msFrames(new Uint8Array(audioBuffer));
}
