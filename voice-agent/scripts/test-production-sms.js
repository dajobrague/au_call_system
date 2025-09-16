#!/usr/bin/env node

/**
 * Test Production SMS with Real URL
 * Send SMS message with production job acceptance URL for client demo
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

console.log('📱 Testing Production SMS with Real Job Acceptance URL...\n');

async function sendProductionSMS() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingSid = process.env.TWILIO_MESSAGING_SID;
    
    if (!accountSid || !authToken || !fromNumber || !messagingSid) {
      console.log('❌ Missing Twilio credentials');
      return;
    }

    // Real production job URL with David Bracho's employee ID
    const jobUrl = 'https://sam-voice-agent.vercel.app/job/recIW74yZVY4DLuq2?emp=recW1CXg3O5I3oR0g';
    
    // Professional SMS message for client demo
    const smsMessage = `🏥 JOB AVAILABLE: Initial Assessment for Oliver Smith on September 10th at 4:30 PM at 123 George St, Sydney NSW. ` +
      `Reason: "I have a family emergency and cannot make it" (David Bracho). ` +
      `View details and respond: ${jobUrl} - Healthcare Services`;

    const toNumber = '+522281957913'; // Your phone for demo
    
    console.log('📤 Sending Production SMS for Client Demo:');
    console.log(`   📞 From: ${fromNumber}`);
    console.log(`   📱 To: ${toNumber}`);
    console.log(`   🔗 Job URL: ${jobUrl}`);
    console.log(`   📝 Message Length: ${smsMessage.length} characters`);
    console.log('');
    console.log('📨 SMS Content:');
    console.log(`"${smsMessage}"`);
    console.log('');
    
    // Prepare POST data
    const postData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: smsMessage,
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

    console.log('🚀 Sending SMS via Twilio API...');

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n📨 Twilio Response (${res.statusCode}):`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ PRODUCTION SMS SENT SUCCESSFULLY!');
            console.log(`📨 Message SID: ${response.sid}`);
            console.log(`📊 Status: ${response.status}`);
            console.log(`📞 From: ${response.from}`);
            console.log(`📱 To: ${response.to}`);
            
            console.log('\n🎉 CLIENT DEMO READY!');
            console.log('📱 Check your phone for the SMS with production job link');
            console.log('🌐 Click the link to show the professional job acceptance interface');
            console.log(`🔗 Production URL: ${jobUrl}`);
            console.log('\n💼 What your client will see:');
            console.log('1. 📱 SMS with job details and clickable link');
            console.log('2. 🌐 Professional web interface with provider logo');
            console.log('3. 📋 Complete job information (patient, address, reason)');
            console.log('4. ✅ Accept/Decline buttons that update Airtable');
            console.log('5. 🎉 Success confirmation after action');
            
          } else {
            console.log('❌ SMS FAILED');
            console.log(`Error: ${response.message || 'Unknown error'}`);
            console.log(`Code: ${response.code || 'Unknown'}`);
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

sendProductionSMS();
