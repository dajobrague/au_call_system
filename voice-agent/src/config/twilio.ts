/**
 * Twilio Configuration
 * Centralized configuration for Twilio voice and SMS services
 */

// Read Twilio configuration from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SID = process.env.TWILIO_MESSAGING_SID;

// Validate required environment variables
if (!TWILIO_ACCOUNT_SID) {
  throw new Error('TWILIO_ACCOUNT_SID environment variable is required');
}

if (!TWILIO_AUTH_TOKEN) {
  throw new Error('TWILIO_AUTH_TOKEN environment variable is required');
}

if (!TWILIO_PHONE_NUMBER) {
  throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
}

if (!TWILIO_MESSAGING_SID) {
  throw new Error('TWILIO_MESSAGING_SID environment variable is required');
}

// Main Twilio configuration
export const twilioConfig = {
  accountSid: TWILIO_ACCOUNT_SID,
  authToken: TWILIO_AUTH_TOKEN,
  phoneNumber: TWILIO_PHONE_NUMBER,
  messagingSid: TWILIO_MESSAGING_SID,
};

// SMS configuration
export const SMS_CONFIG = {
  timeout: 30000, // 30 seconds timeout for SMS API
  maxRetries: 3,
  retryDelay: 1000, // 1 second
} as const;

/**
 * Validate Twilio configuration
 */
export function validateTwilioConfig(): void {
  if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber || !twilioConfig.messagingSid) {
    throw new Error('Twilio configuration is incomplete. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_MESSAGING_SID environment variables.');
  }
  
  // Validate account SID format
  if (!twilioConfig.accountSid.startsWith('AC')) {
    throw new Error('Invalid Twilio Account SID format. Should start with "AC".');
  }
  
  // Validate messaging SID format
  if (!twilioConfig.messagingSid.startsWith('MG')) {
    throw new Error('Invalid Twilio Messaging SID format. Should start with "MG".');
  }
}

// Validate configuration on module load
validateTwilioConfig();
