// Environment configuration (server-only)

/**
 * Detect if we're in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || 
         process.env.VERCEL_ENV === 'production' ||
         process.env.APP_ENV === 'production';
}

/**
 * Get Twilio credentials based on environment
 * - Production: Uses PROD_* prefixed variables (or falls back to regular ones)
 * - Development: Uses regular TWILIO_* variables
 */
function getTwilioCredentials() {
  const isProd = isProduction();
  
  if (isProd) {
    // Production: Use PROD_ prefixed credentials if available, otherwise fall back
    return {
      accountSid: process.env.PROD_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.PROD_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.PROD_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || '',
      messagingSid: process.env.PROD_TWILIO_MESSAGING_SID || process.env.TWILIO_MESSAGING_SID || '',
    };
  } else {
    // Development/Test: Use regular credentials
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      messagingSid: process.env.TWILIO_MESSAGING_SID || '',
    };
  }
}

const twilioCredentials = getTwilioCredentials();

export const env = {
  // Twilio credentials (environment-aware)
  TWILIO_ACCOUNT_SID: twilioCredentials.accountSid,
  TWILIO_AUTH_TOKEN: twilioCredentials.authToken,
  TWILIO_PHONE_NUMBER: twilioCredentials.phoneNumber,
  TWILIO_MESSAGING_SID: twilioCredentials.messagingSid,
  
  // Application environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_ENV: process.env.APP_ENV || 'development',
  IS_PRODUCTION: isProduction(),
  
  // Airtable
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || '',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || '',
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || '',
  
  // AWS S3 Configuration (ap-southeast-2 for NDIS compliance)
  AWS_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.S3_REGION || process.env.AWS_REGION || 'ap-southeast-2',
  AWS_S3_BUCKET: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || '',
  AWS_S3_RECORDINGS_PREFIX: process.env.S3_PREFIX || process.env.AWS_S3_RECORDINGS_PREFIX || 'call-recordings/',
} as const

/**
 * Validate Twilio phone number format
 */
function validatePhoneNumberFormat(phoneNumber: string): { isValid: boolean; region: string; error?: string } {
  if (!phoneNumber) {
    return { isValid: false, region: 'unknown', error: 'Phone number is empty' };
  }
  
  // US number format
  if (phoneNumber.startsWith('+1')) {
    return { isValid: true, region: 'US' };
  }
  
  // Australian number format
  if (phoneNumber.startsWith('+61')) {
    return { isValid: true, region: 'AU' };
  }
  
  return { isValid: false, region: 'unknown', error: `Unknown phone number format: ${phoneNumber}` };
}

/**
 * Safety check: Ensure we're not using wrong credentials for the environment
 */
function validateCredentialSafety(): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const isProd = isProduction();
  const phoneValidation = validatePhoneNumberFormat(env.TWILIO_PHONE_NUMBER);
  
  if (!phoneValidation.isValid) {
    errors.push(phoneValidation.error || 'Invalid phone number format');
    return { isValid: false, warnings, errors };
  }
  
  // Check for mismatched credentials
  if (isProd && phoneValidation.region === 'US') {
    errors.push('🚨 PRODUCTION SAFETY ERROR: Using US test number in production! Expected Australian number (+61)');
  }
  
  if (!isProd && phoneValidation.region === 'AU') {
    warnings.push('⚠️  WARNING: Using Australian production number in development. Consider using US test number (+1)');
  }
  
  // Check if production credentials are present in non-production environment
  if (!isProd && process.env.PROD_TWILIO_ACCOUNT_SID) {
    warnings.push('⚠️  WARNING: Production credentials detected in development environment');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Validation helper
 */
export function validateRequiredEnv() {
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TWILIO_MESSAGING_SID']
  const missing = required.filter(key => !env[key as keyof typeof env])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  // Safety validation
  const safety = validateCredentialSafety();
  
  // Log warnings
  if (safety.warnings.length > 0) {
    console.warn('⚠️  Credential Safety Warnings:');
    safety.warnings.forEach(warning => console.warn(`   ${warning}`));
  }
  
  // Throw errors
  if (!safety.isValid) {
    console.error('🚨 Credential Safety Errors:');
    safety.errors.forEach(error => console.error(`   ${error}`));
    throw new Error('Credential safety validation failed. Check your Twilio configuration.');
  }
  
  // Log successful validation
  const phoneValidation = validatePhoneNumberFormat(env.TWILIO_PHONE_NUMBER);
  console.log(`✅ Twilio credentials validated: ${env.IS_PRODUCTION ? 'PRODUCTION' : 'TEST'} mode (${phoneValidation.region} number)`);
}

/**
 * Get credential info for logging (safe - no secrets)
 */
export function getCredentialInfo() {
  const phoneValidation = validatePhoneNumberFormat(env.TWILIO_PHONE_NUMBER);
  return {
    environment: env.IS_PRODUCTION ? 'production' : 'development',
    phoneRegion: phoneValidation.region,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
    accountSid: env.TWILIO_ACCOUNT_SID.substring(0, 8) + '...',
  };
}
