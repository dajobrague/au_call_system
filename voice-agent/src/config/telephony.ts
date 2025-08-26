/**
 * Telephony configuration for voice calls
 * Centralized settings for TTS, STT, and call behavior with Australian English
 * Phase 2: FSM + State Management
 */

export const telephonyConfig = {
  // Voice settings (ElevenLabs Australian)
  voice: 'ys3XeJJA4ArWMhRpcX1D' as const,
  language: 'en-AU' as const,
  ttsProvider: 'ElevenLabs' as const,
  
  // Gather settings
  gather: {
    input: 'speech dtmf' as const,
    language: 'en-AU' as const,
    timeout: 10, // seconds
    speechTimeout: 3, // seconds
    finishOnKey: '#' as const,
    maxRetries: 2, // First prompt + 1 retry (Phase 2 requirement)
  },
  
  // Phase 2 FSM Prompts (Australian English)
  prompts: {
    // Initial client ID collection
    welcome: 'Welcome. Please say your client number, or enter it on the keypad, then press pound.',
    reprompt_clientId: 'Sorry, I didn\'t catch that. Please say your client number, or enter it, then press pound.',
    
    // Job number collection
    ask_jobNumber: 'Thanks. Now say your job number, or enter it, then press pound.',
    reprompt_jobNumber: 'Sorry, I didn\'t get the job number. Please say it, or enter it, then press pound.',
    
    // Confirmation and completion
    confirm_both: 'Thank you. We have your client number and job number.',
    goodbye: 'Thanks for calling. Goodbye.',
    
    // Error handling
    error: 'Sorry, there was an error processing your request. Please try again later.',
  },
  
  // Call flow settings
  flow: {
    maxCallDuration: 300, // 5 minutes
    silenceTimeout: 5, // seconds
  }
} as const;

export type TelephonyConfig = typeof telephonyConfig;