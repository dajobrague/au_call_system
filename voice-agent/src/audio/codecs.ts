/**
 * Audio Codec Utilities
 * Handles conversion between different audio formats (PCM16, μ-law)
 */

/**
 * Convert PCM16 to μ-law using G.711 algorithm
 * @param int16Array - Input PCM16 audio data
 * @returns Uint8Array of μ-law encoded audio
 */
export function linear16ToMulaw(int16Array: Int16Array): Uint8Array {
  const BIAS = 0x84;
  const CLIP = 32635;
  const muLaw = new Uint8Array(int16Array.length);
  
  for (let i = 0; i < int16Array.length; i++) {
    let sample = int16Array[i];
    const sign = (sample >> 8) & 0x80;
    if (sample < 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample = sample + BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const ulaw = ~(sign | (exponent << 4) | mantissa);
    muLaw[i] = ulaw & 0xFF;
  }
  
  return muLaw;
}
