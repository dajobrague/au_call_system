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
  // Temporarily use ngrok for testing Twilio WebSocket compatibility
  const cloudflareWorkerUrl = process.env.CLOUDFLARE_VOICE_PROXY_URL || 'wss://climbing-merely-joey.ngrok-free.app/stream';
  
  // Check if we're in a production environment or Voice AI is enabled
  const isProduction = process.env.NODE_ENV === 'production';
  const voiceAiEnabled = process.env.VOICE_AI_ENABLED === 'true';
  
  if (voiceAiEnabled) {
    // Use Cloudflare Workers for all Voice AI WebSocket connections
    return cloudflareWorkerUrl;
  } else {
    // Fallback to local WebSocket for development without Voice AI
    const baseUrl = process.env.APP_URL || process.env.VERCEL_URL || 'localhost:3000';
    const protocol = baseUrl.includes('localhost') ? 'ws' : 'wss';
    return `${protocol}://${baseUrl}/api/twilio/media-stream`;
  }
}

/**
 * Generate TwiML for voice AI mode with audio streaming
 * Uses ElevenLabs for all voice output instead of Twilio's <Say>
 */
export function generateVoiceTwiML(prompt: string, streamUrl?: string): string {
  const defaultStreamUrl = streamUrl || getDynamicWebSocketUrl();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${defaultStreamUrl}" />
  </Connect>
</Response>`;
}

/**
 * Generate TwiML for voice AI mode with initial ElevenLabs prompt
 * This will trigger the WebSocket to send the ElevenLabs audio
 */
export function generateVoiceTwiMLWithPrompt(prompt: string, streamUrl?: string, callerPhone?: string): string {
  const defaultStreamUrl = streamUrl || getDynamicWebSocketUrl();
  
  // Add caller phone as URL parameter for WebSocket to extract
  const urlWithParams = callerPhone 
    ? `${defaultStreamUrl}?from=${encodeURIComponent(callerPhone)}`
    : defaultStreamUrl;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${urlWithParams}" />
  </Connect>
</Response>`;
}

// Global variables to store current call context for TwiML generation
let currentCallSid: string | null = null;
let currentCallerPhone: string | null = null;

/**
 * Set the current call context for TwiML generation
 */
export function setCurrentCallContext(callSid: string, callerPhone?: string): void {
  currentCallSid = callSid;
  currentCallerPhone = callerPhone || null;
}

/**
 * Clear the current call context
 */
export function clearCurrentCallContext(): void {
  currentCallSid = null;
  currentCallerPhone = null;
}

/**
 * Generate TwiML based on mode (voice AI or traditional)
 * For voice AI mode, caches the prompt in Redis for WebSocket retrieval
 */
export function generateAdaptiveTwiML(prompt: string, isGather: boolean = true, callSid?: string): string {
  const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
  console.log(`🔍 generateAdaptiveTwiML: VOICE_AI_ENABLED=${process.env.VOICE_AI_ENABLED}, useVoiceAI=${useVoiceAI}`);
  
  if (useVoiceAI) {
    // Use provided callSid or fallback to global context
    const targetCallSid = callSid || currentCallSid;
    
    // Cache prompt in Redis for WebSocket to retrieve
    if (targetCallSid) {
      import('../../services/redis').then(({ cacheVoicePrompt }) => {
        cacheVoicePrompt(targetCallSid, prompt).catch(err => {
          console.error('❌ Failed to cache voice prompt:', err);
        });
      }).catch(err => {
        console.error('❌ Failed to import Redis service:', err);
      });
    } else {
      console.warn('⚠️ No callSid available for voice prompt caching');
    }
    
    // Use ElevenLabs voice through WebSocket streaming
    console.log('🎤 Using generateVoiceTwiMLWithPrompt (should have NO redirect)');
    return generateVoiceTwiMLWithPrompt(prompt, undefined, currentCallerPhone || undefined);
  } else {
    // Use traditional Twilio TTS with Google voice
    console.log('📞 Using generateTwiML (has redirect)');
    return generateTwiML(prompt, isGather);
  }
}
