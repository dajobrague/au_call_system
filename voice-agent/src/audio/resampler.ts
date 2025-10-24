/**
 * Audio Resampling Utilities
 * High-quality linear interpolation resampling with anti-aliasing
 */

/**
 * Resample audio to 8kHz with anti-aliasing
 * @param audioBuffer - Input audio buffer
 * @param fromSampleRate - Original sample rate
 * @returns Resampled audio buffer at 8kHz
 */
export function resampleTo8k(audioBuffer: ArrayBuffer, fromSampleRate: number): ArrayBuffer {
  const input = new Int16Array(audioBuffer);
  const ratio = 8000 / fromSampleRate;
  const outputLength = Math.floor(input.length * ratio);
  const output = new Int16Array(outputLength);
  
  // Apply simple low-pass filter to prevent aliasing
  const filtered = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    if (i === 0) {
      filtered[i] = input[i];
    } else if (i === input.length - 1) {
      filtered[i] = input[i];
    } else {
      // Simple 3-point average for anti-aliasing
      filtered[i] = Math.round((input[i-1] + 2 * input[i] + input[i+1]) / 4);
    }
  }
  
  // Resample with linear interpolation
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / ratio;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, filtered.length - 1);
    
    if (sourceIndexFloor >= filtered.length) break;
    
    const fraction = sourceIndex - sourceIndexFloor;
    const sample1 = filtered[sourceIndexFloor] || 0;
    const sample2 = filtered[sourceIndexCeil] || 0;
    
    output[i] = Math.round(sample1 * (1 - fraction) + sample2 * fraction);
  }
  
  return output.buffer;
}
