/**
 * Verify Recording Setup Script
 * Standalone version that directly uses APIs without requiring TypeScript modules
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const Airtable = require('airtable');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

async function main() {
  console.log('\n🔍 RECORDING SETUP VERIFICATION\n');
  console.log('='.repeat(60));
  
  // 1. Check Environment Variables
  console.log('\n1️⃣ ENVIRONMENT VARIABLES CHECK:');
  console.log('-'.repeat(60));
  
  const requiredEnvVars = {
    'RAILWAY_PUBLIC_DOMAIN': process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL,
    'RECORDING_STATUS_CALLBACK': process.env.RECORDING_STATUS_CALLBACK,
    'WEBSOCKET_URL': process.env.WEBSOCKET_URL || process.env.CLOUDFLARE_VOICE_PROXY_URL,
    'S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)': (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) ? '✓ Set (hidden)' : '✗ NOT SET',
    'S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)': (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY) ? '✓ Set (hidden)' : '✗ NOT SET',
    'S3_BUCKET (or AWS_S3_BUCKET)': process.env.S3_BUCKET || process.env.AWS_S3_BUCKET,
    'S3_REGION (or AWS_REGION)': process.env.S3_REGION || process.env.AWS_REGION,
    'AIRTABLE_API_KEY': process.env.AIRTABLE_API_KEY ? '✓ Set (hidden)' : '✗ NOT SET',
    'AIRTABLE_BASE_ID': process.env.AIRTABLE_BASE_ID ? '✓ Set' : '✗ NOT SET'
  };
  
  let envIssues = 0;
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value || value.includes('NOT SET')) {
      console.log(`❌ ${key}: NOT SET`);
      envIssues++;
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
  }
  
  // Construct expected callback URL
  const expectedCallbackUrl = process.env.RECORDING_STATUS_CALLBACK || 
    (process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/twilio/recording-status`
      : 'NOT SET');
  
  console.log(`\n📍 Expected Recording Callback URL:`);
  console.log(`   ${expectedCallbackUrl}`);
  
  if (expectedCallbackUrl.includes('localhost') || expectedCallbackUrl === 'NOT SET') {
    console.log(`⚠️  WARNING: Callback URL is not set to production domain!`);
    envIssues++;
  }
  
  // 2. Test S3 Connection
  console.log('\n\n2️⃣ S3 CONNECTION TEST:');
  console.log('-'.repeat(60));
  
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const s3Region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-southeast-2';
  const s3Bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  
  if (s3AccessKey && s3SecretKey) {
    try {
      const s3Client = new S3Client({
        region: s3Region,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey
        }
      });
      
      const command = new ListBucketsCommand({});
      const response = await s3Client.send(command);
      
      console.log(`✅ S3 Connection: SUCCESS`);
      console.log(`   Region: ${s3Region}`);
      console.log(`   Found ${response.Buckets?.length || 0} buckets`);
      
      if (s3Bucket) {
        const bucketExists = response.Buckets?.some(b => b.Name === s3Bucket);
        if (bucketExists) {
          console.log(`✅ Target Bucket "${s3Bucket}": EXISTS`);
        } else {
          console.log(`❌ Target Bucket "${s3Bucket}": NOT FOUND`);
          console.log(`   Available buckets:`, response.Buckets?.map(b => b.Name).join(', '));
          envIssues++;
        }
      }
    } catch (error) {
      console.log(`❌ S3 Connection: FAILED`);
      console.log(`   Error: ${error.message}`);
      envIssues++;
    }
  } else {
    console.log(`⚠️  S3 credentials not set - skipping connection test`);
    envIssues++;
  }
  
  // 3. Check Recent Call Logs
  console.log('\n\n3️⃣ RECENT CALL LOGS CHECK:');
  console.log('-'.repeat(60));
  
  let callsWithRecordings = 0;
  let callsWithoutRecordings = 0;
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.log('⚠️  Airtable credentials not set - skipping call logs check');
  } else {
    try {
      const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
      
      const records = await base(CALL_LOGS_TABLE_ID)
        .select({
          maxRecords: 10,
          sort: [{ field: 'Started At', direction: 'desc' }]
        })
        .all();
      
      console.log(`\nFound ${records.length} recent calls:\n`);
      
      records.forEach((record, index) => {
        const callSid = record.fields['CallSid'];
        const startedAt = record.fields['Started At'];
        const recordingUrl = record.fields['Recording URL (Twilio/S3)'];
        const duration = record.fields['Seconds'];
        
        const hasRecording = !!recordingUrl;
        if (hasRecording) {
          callsWithRecordings++;
        } else {
          callsWithoutRecordings++;
        }
        
        const icon = hasRecording ? '✅' : '❌';
        const recordingType = hasRecording 
          ? (recordingUrl.includes('s3') || recordingUrl.includes('amazonaws') ? 'S3' : 'Twilio')
          : 'None';
        
        console.log(`${icon} Call ${index + 1}:`);
        console.log(`   CallSid: ${callSid}`);
        console.log(`   Started: ${startedAt}`);
        console.log(`   Duration: ${duration || 'N/A'} seconds`);
        console.log(`   Recording: ${recordingType}`);
        if (hasRecording) {
          console.log(`   URL: ${recordingUrl.substring(0, 80)}...`);
        }
        console.log('');
      });
      
      console.log('-'.repeat(60));
      console.log(`📊 Summary:`);
      console.log(`   Calls with recordings: ${callsWithRecordings}`);
      console.log(`   Calls without recordings: ${callsWithoutRecordings}`);
      
      if (callsWithoutRecordings === records.length && records.length > 0) {
        console.log(`\n⚠️  WARNING: NO RECORDINGS FOUND in recent calls!`);
        envIssues++;
      }
      
    } catch (error) {
      console.log(`❌ Failed to fetch call logs: ${error.message}`);
      envIssues++;
    }
  }
  
  // 4. Final Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 FINAL SUMMARY:');
  console.log('='.repeat(60));
  
  if (envIssues === 0) {
    console.log('\n✅ All checks passed! Recording setup looks good.');
  } else {
    console.log(`\n⚠️  Found ${envIssues} issue(s) that need attention.`);
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    
    const s3AccessKey = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const s3Bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL;
    
    if (!s3AccessKey || !s3SecretKey) {
      console.log('   1. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in Railway');
      console.log('      (or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)');
    }
    
    if (!s3Bucket) {
      console.log('   2. Set S3_BUCKET in Railway (or AWS_S3_BUCKET)');
    }
    
    if (!railwayDomain) {
      console.log('   3. Set RAILWAY_PUBLIC_DOMAIN or APP_URL in Railway');
    }
    
    if (callsWithoutRecordings > 0) {
      console.log('   4. Check Railway logs for recording callback errors:');
      console.log('      - Look for "📼 Recording status endpoint called"');
      console.log('      - If not found, Twilio is not reaching the callback URL');
      console.log('      - Check Twilio console: https://console.twilio.com/us1/monitor/logs/debugger');
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});

