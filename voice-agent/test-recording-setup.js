/**
 * Test Script for Call Recording Setup
 * Verifies that all recording services are properly configured
 */

const { initializeRecording, recordingHooks } = require('./recording-integration');

async function testRecordingSetup() {
  console.log('🧪 Testing Call Recording Setup...\n');

  try {
    // Test 1: Initialize recording services
    console.log('1. Testing recording service initialization...');
    const initialized = await initializeRecording();
    
    if (initialized) {
      console.log('✅ Recording services initialized successfully\n');
    } else {
      console.log('⚠️ Recording services not initialized (may be disabled)\n');
    }

    // Test 2: Health check
    console.log('2. Testing health check...');
    const health = await recordingHooks.healthCheck();
    console.log('Health status:', health);
    console.log('');

    // Test 3: Simulate call recording lifecycle (if initialized)
    if (initialized && health.healthy) {
      console.log('3. Testing call recording lifecycle...');
      
      const testCallSid = 'TEST_' + Date.now();
      console.log(`Using test call SID: ${testCallSid}`);

      // Start recording
      const startData = {
        callerNumber: '+1234567890',
        twilioNumber: '+0987654321',
        accountSid: 'TEST_ACCOUNT',
        streamSid: 'TEST_STREAM'
      };
      
      const started = await recordingHooks.onCallStarted(testCallSid, startData);
      console.log(`Recording started: ${started}`);

      // Simulate some audio data
      const testAudioData = Buffer.alloc(160, 128).toString('base64'); // Silent μ-law audio
      for (let i = 0; i < 10; i++) {
        recordingHooks.onAudioData(testCallSid, testAudioData);
      }
      console.log('Added 10 test audio chunks');

      // Simulate authentication
      const testEmployee = {
        id: 'test_employee',
        name: 'Test Employee',
        pin: 1234,
        phone: '+1234567890'
      };
      const testProvider = {
        id: 'test_provider',
        name: 'Test Provider'
      };
      
      const authUpdated = recordingHooks.onEmployeeAuthenticated(testCallSid, testEmployee, testProvider);
      console.log(`Auth updated: ${authUpdated}`);

      // Check recording status
      const status = recordingHooks.getRecordingStatus(testCallSid);
      console.log('Recording status:', status);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // End recording
      const stopped = await recordingHooks.onCallEnded(testCallSid, 'test_completed');
      console.log(`Recording stopped: ${stopped}`);
      console.log('');
    }

    console.log('4. Configuration check...');
    console.log('Environment variables to set in .env.local:');
    console.log('  - AWS_ACCESS_KEY_ID=your_aws_access_key');
    console.log('  - AWS_SECRET_ACCESS_KEY=your_aws_secret_key');
    console.log('  - AWS_REGION=us-west-2');
    console.log('  - AWS_S3_BUCKET=your-call-recordings-bucket');
    console.log('  - RECORDING_ENABLED=true');
    console.log('');

    console.log('✅ Recording setup test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure .env.local exists with AWS credentials');
    console.log('2. Verify S3 bucket exists and is accessible');
    console.log('3. Check AWS credentials have S3 permissions');
    console.log('4. Ensure RECORDING_ENABLED=true in .env.local');
  }
}

// Run the test
if (require.main === module) {
  testRecordingSetup().then(() => {
    console.log('\n🏁 Test completed. You can now integrate with ngrok-websocket-test.js');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
  });
}

module.exports = { testRecordingSetup };
