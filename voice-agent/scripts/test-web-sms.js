#!/usr/bin/env node

/**
 * Test Web-Based SMS
 * Test SMS sending with job acceptance URL
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

console.log('🌐 Testing Web-Based Job Acceptance SMS...\n');

async function testWebBasedSMS() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingSid = process.env.TWILIO_MESSAGING_SID;
    
    if (!accountSid || !authToken || !fromNumber || !messagingSid) {
      console.log('❌ Missing Twilio credentials');
      return;
    }

    // Mock job details for testing
    const jobOccurrenceId = 'recIW74yZVY4DLuq2'; // From our test
    const employeeId = 'test_employee';
    
    // Generate job acceptance URL
    const baseUrl = 'http://localhost:3000'; // Local testing
    const jobUrl = `${baseUrl}/job/${jobOccurrenceId}?emp=${employeeId}&token=test123`;
    
    console.log('🔗 Generated job acceptance URL:');
    console.log(`   ${jobUrl}`);
    
    // Generate enhanced SMS content with URL
    const smsContent = `JOB AVAILABLE: Initial Assessment for Oliver Smith on Sept 9th at 4:30 PM at 123 Main St, Sydney. ` +
      `Reason: Testing web interface. ` +
      `View details and respond: ${jobUrl}`;
    
    console.log('\n📱 Enhanced SMS Content:');
    console.log(`"${smsContent}"`);
    console.log(`\n📊 SMS Length: ${smsContent.length} characters`);
    
    const toNumber = '+522281957913';
    
    console.log(`\n📤 Sending enhanced SMS to ${toNumber}...`);
    
    // Prepare POST data
    const postData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: smsContent,
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
        console.log(`\n📨 Response Status: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ WEB-BASED SMS SENT SUCCESSFULLY!');
            console.log(`📨 Message SID: ${response.sid}`);
            console.log(`📊 Status: ${response.status}`);
            
            console.log('\n🎉 Check your phone for the SMS with web link!');
            console.log('🌐 Click the link to test the web interface');
            console.log(`📱 Local job page: ${jobUrl}`);
            console.log('\n🔗 The SMS should contain a clickable link to review job details');
            
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

testWebBasedSMS();
