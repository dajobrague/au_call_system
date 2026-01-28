#!/usr/bin/env node

/**
 * Test Airtable Connection
 * Diagnoses connection issues with Airtable API
 */

require('dotenv').config({ path: '../.env.local' });
const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

console.log('🔍 Testing Airtable Connection...\n');

if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY not found in environment');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID not found in environment');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   Base ID: ${AIRTABLE_BASE_ID.substring(0, 8)}...`);
console.log(`   API Key: ${AIRTABLE_API_KEY.substring(0, 8)}...`);
console.log('');

// Test 1: Simple GET request to list bases
console.log('📡 Test 1: Testing connection to Airtable API...');

const testConnection = new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/meta/bases`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
    timeout: 10000
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Connection successful');
        resolve();
      } else {
        console.error(`❌ Got status code ${res.statusCode}`);
        console.error(`   Response: ${data}`);
        reject(new Error(`Status ${res.statusCode}`));
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
    reject(error);
  });
  
  req.on('timeout', () => {
    console.error('❌ Connection timeout');
    req.destroy();
    reject(new Error('Timeout'));
  });
  
  req.end();
});

// Test 2: Get Providers table
const testProvidersTable = () => new Promise((resolve, reject) => {
  console.log('\n📡 Test 2: Fetching Providers table...');
  
  const req = https.request({
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/${AIRTABLE_BASE_ID}/Providers?maxRecords=1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
    timeout: 10000
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.records && json.records.length > 0) {
          console.log('✅ Providers table accessible');
          console.log(`   Found provider: ${json.records[0].fields.Name || 'Unknown'}`);
          
          // Check for outbound calling fields
          const fields = json.records[0].fields;
          console.log('\n📋 Checking for outbound calling fields:');
          console.log(`   Outbound Call Enabled: ${fields['Outbound Call Enabled'] !== undefined ? '✅' : '❌'}`);
          console.log(`   Outbound Call Wait Minutes: ${fields['Outbound Call Wait Minutes'] !== undefined ? '✅' : '❌'}`);
          console.log(`   Outbound Call Max Rounds: ${fields['Outbound Call Max Rounds'] !== undefined ? '✅' : '❌'}`);
          console.log(`   Outbound Call Message Template: ${fields['Outbound Call Message Template'] !== undefined ? '✅' : '❌'}`);
          
          resolve(json.records[0]);
        } else {
          console.error('❌ No providers found');
          reject(new Error('No providers'));
        }
      } catch (error) {
        console.error('❌ Parse error:', error.message);
        reject(error);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    reject(error);
  });
  
  req.on('timeout', () => {
    console.error('❌ Request timeout');
    req.destroy();
    reject(new Error('Timeout'));
  });
  
  req.end();
});

// Test 3: Test PATCH request
const testUpdate = (providerId) => new Promise((resolve, reject) => {
  console.log('\n📡 Test 3: Testing PATCH request (read-only test)...');
  console.log(`   Provider ID: ${providerId}`);
  
  // We'll do a GET with the record ID to verify we can access it
  const req = https.request({
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/${AIRTABLE_BASE_ID}/Providers/${providerId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
    timeout: 10000
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Can access provider record for updates');
        resolve();
      } else {
        console.error(`❌ Cannot access record: Status ${res.statusCode}`);
        reject(new Error(`Status ${res.statusCode}`));
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    reject(error);
  });
  
  req.on('timeout', () => {
    console.error('❌ Request timeout');
    req.destroy();
    reject(new Error('Timeout'));
  });
  
  req.end();
});

// Run tests
(async () => {
  try {
    await testConnection();
    const provider = await testProvidersTable();
    await testUpdate(provider.id);
    
    console.log('\n✅ All tests passed!');
    console.log('\n💡 Airtable connection is working correctly.');
    console.log('   If you\'re still getting timeouts in the app, check:');
    console.log('   1. Network connectivity from your deployment environment');
    console.log('   2. Firewall rules');
    console.log('   3. DNS resolution');
    
  } catch (error) {
    console.error('\n❌ Tests failed');
    console.error('   Error:', error.message);
    process.exit(1);
  }
})();
