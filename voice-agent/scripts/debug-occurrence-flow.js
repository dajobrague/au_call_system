#!/usr/bin/env node

/**
 * Debug Job Occurrence Flow
 * Simulates the exact flow the voice system uses to find occurrences
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

console.log('🔍 Debugging Job Occurrence Flow - Exact Voice System Simulation...\n');

function getRecord(tableName, recordId, fields) {
  return new Promise((resolve, reject) => {
    let path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    if (fields && fields.length > 0) {
      const params = new URLSearchParams();
      fields.forEach(field => params.append('fields[]', field));
      path += '?' + params.toString();
    }
    
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

    console.log(`📡 GET ${tableName}/${recordId}`);

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

function makeAirtableRequest(tableName, filterFormula) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    params.append('maxRecords', '1');
    
    const queryString = params.toString();
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}${queryString ? '?' + queryString : ''}`;
    
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

async function simulateVoiceFlow() {
  try {
    const jobCode = '010101';
    const employeeId = 'recW1CXg3O5I3oR0g'; // David Bracho
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🎯 Simulating voice flow for job code ${jobCode}:`);
    console.log(`   Employee: David Bracho (${employeeId})`);
    console.log(`   Today: ${today}\n`);

    // Step 1: Job Template Lookup (what the voice system does)
    console.log('1. Job Template Lookup (validateJobCode):');
    const jobResult = await makeAirtableRequest('Job Templates', `{Job Code} = '${jobCode}'`);
    
    if (!jobResult.success || !jobResult.data.records || jobResult.data.records.length === 0) {
      console.log('❌ Job template not found');
      return;
    }
    
    const jobTemplate = jobResult.data.records[0].fields;
    const occurrenceIds = jobTemplate['Occurrences'] || [];
    
    console.log(`   ✅ Found: ${jobTemplate['Title']} (${jobTemplate['Service Type']})`);
    console.log(`   📋 Occurrence IDs: ${JSON.stringify(occurrenceIds)}`);
    console.log(`   👤 Default Employee: ${jobTemplate['Default Employee']}`);
    console.log(`   🔍 Is David in Job Templates? ${jobTemplate['Default Employee']?.includes(employeeId) ? 'YES' : 'NO'}`);

    if (occurrenceIds.length === 0) {
      console.log('   ⚠️  No occurrence IDs in job template');
      return;
    }

    // Step 2: Fetch Each Occurrence (what our service does)
    console.log('\n2. Fetching Occurrences by ID:');
    const occurrences = [];
    
    for (let i = 0; i < occurrenceIds.length; i++) {
      const occurrenceId = occurrenceIds[i];
      console.log(`\n   Fetching occurrence ${i + 1}: ${occurrenceId}`);
      
      const occResult = await getRecord('Job Occurrences', occurrenceId);
      
      if (occResult.success && occResult.data.fields) {
        const occ = occResult.data.fields;
        
        console.log(`   ✅ ${occ['Occurrence ID']} - ${occ['Scheduled At']}`);
        console.log(`      Status: ${occ['Status']}`);
        console.log(`      Assigned Employee: ${occ['Assigned Employee']}`);
        
        // Check all our filtering criteria
        const isScheduled = occ['Status'] === 'Scheduled';
        const isFuture = occ['Scheduled At'] >= today;
        const isAssignedToEmployee = occ['Assigned Employee']?.includes(employeeId);
        
        console.log(`      ✅ Is Scheduled: ${isScheduled ? 'YES' : 'NO'}`);
        console.log(`      ✅ Is Future: ${isFuture ? 'YES' : 'NO'} (${occ['Scheduled At']} >= ${today})`);
        console.log(`      ✅ Is Assigned to David: ${isAssignedToEmployee ? 'YES' : 'NO'}`);
        
        const matchesCriteria = isScheduled && isFuture && isAssignedToEmployee;
        console.log(`      🎯 MATCHES ALL CRITERIA: ${matchesCriteria ? 'YES' : 'NO'}`);
        
        if (matchesCriteria) {
          occurrences.push({
            id: occurrenceId,
            occurrenceId: occ['Occurrence ID'],
            scheduledAt: occ['Scheduled At'],
            status: occ['Status']
          });
        }
      } else {
        console.log(`   ❌ Failed to fetch: ${occResult.data.error?.message || 'Not found'}`);
      }
    }

    // Step 3: Results
    console.log(`\n3. Final Results:`);
    console.log(`   📊 Total Occurrences: ${occurrenceIds.length}`);
    console.log(`   ✅ Matching Criteria: ${occurrences.length}`);
    
    if (occurrences.length > 0) {
      console.log(`   🎉 SUCCESS! Voice system should say:`);
      if (occurrences.length === 1) {
        console.log(`   "I found 1 upcoming appointment to reschedule. Press 1 for September 9th."`);
      } else if (occurrences.length === 2) {
        console.log(`   "I found 2 upcoming appointments to reschedule. Press 1 for September 9th, Press 2 for September 11th."`);
      }
    } else {
      console.log(`   ⚠️  No matching occurrences - voice system will say "No upcoming appointments found"`);
    }

    // Step 4: Debug Info
    console.log(`\n4. Debug Information:`);
    console.log(`   Today's Date: ${today}`);
    console.log(`   Employee ID: ${employeeId}`);
    console.log(`   Job Template ID: ${jobResult.data.records[0].id}`);
    
    if (occurrences.length === 0) {
      console.log(`\n🔍 Why no results?`);
      console.log(`   Check if:`);
      console.log(`   - Occurrences are assigned to David Bracho (${employeeId})`);
      console.log(`   - Status is exactly "Scheduled"`);
      console.log(`   - Scheduled At is today (${today}) or future`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

simulateVoiceFlow();
