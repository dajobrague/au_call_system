/**
 * Railway Environment Variables Verification Script
 * Run this to verify all required environment variables are set
 */

require('dotenv').config();

const requiredVars = [
  'RAILWAY_PUBLIC_DOMAIN',
  'REPRESENTATIVE_PHONE',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID'
];

const optionalVars = [
  'PORT',
  'WEBSOCKET_PORT',
  'NODE_ENV',
  'TWILIO_WORKFLOW_SID',
  'RECORDING_STATUS_CALLBACK',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET_NAME'
];

console.log('\n🔍 Railway Environment Variables Check\n');
console.log('=' .repeat(80));

console.log('\n📋 REQUIRED Variables:\n');
let allRequiredSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅' : '❌';
  
  if (!isSet) {
    allRequiredSet = false;
    console.log(`${status} ${varName}: NOT SET`);
  } else {
    // Show first 20 chars for security
    const display = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`${status} ${varName}: ${display}`);
  }
});

console.log('\n📋 OPTIONAL Variables:\n');

optionalVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅' : '⚪';
  
  if (isSet) {
    const display = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`${status} ${varName}: ${display}`);
  } else {
    console.log(`${status} ${varName}: Not set (using default)`);
  }
});

console.log('\n' + '=' .repeat(80));

if (allRequiredSet) {
  console.log('\n✅ All required environment variables are set!\n');
  console.log('🚀 Ready to deploy to Railway\n');
  process.exit(0);
} else {
  console.log('\n❌ Some required environment variables are missing!\n');
  console.log('Please set the missing variables in Railway before deploying.\n');
  process.exit(1);
}

