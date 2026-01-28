#!/usr/bin/env node

/**
 * Test Outbound Call - Localhost Testing
 * Directly triggers an outbound call for testing purposes
 */

// Register ts-node for TypeScript files
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

const { scheduleOutboundCallAfterSMS } = require('../src/services/queue/outbound-call-queue');

console.log('🧪 Outbound Call Testing Script\n');
console.log('This will schedule a test outbound call to your staff members.\n');

// Test configuration
const TEST_CONFIG = {
  // IMPORTANT: Update these values with your real data
  occurrenceId: 'recTESTCALL' + Date.now(), // Unique ID for this test
  providerId: 'YOUR_PROVIDER_ID', // Replace with actual provider record ID
  
  // Staff pool - ADD YOUR TEST PHONE NUMBERS HERE
  staffPoolIds: [
    'STAFF_ID_1', // Replace with actual employee record ID
    'STAFF_ID_2', // Replace with actual employee record ID
  ],
  
  maxRounds: 2, // How many times to call each staff member
  
  jobDetails: {
    patientName: 'John Smith',
    patientFirstName: 'John',
    patientLastInitial: 'S',
    scheduledDate: '2026-01-23',
    displayDate: 'Jan 23',
    startTime: '09:00 AM',
    endTime: '05:00 PM',
    suburb: 'Sydney CBD',
    messageTemplate: 'Hi {employeeName}, we have an urgent shift for {patientName} on {date} at {time}. It\'s in {suburb}. Press 1 to accept this shift, or press 2 to decline.'
  }
};

// Validation
if (TEST_CONFIG.providerId === 'YOUR_PROVIDER_ID') {
  console.error('❌ ERROR: Please update TEST_CONFIG with your actual provider ID');
  console.error('   1. Open this file: voice-agent/scripts/test-outbound-call.js');
  console.error('   2. Update providerId with your Airtable provider record ID');
  console.error('   3. Update staffPoolIds with your employee record IDs');
  console.error('   4. Run again');
  process.exit(1);
}

if (TEST_CONFIG.staffPoolIds.includes('STAFF_ID_1') || TEST_CONFIG.staffPoolIds.includes('STAFF_ID_2')) {
  console.error('❌ ERROR: Please update TEST_CONFIG with your actual staff IDs');
  console.error('   1. Open this file: voice-agent/scripts/test-outbound-call.js');
  console.error('   2. Update staffPoolIds array with employee record IDs from Airtable');
  console.error('   3. Make sure these employees have valid phone numbers');
  console.error('   4. Run again');
  process.exit(1);
}

async function runTest() {
  console.log('📋 Test Configuration:');
  console.log('   Occurrence ID:', TEST_CONFIG.occurrenceId);
  console.log('   Provider ID:', TEST_CONFIG.providerId);
  console.log('   Staff Pool:', TEST_CONFIG.staffPoolIds.length, 'members');
  console.log('   Max Rounds:', TEST_CONFIG.maxRounds);
  console.log('   Max Possible Calls:', TEST_CONFIG.staffPoolIds.length * TEST_CONFIG.maxRounds);
  console.log('');
  
  console.log('⏱️  Wait Time: 6 seconds (fast for testing)');
  console.log('');
  
  try {
    console.log('📞 Scheduling outbound call...');
    
    const job = await scheduleOutboundCallAfterSMS(
      TEST_CONFIG.occurrenceId,
      0.1, // Wait 0.1 minutes = 6 seconds (fast for testing)
      TEST_CONFIG
    );
    
    console.log('✅ SUCCESS! Outbound call scheduled');
    console.log('');
    console.log('📊 Job Details:');
    console.log('   Job ID:', job.id);
    console.log('   Occurrence ID:', TEST_CONFIG.occurrenceId);
    console.log('   Scheduled for:', new Date(Date.now() + 6000).toLocaleTimeString());
    console.log('');
    
    console.log('🎯 What Happens Next:');
    console.log('   1. In ~6 seconds, first staff member will receive a call');
    console.log('   2. They will hear the personalized message');
    console.log('   3. They can press 1 to accept or 2 to decline');
    console.log('   4. If declined/no answer, next person gets called');
    console.log('   5. Process continues until someone accepts or all rounds complete');
    console.log('');
    
    console.log('📱 Expected Call Order:');
    TEST_CONFIG.staffPoolIds.forEach((staffId, index) => {
      console.log(`   ${index + 1}. ${staffId}`);
    });
    console.log('   (Then repeats for round 2 if needed)');
    console.log('');
    
    console.log('🔍 Monitoring:');
    console.log('   • Watch your phone for the call!');
    console.log('   • Monitor logs: tail -f logs/*.log | grep outbound');
    console.log('   • Check ngrok: http://127.0.0.1:4040');
    console.log('   • Check Redis queue: redis-cli LRANGE bull:outbound-calls:active 0 -1');
    console.log('');
    
    console.log('✋ To Cancel Test:');
    console.log('   redis-cli DEL "bull:outbound-calls:' + job.id + '"');
    console.log('');
    
    console.log('✅ Test initiated successfully!');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Common Issues:');
    console.error('   • Redis not running: Start Redis or check RAILWAY_REDIS_URL');
    console.error('   • Invalid provider ID: Check Airtable Providers table');
    console.error('   • Invalid staff IDs: Check Airtable Employees table');
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting test in 2 seconds...\n');
setTimeout(runTest, 2000);
