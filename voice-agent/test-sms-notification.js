/**
 * SMS Notification Testing Script
 * Sends test job availability SMS to Sam Wagle and David Bracho
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const https = require('https');

// Configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SID = process.env.TWILIO_MESSAGING_SID;

// Test recipients
const TEST_RECIPIENTS = [
  { id: 'recW1CXg3O5I3oR0g', name: 'David Bracho', phone: '+522281957913' },
  { id: 'test_sam_wagle', name: 'Sam Wagle', phone: '+61450236063' }
];

// Production URL - Now using Railway!
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.APP_URL
  ? `https://${process.env.APP_URL}`
  : process.env.BASE_URL || 'http://localhost:3000';

// Validate environment variables
function validateEnvironment() {
  const required = {
    AIRTABLE_API_KEY,
    AIRTABLE_BASE_ID,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER
  };
  
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

/**
 * Make Airtable API request
 */
function makeAirtableRequest(tableName, options = {}) {
  return new Promise((resolve, reject) => {
    const { filterByFormula, maxRecords, fields, sort } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filterByFormula) {
      params.append('filterByFormula', filterByFormula);
    }
    
    if (maxRecords) {
      params.append('maxRecords', maxRecords.toString());
    }
    
    if (fields && fields.length > 0) {
      fields.forEach(field => params.append('fields[]', field));
    }
    
    if (sort && sort.length > 0) {
      sort.forEach((sortOption, index) => {
        params.append(`sort[${index}][field]`, sortOption.field);
        params.append(`sort[${index}][direction]`, sortOption.direction);
      });
    }

    const queryString = params.toString();
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}${queryString ? '?' + queryString : ''}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAgent/1.0',
      },
      timeout: 10000,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (jsonData.error) {
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData);
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Get record by ID from Airtable
 */
function getRecordById(tableName, recordId) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    const requestOptions = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAgent/1.0',
      },
      timeout: 10000,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (jsonData.error) {
            if (jsonData.error.type === 'NOT_FOUND') {
              resolve(null);
              return;
            }
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData);
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Find an open or scheduled job occurrence
 */
async function findJobOccurrence(specificJobId = null) {
  if (specificJobId) {
    console.log(`🔍 Fetching specific job occurrence: ${specificJobId}...\n`);
    const jobRecord = await getRecordById('Job Occurrences', specificJobId);
    
    if (!jobRecord) {
      throw new Error(`Job occurrence not found: ${specificJobId}`);
    }
    
    return jobRecord;
  }
  
  console.log('🔍 Searching for job occurrences in Airtable...\n');
  
  // Try to find an "Open" job first - fetch all fields to see what's available
  let response = await makeAirtableRequest('Job Occurrences', {
    filterByFormula: `{Status} = 'Open'`,
    maxRecords: 1,
    sort: [{ field: 'Scheduled At', direction: 'asc' }]
  });
  
  // If no open jobs, try scheduled jobs
  if (!response.records || response.records.length === 0) {
    console.log('⚠️  No "Open" jobs found, looking for "Scheduled" jobs...\n');
    response = await makeAirtableRequest('Job Occurrences', {
      filterByFormula: `{Status} = 'Scheduled'`,
      maxRecords: 1,
      sort: [{ field: 'Scheduled At', direction: 'asc' }]
    });
  }
  
  if (!response.records || response.records.length === 0) {
    throw new Error('No job occurrences found in Airtable');
  }
  
  return response.records[0];
}

/**
 * Format date for SMS (short format)
 */
function formatDateForSMS(dateString) {
  if (!dateString) return 'TBD';
  
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-AU', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch (error) {
    return 'TBD';
  }
}

/**
 * Format time for SMS
 */
function formatTimeForSMS(timeString) {
  if (!timeString) return 'TBD';
  
  // If time is in "4:30 PM" format, return as is
  const timeMatch = timeString.match(/(\d{1,2}:\d{2}\s?(AM|PM))/i);
  if (timeMatch) {
    return timeMatch[0];
  }
  
  return timeString;
}

/**
 * Generate SMS message
 */
function generateSMS(jobOccurrence, patient, employeeId) {
  const jobUrl = `${BASE_URL}/job/${jobOccurrence.id}?emp=${employeeId}`;
  
  const patientName = patient ? (patient.fields['Patient Full Name'] || 'Patient') : 'Patient';
  const shortDate = formatDateForSMS(jobOccurrence.fields['Scheduled At']);
  const shortTime = formatTimeForSMS(jobOccurrence.fields['Time']);
  
  return `JOB AVAILABLE: ${patientName}, ${shortDate} ${shortTime}. View details: ${jobUrl}`;
}

/**
 * Send SMS via Twilio
 */
function sendSMS(to, message) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      From: TWILIO_PHONE_NUMBER,
      To: to,
      Body: message,
      MessagingServiceSid: TWILIO_MESSAGING_SID || ''
    }).toString();

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const requestOptions = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'VoiceAgent/1.0',
      },
      timeout: 10000,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (res.statusCode >= 400) {
            resolve({
              success: false,
              error: jsonData.message || `HTTP ${res.statusCode}`,
              to
            });
          } else {
            resolve({
              success: true,
              messageSid: jsonData.sid,
              status: jsonData.status,
              to
            });
          }
        } catch (parseError) {
          resolve({
            success: false,
            error: `Failed to parse response: ${parseError.message}`,
            to
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        to
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        to
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('==================================================');
    console.log('  SMS NOTIFICATION TEST SCRIPT');
    console.log('==================================================\n');
    
    // Validate environment
    validateEnvironment();
    console.log('✅ Environment variables validated\n');
    
    // Use specific job ID for testing
    const SPECIFIC_JOB_ID = 'recIW74yZVY4DLuq2';
    
    // Find a job occurrence
    const jobOccurrence = await findJobOccurrence(SPECIFIC_JOB_ID);
    console.log('✅ Found job occurrence:');
    console.log(`   ID: ${jobOccurrence.id}`);
    console.log(`   Occurrence ID: ${jobOccurrence.fields['Occurrence ID'] || 'N/A'}`);
    console.log(`   Status: ${jobOccurrence.fields['Status']}`);
    console.log(`   Scheduled: ${jobOccurrence.fields['Scheduled At'] || 'N/A'}`);
    console.log(`   Time: ${jobOccurrence.fields['Time'] || 'N/A'}\n`);
    
    // Get patient details
    let patient = null;
    const patientId = jobOccurrence.fields['Patient']?.[0] || jobOccurrence.fields['Patient ID']?.[0];
    
    // Try to use Patient TXT lookup field first if available
    const patientNameLookup = jobOccurrence.fields['Patient TXT'];
    
    if (patientId) {
      try {
        patient = await getRecordById('Patients', patientId);
        console.log('✅ Found patient:');
        console.log(`   Name: ${patient.fields['Patient Full Name'] || 'N/A'}\n`);
      } catch (error) {
        console.log('⚠️  Could not fetch patient details:', error.message);
        if (patientNameLookup) {
          console.log(`   Using lookup field: ${patientNameLookup}\n`);
          // Create a pseudo-patient object for SMS generation
          patient = { fields: { 'Patient Full Name': patientNameLookup } };
        } else {
          console.log('');
        }
      }
    } else if (patientNameLookup) {
      console.log('✅ Found patient from lookup field:');
      console.log(`   Name: ${patientNameLookup}\n`);
      patient = { fields: { 'Patient Full Name': patientNameLookup } };
    } else {
      console.log('⚠️  No patient associated with this job\n');
    }
    
    // Get provider details (optional, for display)
    const providerId = jobOccurrence.fields['Provider']?.[0];
    if (providerId) {
      try {
        const provider = await getRecordById('Providers', providerId);
        console.log('✅ Found provider:');
        console.log(`   Name: ${provider.fields['Name'] || 'N/A'}\n`);
      } catch (error) {
        console.log('⚠️  Could not fetch provider details:', error.message, '\n');
      }
    }
    
    console.log('==================================================');
    console.log('  SENDING SMS MESSAGES');
    console.log('==================================================\n');
    
    // Send SMS to each recipient
    const results = [];
    for (const recipient of TEST_RECIPIENTS) {
      const smsMessage = generateSMS(jobOccurrence, patient, recipient.id);
      
      console.log(`📱 Sending to ${recipient.name} (${recipient.phone})...`);
      console.log(`   Message: "${smsMessage}"`);
      console.log(`   Length: ${smsMessage.length} characters\n`);
      
      const result = await sendSMS(recipient.phone, smsMessage);
      results.push({ ...result, recipient });
      
      if (result.success) {
        console.log(`✅ SUCCESS - Message SID: ${result.messageSid}`);
        console.log(`   Status: ${result.status}\n`);
      } else {
        console.log(`❌ FAILED - Error: ${result.error}\n`);
      }
      
      // Small delay between sends
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('==================================================');
    console.log('  SUMMARY');
    console.log('==================================================\n');
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`Total messages: ${results.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}\n`);
    
    if (successCount > 0) {
      console.log('📱 Check your phones for SMS messages!\n');
    }
    
    // Show job URL for manual testing
    console.log('🔗 Test URLs:');
    TEST_RECIPIENTS.forEach(recipient => {
      const jobUrl = `${BASE_URL}/job/${jobOccurrence.id}?emp=${recipient.id}`;
      console.log(`   ${recipient.name}: ${jobUrl}`);
    });
    console.log('\n');
    
    if (failureCount > 0) {
      console.log('⚠️  Some messages failed to send. Check the errors above.');
      
      // Check for region permission errors
      const regionErrors = results.filter(r => !r.success && r.error && r.error.includes('region'));
      if (regionErrors.length > 0) {
        console.log('\n💡 TIP: If you see "Permission to send an SMS has not been enabled for the region"');
        console.log('   this means Twilio needs to be configured to send SMS to that country.');
        console.log('   Contact Twilio support or check your Twilio account settings.\n');
      }
      process.exit(1);
    }
    
    console.log('✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();
