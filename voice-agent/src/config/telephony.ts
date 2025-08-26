// Telephony configuration - gather timeouts, voice names, language

export const telephonyConfig = {
  // Voice settings
  voice: 'alice' as const,
  language: 'en-US' as const,
  
  // Gather settings
  gather: {
    input: 'speech dtmf' as const,
    timeout: 10, // seconds
    speechTimeout: 3, // seconds
    finishOnKey: '#' as const,
    maxRetries: 1,
  },
  
  // Prompts
  prompts: {
    welcome: 'Welcome. After the tone, please say your client number or enter it using the keypad, then press pound.',
    noInput: 'We didn\'t receive your input. Please try again.',
    noInputFinal: 'We didn\'t receive your input. Goodbye.',
    acknowledgment: 'Thank you. We received your response.',
    error: 'Sorry, there was an error processing your request. Please try again later.',
  },
  
  // Call flow settings
  flow: {
    maxCallDuration: 300, // 5 minutes
    silenceTimeout: 5, // seconds
  }
} as const

export type TelephonyConfig = typeof telephonyConfig
