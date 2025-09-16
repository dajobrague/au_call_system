#!/usr/bin/env node

/**
 * Test New Job Occurrence Approach
 * Test fetching occurrences via Job Template's Occurrences field
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

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

console.log('🔍 Testing New Job Occurrence Approach...\n');

function getRecord(tableName, recordId) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ success: !jsonData.error, data: jsonData, status: res.statusCode });
        } catch (error) {
          reject(error);
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

async function testNewApproach() {
  try {
    const jobTemplateId = 'rec42XuWi9vYbFw62';
    const employeeId = 'recW1CXg3O5I3oR0g'; // David Bracho
    const today = '2025-09-09';
    
    console.log(`📋 Testing new approach with:`);
    console.log(`   Job Template: ${jobTemplateId} (job code 010101)`);
    console.log(`   Employee: ${employeeId} (David Bracho)`);
    console.log(`   Today: ${today}\n`);

    // Step 1: Get Job Template with Occurrences field
    console.log('1. Getting Job Template with Occurrences field...');
    const jobResult = await getRecord('Job Templates', jobTemplateId);
    
    if (!jobResult.success || !jobResult.data.fields) {
      console.log('❌ Failed to get job template');
      return;
    }
    
    const jobTemplate = jobResult.data.fields;
    const occurrenceIds = jobTemplate['Occurrences'] || [];
    
    console.log(`   ✅ Job Template: ${jobTemplate['Title']}`);
    console.log(`   📋 Occurrence IDs: ${JSON.stringify(occurrenceIds)}`);
    console.log(`   📊 Total Occurrences: ${occurrenceIds.length}`);

    if (occurrenceIds.length === 0) {
      console.log('   ⚠️  No occurrences linked to this job template');
      return;
    }

    // Step 2: Fetch each occurrence
    console.log('\n2. Fetching individual occurrences...');
    for (let i = 0; i < occurrenceIds.length; i++) {
      const occurrenceId = occurrenceIds[i];
      console.log(`\n   Fetching occurrence ${i + 1}: ${occurrenceId}`);
      
      const occResult = await getRecord('Job Occurrences', occurrenceId);
      
      if (occResult.success && occResult.data.fields) {
        const occ = occResult.data.fields;
        console.log(`   ✅ ${occ['Occurrence ID']} - ${occ['Scheduled At']} - Status: ${occ['Status']}`);
        console.log(`      Assigned Employee: ${occ['Assigned Employee']}`);
        console.log(`      Is David Bracho assigned: ${occ['Assigned Employee']?.includes(employeeId) ? 'YES' : 'NO'}`);
        console.log(`      Is Scheduled: ${occ['Status'] === 'Scheduled' ? 'YES' : 'NO'}`);
        console.log(`      Is Future: ${occ['Scheduled At'] >= today ? 'YES' : 'NO'}`);
        
        const isFutureScheduledForDavid = 
          occ['Status'] === 'Scheduled' && 
          occ['Scheduled At'] >= today && 
          occ['Assigned Employee']?.includes(employeeId);
        
        console.log(`      ✅ MATCHES CRITERIA: ${isFutureScheduledForDavid ? 'YES' : 'NO'}`);
      } else {
        console.log(`   ❌ Failed to fetch occurrence: ${occResult.data.error?.message || 'Unknown error'}`);
      }
    }

    // Step 3: Summary
    console.log('\n📊 SUMMARY:');
    console.log('This approach will:');
    console.log('1. Get Job Template with Occurrences field ✅');
    console.log('2. Fetch each occurrence by ID ✅');
    console.log('3. Filter for: Scheduled + Future + Assigned to Employee ✅');
    console.log('4. Sort by date and limit to 3 ✅');
    console.log('\nThis is much more efficient than complex Airtable queries!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testNewApproach();
