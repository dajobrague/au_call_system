#!/usr/bin/env node

/**
 * Direct SMS Test
 * Test real Twilio SMS sending
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

console.log('📱 Direct SMS Test...\n');

async function sendTestSMS() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingSid = process.env.TWILIO_MESSAGING_SID;
    
    console.log('📋 Configuration:');
    console.log(`   Account SID: ${accountSid ? '✅' : '❌'}`);
    console.log(`   Auth Token: ${authToken ? '✅' : '❌'}`);
    console.log(`   Phone Number: ${fromNumber || '❌'}`);
    console.log(`   Messaging SID: ${messagingSid || '❌'}`);
    
    if (!accountSid || !authToken || !fromNumber || !messagingSid) {
      console.log('\n❌ Missing required Twilio credentials');
      return;
    }

    const toNumber = '+522281957913';
    const message = 'TEST: Healthcare voice agent SMS working! JOB AVAILABLE: Initial Assessment for Oliver Smith on Sept 9th at 4:30 PM. Reason: Family emergency. Reply YES to accept job.';
    
    console.log(`\n📤 Sending SMS:`);
    console.log(`   From: ${fromNumber}`);
    console.log(`   To: ${toNumber}`);
    console.log(`   Message: "${message}"`);
    
    // Prepare POST data
    const postData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: message,
      MessagingServiceSid: messagingSid
    }).toString();
    
    // Prepare authentication
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    };

    console.log('\n🚀 Calling Twilio API...');

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n📨 Response Status: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ SMS SENT SUCCESSFULLY!');
            console.log(`📨 Message SID: ${response.sid}`);
            console.log(`📊 Status: ${response.status}`);
            console.log(`📞 From: ${response.from}`);
            console.log(`📱 To: ${response.to}`);
            console.log('\n🎉 Check your phone (+522281957913) for the SMS!');
            console.log('📝 Reply "YES" to test the webhook response handling.');
            console.log('📡 SMS webhook: http://localhost:3000/api/twilio/sms');
          } else {
            console.log('❌ SMS FAILED');
            console.log(`Error: ${response.message || 'Unknown error'}`);
            console.log(`Code: ${response.code || 'Unknown'}`);
            if (response.more_info) {
              console.log(`More info: ${response.more_info}`);
            }
          }
          
        } catch (parseError) {
          console.log(`❌ Parse error: ${parseError.message}`);
          console.log(`Raw response: ${data}`);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request error: ${error.message}`);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Request timeout');
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendTestSMS();
