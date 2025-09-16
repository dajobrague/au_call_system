#!/usr/bin/env node

/**
 * Test Short SMS for Production
 * Send concise SMS message that fits in single segment
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

console.log('📱 Testing Short SMS for Production...\n');

async function sendShortSMS() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingSid = process.env.TWILIO_MESSAGING_SID;
    
    if (!accountSid || !authToken || !fromNumber || !messagingSid) {
      console.log('❌ Missing Twilio credentials');
      return;
    }

    // Production job URL
    const jobUrl = 'https://sam-voice-agent.vercel.app/job/recIW74yZVY4DLuq2?emp=recW1CXg3O5I3oR0g';
    
    // Short, concise SMS message (under 160 characters for single segment)
    const shortMessage = `JOB AVAILABLE: Oliver Smith, Sept 10 4:30PM. View details: ${jobUrl}`;

    const toNumber = '+522281957913';
    
    console.log('📤 Sending Short SMS:');
    console.log(`   📞 From: ${fromNumber}`);
    console.log(`   📱 To: ${toNumber}`);
    console.log(`   📝 Length: ${shortMessage.length} characters (${shortMessage.length <= 160 ? 'SINGLE SEGMENT ✅' : 'MULTIPLE SEGMENTS ❌'})`);
    console.log('');
    console.log('📨 Short SMS Content:');
    console.log(`"${shortMessage}"`);
    console.log('');
    
    // Prepare POST data
    const postData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: shortMessage,
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

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📨 Twilio Response (${res.statusCode}):`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ SHORT SMS SENT SUCCESSFULLY!');
            console.log(`📨 Message SID: ${response.sid}`);
            console.log(`📊 Status: ${response.status}`);
            console.log(`📞 From: ${response.from}`);
            console.log(`📱 To: ${response.to}`);
            console.log(`📏 Segments: ${response.num_segments || '1'}`);
            
            console.log('\n🎉 PERFECT FOR CLIENT DEMO!');
            console.log('📱 Single segment SMS = Reliable delivery');
            console.log('🌐 Click link to show professional job interface');
            console.log('💼 Complete healthcare workflow demonstration ready!');
            
          } else {
            console.log('❌ SMS FAILED');
            console.log(`Error: ${response.message || 'Unknown error'}`);
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

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendShortSMS();
