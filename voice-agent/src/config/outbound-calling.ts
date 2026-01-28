/**
 * Outbound Calling Configuration
 * Phase 3: Audio Generation & TwiML
 * 
 * Default settings and message templates for outbound calls to staff
 */

/**
 * Default configuration values
 */
export const OUTBOUND_CALL_DEFAULTS = {
  // Wait time after Wave 3 SMS completes before starting calls
  WAIT_MINUTES: 15,
  
  // Maximum rounds to call each staff member
  MAX_ROUNDS: 3,
  
  // Delay between individual calls (milliseconds)
  CALL_DELAY_MS: 5000, // 5 seconds
  
  // Delay between rounds (milliseconds)
  ROUND_DELAY_MS: 60000, // 1 minute
  
  // Call timeout for gathering DTMF input (seconds)
  GATHER_TIMEOUT: 10,
  
  // Number of digits to collect (1 = press 1 or 2)
  GATHER_NUM_DIGITS: 1,
} as const;

/**
 * Default message template with all available variables
 */
export const DEFAULT_MESSAGE_TEMPLATE = 
  "Hi {employeeName}, you have an urgent shift available for {patientName} on {date} at {time} in {suburb}. Press 1 to accept this shift, or press 2 to decline.";

/**
 * Privacy-focused message template (minimal details)
 */
export const PRIVACY_MESSAGE_TEMPLATE = 
  "Hi {employeeName}, you have an urgent shift available. Press 1 to accept, or press 2 to decline and we'll provide details.";

/**
 * Available template variables for message customization
 */
export const TEMPLATE_VARIABLES = {
  EMPLOYEE_NAME: '{employeeName}',      // Staff member's first name
  PATIENT_NAME: '{patientName}',        // Patient's name (First LastInitial format)
  DATE: '{date}',                       // Shift date (e.g., "March 15th")
  TIME: '{time}',                       // Shift time (e.g., "2:00 PM")
  START_TIME: '{startTime}',            // Start time (e.g., "14:00")
  END_TIME: '{endTime}',                // End time (e.g., "16:00")
  SUBURB: '{suburb}',                   // Location suburb
  DURATION: '{duration}',               // Shift duration (e.g., "2 hours")
} as const;

/**
 * Validation regex for template variables
 */
export const TEMPLATE_VARIABLE_REGEX = /\{(employeeName|patientName|date|time|startTime|endTime|suburb|duration)\}/g;

/**
 * TwiML voice settings
 */
export const TWIML_VOICE = {
  // Use Australian voice for consistency (fallback if ElevenLabs fails)
  VOICE: 'Google.en-AU-Wavenet-C',
  LANGUAGE: 'en-AU',
} as const;

/**
 * Response messages for different outcomes
 */
export const RESPONSE_MESSAGES = {
  ACCEPTED: "Thank you! The shift has been assigned to you. You'll receive a confirmation message shortly with all the details.",
  DECLINED: "Thank you for letting us know. We'll contact another team member.",
  NO_RESPONSE: "We didn't receive a response. We'll try calling another team member.",
  TIMEOUT: "No response received. Goodbye.",
  ERROR: "We're sorry, there was a technical issue. Please contact your supervisor.",
} as const;

/**
 * Audio storage configuration
 */
export const AUDIO_STORAGE = {
  // Temporary storage for generated audio files
  // TODO: Consider using S3 or similar in production
  TEMP_DIR: '/tmp/outbound-audio',
  
  // Audio file prefix
  FILE_PREFIX: 'outbound-call-',
  
  // Audio format from ElevenLabs
  FORMAT: 'ulaw_8000', // µ-law 8kHz (optimal for Twilio)
  
  // Time to keep audio files (milliseconds)
  TTL_MS: 3600000, // 1 hour
} as const;

/**
 * ElevenLabs voice settings for outbound calls
 */
export const ELEVENLABS_SETTINGS = {
  MODEL_ID: 'eleven_turbo_v2_5',
  SPEED: 0.95,
  STABILITY: 0.5,
  SIMILARITY_BOOST: 0.9,
  STYLE: 0.2,
  USE_SPEAKER_BOOST: true,
  OPTIMIZE_STREAMING_LATENCY: 3, // Balance of speed and quality
} as const;

/**
 * Validate a message template
 */
export function validateMessageTemplate(template: string): { valid: boolean; error?: string } {
  if (!template || template.trim().length === 0) {
    return { valid: false, error: 'Template cannot be empty' };
  }
  
  if (template.length > 500) {
    return { valid: false, error: 'Template too long (max 500 characters)' };
  }
  
  // Check if template contains at least the minimum required variables
  const hasEmployeeName = template.includes('{employeeName}');
  
  if (!hasEmployeeName) {
    return { valid: false, error: 'Template must include {employeeName}' };
  }
  
  // Check for invalid variable names
  const variables = template.match(/\{(\w+)\}/g) || [];
  const validVariables = Object.values(TEMPLATE_VARIABLES);
  
  for (const variable of variables) {
    if (!validVariables.includes(variable as any)) {
      return { valid: false, error: `Invalid variable: ${variable}` };
    }
  }
  
  return { valid: true };
}

/**
 * Get default configuration for a provider
 */
export function getDefaultOutboundConfig() {
  return {
    waitMinutes: OUTBOUND_CALL_DEFAULTS.WAIT_MINUTES,
    maxRounds: OUTBOUND_CALL_DEFAULTS.MAX_ROUNDS,
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    enabled: false, // Disabled by default
  };
}
