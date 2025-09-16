#!/usr/bin/env node

/**
 * Test Reschedule Confirmation SMS
 * Send short confirmation message for rescheduled appointments
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

console.log('📱 Testing Reschedule Confirmation SMS...\n');

async function sendRescheduleConfirmationSMS() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingSid = process.env.TWILIO_MESSAGING_SID;
    
    if (!accountSid || !authToken || !fromNumber || !messagingSid) {
      console.log('❌ Missing Twilio credentials');
      return;
    }

    // Test reschedule confirmation data
    const patientName = 'Oliver Smith';
    const newDateTime = 'Oct 15 7:30PM';
    const employeeName = 'David Bracho';
    
    // Short reschedule confirmation SMS (no URL needed)
    const confirmationMessage = `RESCHEDULED: ${patientName} moved to ${newDateTime}. Confirmation sent. - Healthcare Services`;

    const toNumber = '+522281957913';
    
    console.log('📤 Sending Reschedule Confirmation SMS:');
    console.log(`   📞 From: ${fromNumber}`);
    console.log(`   📱 To: ${toNumber} (${employeeName})`);
    console.log(`   📝 Length: ${confirmationMessage.length} characters (${confirmationMessage.length <= 160 ? 'SINGLE SEGMENT ✅' : 'MULTIPLE SEGMENTS ❌'})`);
    console.log('');
    console.log('📨 Confirmation SMS Content:');
    console.log(`"${confirmationMessage}"`);
    console.log('');
    console.log('💡 This message confirms:');
    console.log(`   👤 Patient: ${patientName}`);
    console.log(`   📅 New Time: ${newDateTime}`);
    console.log(`   ✅ Action: Rescheduled successfully`);
    console.log(`   📋 No URL needed (action already complete)`);
    console.log('');
    
    // Prepare POST data
    const postData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: confirmationMessage,
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

    console.log('🚀 Sending Reschedule Confirmation SMS...');

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
            console.log('✅ RESCHEDULE CONFIRMATION SMS SENT!');
            console.log(`📨 Message SID: ${response.sid}`);
            console.log(`📊 Status: ${response.status}`);
            console.log(`📏 Segments: ${response.num_segments || '1'}`);
            
            console.log('\n🎉 RESCHEDULE WORKFLOW COMPLETE!');
            console.log('📞 Voice call: Employee reschedules via speech');
            console.log('📱 SMS confirmation: Automatic notification sent');
            console.log('💼 Professional workflow for client demo!');
            
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

sendRescheduleConfirmationSMS();
