#!/usr/bin/env node

/**
 * Debug User Data Script
 * Search for specific employee PIN and phone number
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

console.log('🔍 Searching for Employee PIN 2001 and David Bracho...\n');

function makeAirtableRequest(filterFormula) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    
    const queryString = params.toString();
    const path = `/v0/${AIRTABLE_BASE_ID}/Employees${queryString ? '?' + queryString : ''}`;
    
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

async function searchForUser() {
  try {
    // Search by PIN
    console.log('1. Searching for Employee PIN 2001...');
    let result = await makeAirtableRequest(`{Employee PIN} = 2001`);
    
    if (result.success && result.data.records && result.data.records.length > 0) {
      console.log('   ✅ Found employee with PIN 2001:');
      const employee = result.data.records[0];
      console.log(`   Name: ${employee.fields['Display Name']}`);
      console.log(`   PIN: ${employee.fields['Employee PIN']}`);
      console.log(`   Phone: ${employee.fields['Phone']}`);
      console.log(`   Active: ${employee.fields['Active']}`);
      console.log(`   Provider: ${employee.fields['Provider']}`);
      console.log(`   Record ID: ${employee.id}`);
    } else {
      console.log('   ❌ No employee found with PIN 2001');
    }

    // Search by name
    console.log('\n2. Searching for "David Bracho"...');
    result = await makeAirtableRequest(`{Display Name} = "David Bracho"`);
    
    if (result.success && result.data.records && result.data.records.length > 0) {
      console.log('   ✅ Found David Bracho:');
      const employee = result.data.records[0];
      console.log(`   Name: ${employee.fields['Display Name']}`);
      console.log(`   PIN: ${employee.fields['Employee PIN']}`);
      console.log(`   Phone: ${employee.fields['Phone']}`);
      console.log(`   Active: ${employee.fields['Active']}`);
      console.log(`   Provider: ${employee.fields['Provider']}`);
      console.log(`   Record ID: ${employee.id}`);
    } else {
      console.log('   ❌ No employee found with name "David Bracho"');
    }

    // Search for phone number
    console.log('\n3. Searching for phone "+522281957913"...');
    result = await makeAirtableRequest(`{Phone} = "+522281957913"`);
    
    if (result.success && result.data.records && result.data.records.length > 0) {
      console.log('   ✅ Found employee with phone +522281957913:');
      const employee = result.data.records[0];
      console.log(`   Name: ${employee.fields['Display Name']}`);
      console.log(`   PIN: ${employee.fields['Employee PIN']}`);
      console.log(`   Phone: ${employee.fields['Phone']}`);
    } else {
      console.log('   ❌ No employee found with phone "+522281957913"');
      
      // Try without country code
      console.log('\n4. Searching for phone "2281957913" (without country code)...');
      result = await makeAirtableRequest(`{Phone} = "2281957913"`);
      
      if (result.success && result.data.records && result.data.records.length > 0) {
        console.log('   ✅ Found employee with phone 2281957913:');
        const employee = result.data.records[0];
        console.log(`   Name: ${employee.fields['Display Name']}`);
        console.log(`   PIN: ${employee.fields['Employee PIN']}`);
        console.log(`   Phone: ${employee.fields['Phone']}`);
      } else {
        console.log('   ❌ No employee found with phone "2281957913"');
      }
    }

    // List all employees for reference
    console.log('\n5. All employees in system (first 20):');
    result = await makeAirtableRequest();
    
    if (result.success && result.data.records) {
      result.data.records.forEach((employee, index) => {
        console.log(`   ${index + 1}. ${employee.fields['Display Name']} - PIN: ${employee.fields['Employee PIN']} - Phone: ${employee.fields['Phone']}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchForUser();
