#!/usr/bin/env node

/**
 * Test SMS Webhook Locally
 * Test the SMS webhook endpoint without signature validation
 */

const https = require('http'); // Use http for localhost

console.log('🧪 Testing SMS Webhook Locally...\n');

async function testSMSWebhook() {
  try {
    console.log('📱 Testing SMS webhook at http://localhost:3000/api/twilio/sms');
    
    // Test data simulating a Twilio SMS webhook
    const testData = new URLSearchParams({
      From: '+522281957913',
      To: '+17744834860',
      Body: 'YES',
      MessageSid: 'TEST_MESSAGE_123',
      SmsStatus: 'received',
      AccountSid: 'TEST_ACCOUNT',
      // Add a test signature to bypass validation in development
      'X-Twilio-Signature': 'test-signature'
    });

    const postData = testData.toString();
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/twilio/sms',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'X-Twilio-Signature': 'test-signature'
      }
    };

    console.log('📤 Sending test SMS webhook request...');
    console.log(`   From: +522281957913 (David Bracho)`);
    console.log(`   Body: YES`);
    console.log(`   MessageSid: TEST_MESSAGE_123`);

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n📨 Response Status: ${res.statusCode}`);
        console.log(`📨 Response Headers:`, res.headers);
        console.log(`📨 Response Body: ${data}`);
        
        if (res.statusCode === 200) {
          console.log('\n✅ SMS webhook is working!');
          console.log('The system can receive and process SMS responses.');
        } else {
          console.log('\n❌ SMS webhook error');
          console.log('Check the response details above.');
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request error:', error.message);
      console.log('Make sure the development server is running on localhost:3000');
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Add a small delay to ensure the request completes
testSMSWebhook();

// Keep the script running for a moment to see the response
setTimeout(() => {
  console.log('\n🏁 SMS webhook test completed.');
}, 2000);
