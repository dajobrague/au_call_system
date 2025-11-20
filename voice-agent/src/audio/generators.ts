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
 * Creates a smooth, professional-sounding hold music with gentle progression
 * @param durationMs - Duration in milliseconds (default: 10000ms)
 * @returns Array of 20ms audio frames
 */
export function generateHoldMusic(durationMs: number = 10000): Uint8Array[] {
  const sr = 8000;
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  // Create a soothing melody with gentle chord progression
  // Using a relaxing progression with smoother harmonics
  const baseFrequencies = [220.00, 246.94, 261.63]; // A3, B3, C4 - calming progression
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    
    // Create a gentle, evolving sound with multiple harmonics
    let sample = 0;
    
    // Add fundamental frequencies with gentle amplitude
    baseFrequencies.forEach((freq, index) => {
      const amplitude = 0x0800 / baseFrequencies.length; // Softer amplitude
      // Add slight phase variation for warmth
      const phase = (index * 0.2);
      sample += Math.sin(2 * Math.PI * freq * t + phase) * amplitude;
      
      // Add subtle harmonics for richness (softer)
      sample += Math.sin(2 * Math.PI * freq * 2 * t + phase) * (amplitude * 0.3);
    });
    
    // Add very slow modulation for a more organic feel
    const modulation = 1 + (Math.sin(2 * Math.PI * 0.2 * t) * 0.1);
    sample *= modulation;
    
    // Apply smooth envelope with longer fade for seamless looping
    const fadeLength = sr * 1.0; // 1 second fade for ultra-smooth transitions
    let envelope = 1;
    if (i < fadeLength) {
      // Smooth fade in using cosine curve
      envelope = 0.5 * (1 - Math.cos(Math.PI * i / fadeLength));
    } else if (i > n - fadeLength) {
      // Smooth fade out using cosine curve
      envelope = 0.5 * (1 - Math.cos(Math.PI * (n - i) / fadeLength));
    }
    
    pcm[i] = Math.round(sample * envelope);
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}
