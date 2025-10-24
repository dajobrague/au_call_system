/**
 * Audio Tone Generators
 * Generates various audio tones (test tones, beeps, hold music)
 */

import { linear16ToMulaw } from './codecs';
import { sliceInto20msFrames } from './frame-processor';

/**
 * Generate a 440Hz test tone in μ-law for testing
 * @param durationMs - Duration in milliseconds (default: 2000ms)
 * @returns Array of 20ms audio frames
 */
export function makeUlawTone440(durationMs: number = 2000): Uint8Array[] {
  const sr = 8000;
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    pcm[i] = Math.round(Math.sin(2 * Math.PI * 440 * t) * 0x3FFF); // safe amplitude
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}

/**
 * Generate professional beep tone for speech collection
 * @param durationMs - Duration in milliseconds (default: 300ms)
 * @returns Array of 20ms audio frames
 */
export function generateBeepTone(durationMs: number = 300): Uint8Array[] {
  const sr = 8000;
  const frequency = 800; // Professional beep frequency
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Create a pleasant beep with fade in/out
    const fadeIn = Math.min(1, i / (sr * 0.05)); // 50ms fade in
    const fadeOut = Math.min(1, (n - i) / (sr * 0.05)); // 50ms fade out
    const envelope = fadeIn * fadeOut;
    
    pcm[i] = Math.round(Math.sin(2 * Math.PI * frequency * t) * 0x2000 * envelope); // Lower volume
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}

/**
 * Generate pleasant hold music (soft melody)
 * Creates a C-E-G major chord progression
 * @param durationMs - Duration in milliseconds (default: 10000ms)
 * @returns Array of 20ms audio frames
 */
export function generateHoldMusic(durationMs: number = 10000): Uint8Array[] {
  const sr = 8000;
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  // Create a pleasant melody with multiple harmonics
  // Using a simple chord progression: C-E-G (major chord)
  const frequencies = [261.63, 329.63, 392.00]; // C4, E4, G4
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    
    // Mix multiple frequencies for a richer sound
    let sample = 0;
    frequencies.forEach((freq) => {
      const amplitude = 0x1000 / frequencies.length; // Divide amplitude among frequencies
      sample += Math.sin(2 * Math.PI * freq * t) * amplitude;
    });
    
    // Add a slow fade in/out for smooth looping
    const fadeLength = sr * 0.5; // 0.5 second fade
    let envelope = 1;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > n - fadeLength) {
      envelope = (n - i) / fadeLength;
    }
    
    pcm[i] = Math.round(sample * envelope);
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}
