#!/usr/bin/env node

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

console.log('🔍 Looking up provider recexHQJ13oafJkxZ...\n');

function getProviderById(providerId) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/Providers/${providerId}`;
    
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

async function findProvider() {
  try {
    const result = await getProviderById('recexHQJ13oafJkxZ');
    
    if (result.success && result.data.fields) {
      console.log('✅ Found David Bracho\'s provider:');
      console.log(`   Name: ${result.data.fields['Name']}`);
      console.log(`   Provider ID: ${result.data.fields['Provider ID']}`);
      console.log(`   Greeting: "${result.data.fields['Greeting (IVR)']}"`);
      console.log(`   Timezone: ${result.data.fields['Timezone']}`);
      console.log(`   Active: ${result.data.fields['Active']}`);
    } else {
      console.log('❌ Provider not found or error:', result.data.error?.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findProvider();
