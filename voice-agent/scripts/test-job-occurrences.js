#!/usr/bin/env node

/**
 * Test Job Occurrences Search
 * Test the search functionality for job occurrences related to specific job templates
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

console.log('🔍 Testing Job Occurrences Search...\n');

function makeAirtableRequest(tableName, filterFormula, sort) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    if (sort) {
      sort.forEach((sortOption, index) => {
        params.append(`sort[${index}][field]`, sortOption.field);
        params.append(`sort[${index}][direction]`, sortOption.direction);
      });
    }
    
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

    console.log(`📡 Query: ${filterFormula || 'All records'}`);
    console.log(`📡 URL: ${path}`);

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

async function testJobOccurrenceSearch() {
  try {
    const jobTemplateId = 'rec42XuWi9vYbFw62';
    const employeeId = 'recW1CXg3O5I3oR0g'; // David Bracho's ID
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📋 Testing with:`);
    console.log(`   Job Template ID: ${jobTemplateId}`);
    console.log(`   Employee ID: ${employeeId} (David Bracho)`);
    console.log(`   Today: ${today}`);
    console.log('');

    // Test 1: Find all occurrences for this job template
    console.log('1. All occurrences for job template rec42XuWi9vYbFw62:');
    let result = await makeAirtableRequest('Job Occurrences', `FIND('${jobTemplateId}', ARRAYJOIN({Job Template}))`);
    
    if (result.success && result.data.records) {
      console.log(`   ✅ Found ${result.data.records.length} total occurrences`);
      result.data.records.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.fields['Occurrence ID']} - ${record.fields['Scheduled At']} - Status: ${record.fields['Status']}`);
        console.log(`      Assigned Employee: ${record.fields['Assigned Employee']}`);
      });
    } else {
      console.log('   ❌ No occurrences found or error:', result.data.error?.message);
    }

    // Test 2: Find occurrences assigned to David Bracho
    console.log('\n2. All occurrences assigned to David Bracho:');
    result = await makeAirtableRequest('Job Occurrences', `FIND('${employeeId}', ARRAYJOIN({Assigned Employee}))`);
    
    if (result.success && result.data.records) {
      console.log(`   ✅ Found ${result.data.records.length} occurrences assigned to David Bracho`);
      result.data.records.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.fields['Occurrence ID']} - ${record.fields['Scheduled At']} - Status: ${record.fields['Status']}`);
        console.log(`      Job Template: ${record.fields['Job Template']}`);
      });
    } else {
      console.log('   ❌ No occurrences found or error:', result.data.error?.message);
    }

    // Test 3: Future occurrences (our actual query)
    console.log('\n3. Future occurrences with Status = Scheduled:');
    const futureFilter = `AND(
      {Status} = 'Scheduled',
      {Scheduled At} >= '${today}'
    )`;
    
    result = await makeAirtableRequest('Job Occurrences', futureFilter, [
      { field: 'Scheduled At', direction: 'asc' }
    ]);
    
    if (result.success && result.data.records) {
      console.log(`   ✅ Found ${result.data.records.length} future scheduled occurrences`);
      result.data.records.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.fields['Occurrence ID']} - ${record.fields['Scheduled At']}`);
        console.log(`      Job Template: ${record.fields['Job Template']}`);
        console.log(`      Assigned Employee: ${record.fields['Assigned Employee']}`);
      });
    } else {
      console.log('   ❌ No future occurrences found or error:', result.data.error?.message);
    }

    // Test 4: Our exact query (job template + employee + future + scheduled)
    console.log('\n4. Our exact query - Future occurrences for David Bracho and job rec42XuWi9vYbFw62:');
    const exactFilter = `AND(
      {Status} = 'Scheduled',
      {Scheduled At} >= '${today}',
      FIND('${employeeId}', ARRAYJOIN({Assigned Employee})),
      FIND('${jobTemplateId}', ARRAYJOIN({Job Template}))
    )`;
    
    result = await makeAirtableRequest('Job Occurrences', exactFilter, [
      { field: 'Scheduled At', direction: 'asc' }
    ]);
    
    if (result.success && result.data.records) {
      console.log(`   ✅ Found ${result.data.records.length} matching occurrences`);
      result.data.records.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.fields['Occurrence ID']} - ${record.fields['Scheduled At']}`);
        console.log(`      Status: ${record.fields['Status']}`);
        console.log(`      Job Template: ${record.fields['Job Template']}`);
        console.log(`      Assigned Employee: ${record.fields['Assigned Employee']}`);
        console.log(`      Patient: ${record.fields['Patient']}`);
      });
    } else {
      console.log('   ❌ No matching occurrences found');
      if (result.data.error) {
        console.log(`   Error: ${result.data.error.message}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log('If our exact query returns 0 results, the issue could be:');
    console.log('- Job template rec42XuWi9vYbFw62 has no future occurrences');
    console.log('- David Bracho (recW1CXg3O5I3oR0g) is not assigned to those occurrences');
    console.log('- The filter formula syntax is incorrect');
    console.log('- All occurrences are in the past or not "Scheduled" status');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testJobOccurrenceSearch();
