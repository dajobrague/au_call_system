// Environment configuration (server-only)

export const env = {
  // Twilio credentials
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  
  // Application environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_ENV: process.env.APP_ENV || 'development',
  
  // Future integrations (Phase 2+)
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || '',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || '',
  REDIS_URL: process.env.REDIS_URL || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
} as const

// Validation helper
export function validateRequiredEnv() {
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
  const missing = required.filter(key => !env[key as keyof typeof env])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
