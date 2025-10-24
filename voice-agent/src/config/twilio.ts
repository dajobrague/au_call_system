/**
 * Twilio Configuration
 * Centralized configuration for Twilio voice and SMS services
 * 
 * IMPORTANT: This configuration automatically selects credentials based on environment:
 * - Development: Uses TWILIO_* variables (US test number)
 * - Production: Uses PROD_TWILIO_* variables (Australian number)
 */

import { env, getCredentialInfo } from './env';

/**
 * Determine environment mode
 */
function getEnvironmentMode(): 'test' | 'production' {
  return env.IS_PRODUCTION ? 'production' : 'test';
}

// Read Twilio configuration from environment-aware config
const TWILIO_ACCOUNT_SID = env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SID = env.TWILIO_MESSAGING_SID;

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
  mode: getEnvironmentMode(),
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
  
  // Log credential info for transparency
  const credInfo = getCredentialInfo();
  console.log(`🔐 Twilio Config: ${credInfo.environment.toUpperCase()} mode`);
  console.log(`   📞 Phone: ${credInfo.phoneNumber} (${credInfo.phoneRegion})`);
  console.log(`   🔑 Account: ${credInfo.accountSid}`);
}

/**
 * Get webhook URLs based on environment
 */
export function getTwilioWebhookUrls(): {
  voiceUrl: string;
  statusCallback: string;
  websocketUrl: string;
} {
  const mode = twilioConfig.mode;
  
  if (mode === 'production') {
    // Production: Use Vercel deployment URLs
    const appUrl = process.env.VERCEL_URL || process.env.APP_URL || 'your-app.vercel.app';
    return {
      voiceUrl: `https://${appUrl}/api/twilio/voice`,
      statusCallback: `https://${appUrl}/api/twilio/status`,
      websocketUrl: `wss://${appUrl}/api/twilio/voice-websocket`,
    };
  } else {
    // Test: Use ngrok URLs
    const ngrokDomain = process.env.NGROK_DOMAIN || 'climbing-merely-joey.ngrok-free.app';
    return {
      voiceUrl: `https://${ngrokDomain}/stream`,
      statusCallback: `https://${ngrokDomain}/api/twilio/status`,
      websocketUrl: `wss://${ngrokDomain}/stream`,
    };
  }
}

// Validate configuration on module load
validateTwilioConfig();
