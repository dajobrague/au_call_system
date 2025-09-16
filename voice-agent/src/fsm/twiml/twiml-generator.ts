/**
 * TwiML generation utilities
 * Pure functions for generating TwiML responses
 */

import { VOICE_CONFIG, GATHER_CONFIG } from './twiml-config';

/**
 * Generate TwiML response
 */
export function generateTwiML(prompt: string, isGather: boolean = true): string {
  const voiceAttrs = `voice="${VOICE_CONFIG.voice}" language="${VOICE_CONFIG.language}"`;
  
  if (!isGather) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say ${voiceAttrs}>${prompt}</Say>
  <Hangup/>
</Response>`;
  }
  
  // Build gather attributes conditionally
  const gatherAttrs = [
    `input="${GATHER_CONFIG.input}"`,
    `language="${GATHER_CONFIG.language}"`,
    `timeout="${GATHER_CONFIG.timeout}"`,
    `finishOnKey="${GATHER_CONFIG.finishOnKey}"`,
    `action="${GATHER_CONFIG.action}"`,
    `method="${GATHER_CONFIG.method}"`
  ];
  
  // Only add speechTimeout if input includes speech
  if (GATHER_CONFIG.input.includes('speech')) {
    gatherAttrs.push(`speechTimeout="3"`);
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather ${gatherAttrs.join(' ')}>
    <Say ${voiceAttrs}>${prompt}</Say>
  </Gather>
  <Say ${voiceAttrs}>We didn't receive your input. Please try again.</Say>
  <Redirect>${GATHER_CONFIG.action}</Redirect>
</Response>`;
}

/**
 * Generate TwiML for confirmation prompts (no # required, single digit auto-submits)
 */
export function generateConfirmationTwiML(prompt: string): string {
  const voiceAttrs = `voice="${VOICE_CONFIG.voice}" language="${VOICE_CONFIG.language}"`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="dtmf" 
    language="${GATHER_CONFIG.language}" 
    timeout="${GATHER_CONFIG.timeout}" 
    numDigits="1"
    action="${GATHER_CONFIG.action}"
    method="${GATHER_CONFIG.method}">
    <Say ${voiceAttrs}>${prompt}</Say>
  </Gather>
  <Say ${voiceAttrs}>We didn't receive your input. Please try again.</Say>
  <Redirect>${GATHER_CONFIG.action}</Redirect>
</Response>`;
}

/**
 * Get dynamic WebSocket URL for current environment
 */
function getDynamicWebSocketUrl(): string {
  const baseUrl = process.env.APP_URL || process.env.VERCEL_URL || 'localhost:3000';
  const protocol = baseUrl.includes('localhost') ? 'ws' : 'wss';
  return `${protocol}://${baseUrl}/api/twilio/media-stream`;
}

/**
 * Generate TwiML for voice AI mode with audio streaming
 * Uses ElevenLabs for all voice output instead of Twilio's <Say>
 */
export function generateVoiceTwiML(prompt: string, streamUrl?: string): string {
  const defaultStreamUrl = streamUrl || getDynamicWebSocketUrl();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream url="${defaultStreamUrl}" />
  <Redirect>${GATHER_CONFIG.action}</Redirect>
</Response>`;
}

/**
 * Generate TwiML for voice AI mode with initial ElevenLabs prompt
 * This will trigger the WebSocket to send the ElevenLabs audio
 */
export function generateVoiceTwiMLWithPrompt(prompt: string, streamUrl?: string): string {
  const defaultStreamUrl = streamUrl || getDynamicWebSocketUrl();
  
  // Store the prompt in the URL as a parameter so the WebSocket handler can use it
  const urlWithPrompt = `${defaultStreamUrl}?prompt=${encodeURIComponent(prompt)}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream url="${urlWithPrompt}" />
  <Redirect>${GATHER_CONFIG.action}</Redirect>
</Response>`;
}

/**
 * Generate TwiML based on mode (voice AI or traditional)
 */
export function generateAdaptiveTwiML(prompt: string, isGather: boolean = true): string {
  const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
  
  if (useVoiceAI) {
    // Use ElevenLabs voice through WebSocket streaming
    return generateVoiceTwiMLWithPrompt(prompt);
  } else {
    // Use traditional Twilio TTS with Google voice
    return generateTwiML(prompt, isGather);
  }
}
