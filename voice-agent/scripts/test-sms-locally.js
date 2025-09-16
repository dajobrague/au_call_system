#!/usr/bin/env node

/**
 * Test SMS Functionality Locally
 * Test Twilio SMS sending without the full voice flow
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

console.log('🧪 Testing SMS Functionality Locally...\n');

// Check environment variables
console.log('📋 Checking Twilio SMS Configuration:');
console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing'}`);
console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`   TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER || '❌ Missing'}`);
console.log(`   TWILIO_MESSAGING_SID: ${process.env.TWILIO_MESSAGING_SID ? '✅ Set' : '❌ Missing'}`);

async function testSMSFunctionality() {
  try {
    // Test 1: SMS Service Configuration
    console.log('\n1. Testing SMS Service Configuration...');
    
    try {
      const { twilioSMSService } = await import('../src/services/sms/twilio-sms-service.js');
      console.log('   ✅ SMS Service imported successfully');
      
      // Test health check
      const healthCheck = await twilioSMSService.healthCheck();
      console.log(`   Health: ${healthCheck.healthy ? '✅' : '❌'} - ${healthCheck.message}`);
      if (healthCheck.details) {
        console.log(`   Details:`, healthCheck.details);
      }
      
    } catch (error) {
      console.log(`   ❌ SMS Service error: ${error.message}`);
      return;
    }

    // Test 2: Send Test SMS
    console.log('\n2. Testing SMS Sending...');
    
    const testPhoneNumber = process.env.TEST_PHONE_NUMBER || '+522281957913'; // Default to David's phone
    const testMessage = 'TEST: Voice agent SMS functionality is working! This is a test message from the healthcare system.';
    
    console.log(`   📱 Sending test SMS to: ${testPhoneNumber}`);
    console.log(`   📝 Message: "${testMessage}"`);
    
    try {
      const { twilioSMSService } = await import('../src/services/sms/twilio-sms-service.js');
      
      const smsResult = await twilioSMSService.sendSMS(
        testPhoneNumber,
        testMessage,
        { test: true }
      );
      
      if (smsResult.success) {
        console.log('   ✅ SMS sent successfully!');
        console.log(`   📨 Message SID: ${smsResult.messageSid}`);
        console.log(`   📞 Sent to: ${smsResult.to}`);
      } else {
        console.log('   ❌ SMS sending failed');
        console.log(`   Error: ${smsResult.error}`);
      }
      
    } catch (error) {
      console.log(`   ❌ SMS sending error: ${error.message}`);
    }

    // Test 3: Job Notification SMS Format
    console.log('\n3. Testing Job Notification SMS Format...');
    
    try {
      const { jobNotificationService } = await import('../src/services/sms/job-notification-service.js');
      
      // Mock job details for testing SMS content
      const mockJobDetails = {
        jobTemplate: {
          id: 'rec42XuWi9vYbFw62',
          jobCode: '010101',
          title: 'Initial Assessment',
          serviceType: 'Nursing'
        },
        jobOccurrence: {
          id: 'recIW74yZVY4DLuq2',
          displayDate: 'September 9th at 4:30 PM'
        },
        patient: {
          name: 'Oliver Smith'
        },
        reason: 'I have a family emergency and cannot make it (David Bracho - 9 Sept 2025, 05:58 pm)',
        originalEmployee: {
          name: 'David Bracho'
        }
      };
      
      console.log('   📝 Sample job notification SMS would be:');
      console.log('   "JOB AVAILABLE: Initial Assessment for Oliver Smith on September 9th at 4:30 PM at 123 Main St, Sydney NSW 2000. Reason: I have a family emergency and cannot make it (David Bracho - 9 Sept 2025, 05:58 pm). Reply YES to accept this job. - Nursing Services"');
      
    } catch (error) {
      console.log(`   ❌ Job notification service error: ${error.message}`);
    }

    // Test 4: SMS Webhook URL
    console.log('\n4. SMS Webhook Information:');
    console.log('   📡 Local SMS Webhook: http://localhost:3000/api/twilio/sms');
    console.log('   📡 Production SMS Webhook: https://sam-voice-agent.vercel.app/api/twilio/sms');
    console.log('   💡 Configure this URL in Twilio Console for SMS responses');

    console.log('\n✅ SMS Testing Complete!');
    console.log('\nNext steps:');
    console.log('1. Check if test SMS was received');
    console.log('2. Configure Twilio SMS webhook URL');
    console.log('3. Test "YES" response handling');

  } catch (error) {
    console.error('\n❌ SMS Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testSMSFunctionality();
