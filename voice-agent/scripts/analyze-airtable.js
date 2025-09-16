#!/usr/bin/env node

/**
 * Airtable Base Analysis Script
 * Reads the complete structure of the Airtable base to understand data schema
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load .env.local file
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

// Read environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Job Occurrences';

console.log('🔍 Airtable Base Analysis Starting...\n');

// Validate credentials
if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID environment variable is required');
  process.exit(1);
}

console.log(`📊 Base ID: ${AIRTABLE_BASE_ID}`);
console.log(`📋 Table: ${AIRTABLE_TABLE_NAME}`);
console.log(`🔑 API Key: ${AIRTABLE_API_KEY.substring(0, 8)}...`);
console.log('');

/**
 * Make Airtable API request
 */
function makeAirtableRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Analyze field structure
 */
function analyzeFields(records) {
  const fieldAnalysis = {};
  const sampleValues = {};
  
  records.forEach(record => {
    Object.keys(record.fields).forEach(fieldName => {
      const value = record.fields[fieldName];
      
      if (!fieldAnalysis[fieldName]) {
        fieldAnalysis[fieldName] = {
          type: typeof value,
          hasValues: 0,
          nullValues: 0,
          uniqueValues: new Set()
        };
        sampleValues[fieldName] = [];
      }
      
      if (value !== null && value !== undefined && value !== '') {
        fieldAnalysis[fieldName].hasValues++;
        fieldAnalysis[fieldName].uniqueValues.add(String(value));
        
        // Store sample values (max 3)
        if (sampleValues[fieldName].length < 3) {
          sampleValues[fieldName].push(value);
        }
      } else {
        fieldAnalysis[fieldName].nullValues++;
      }
    });
  });
  
  return { fieldAnalysis, sampleValues };
}

/**
 * Main analysis function
 */
async function analyzeBase() {
  try {
    console.log('📡 Fetching records from Airtable...\n');
    
    // Fetch first batch of records
    const response = await makeAirtableRequest('?maxRecords=100');
    
    if (response.error) {
      console.error('❌ Airtable API Error:', response.error);
      process.exit(1);
    }
    
    const records = response.records || [];
    console.log(`✅ Retrieved ${records.length} records\n`);
    
    if (records.length === 0) {
      console.log('⚠️  No records found in the table');
      return;
    }
    
    // Analyze field structure
    const { fieldAnalysis, sampleValues } = analyzeFields(records);
    
    console.log('📋 FIELD ANALYSIS');
    console.log('='.repeat(50));
    
    Object.keys(fieldAnalysis).forEach(fieldName => {
      const analysis = fieldAnalysis[fieldName];
      const samples = sampleValues[fieldName];
      
      console.log(`\n🔸 ${fieldName}`);
      console.log(`   Type: ${analysis.type}`);
      console.log(`   Has Values: ${analysis.hasValues}/${records.length} records`);
      console.log(`   Unique Values: ${analysis.uniqueValues.size}`);
      
      if (samples.length > 0) {
        console.log(`   Sample Values: ${samples.map(v => JSON.stringify(v)).join(', ')}`);
      }
    });
    
    console.log('\n📊 RECORD SAMPLES');
    console.log('='.repeat(50));
    
    // Show first 3 complete records
    records.slice(0, 3).forEach((record, index) => {
      console.log(`\n📄 Record ${index + 1} (ID: ${record.id})`);
      Object.keys(record.fields).forEach(fieldName => {
        const value = record.fields[fieldName];
        console.log(`   ${fieldName}: ${JSON.stringify(value)}`);
      });
    });
    
    console.log('\n🎯 INTEGRATION PLANNING INSIGHTS');
    console.log('='.repeat(50));
    
    // Look for potential client ID fields
    const potentialClientFields = Object.keys(fieldAnalysis).filter(field => 
      field.toLowerCase().includes('client') || 
      field.toLowerCase().includes('customer') ||
      field.toLowerCase().includes('id')
    );
    
    if (potentialClientFields.length > 0) {
      console.log(`\n🔍 Potential Client ID Fields: ${potentialClientFields.join(', ')}`);
    }
    
    // Look for potential job number fields
    const potentialJobFields = Object.keys(fieldAnalysis).filter(field => 
      field.toLowerCase().includes('job') || 
      field.toLowerCase().includes('number') ||
      field.toLowerCase().includes('ref')
    );
    
    if (potentialJobFields.length > 0) {
      console.log(`🔍 Potential Job Number Fields: ${potentialJobFields.join(', ')}`);
    }
    
    // Look for name fields
    const potentialNameFields = Object.keys(fieldAnalysis).filter(field => 
      field.toLowerCase().includes('name') || 
      field.toLowerCase().includes('assignee') ||
      field.toLowerCase().includes('worker')
    );
    
    if (potentialNameFields.length > 0) {
      console.log(`🔍 Potential Name Fields: ${potentialNameFields.join(', ')}`);
    }
    
    // Look for date fields
    const potentialDateFields = Object.keys(fieldAnalysis).filter(field => 
      field.toLowerCase().includes('date') || 
      field.toLowerCase().includes('time') ||
      field.toLowerCase().includes('schedule')
    );
    
    if (potentialDateFields.length > 0) {
      console.log(`🔍 Potential Date/Time Fields: ${potentialDateFields.join(', ')}`);
    }
    
    console.log('\n✅ Analysis Complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing Airtable base:', error.message);
    process.exit(1);
  }
}

// Run the analysis
analyzeBase();
