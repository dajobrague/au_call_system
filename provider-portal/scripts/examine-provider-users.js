/**
 * Script to examine Provider Users table structure
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

function makeRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${AIRTABLE_BASE_ID}/Provider%20Users?maxRecords=5`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function main() {
  console.log('\n========================================');
  console.log('PROVIDER USERS TABLE STRUCTURE');
  console.log('========================================\n');

  try {
    const response = await makeRequest();
    
    if (response.records && response.records.length > 0) {
      console.log(`Found ${response.records.length} sample records\n`);
      
      // Display first record structure
      console.log('FIRST RECORD STRUCTURE:');
      console.log('Record ID:', response.records[0].id);
      console.log('\nFields:');
      console.log(JSON.stringify(response.records[0].fields, null, 2));
      
      // List all unique field names
      const allFields = new Set();
      response.records.forEach(record => {
        Object.keys(record.fields).forEach(field => allFields.add(field));
      });
      
      console.log('\n\nALL UNIQUE FIELDS:');
      Array.from(allFields).sort().forEach(field => {
        console.log(`  - ${field}`);
      });
      
      // Show sample data
      console.log('\n\nSAMPLE DATA:');
      response.records.forEach((record, idx) => {
        console.log(`\nUser ${idx + 1}:`);
        console.log(`  Name: ${record.fields['Name'] || 'N/A'}`);
        console.log(`  Email: ${record.fields['Email'] || 'N/A'}`);
        console.log(`  Provider: ${record.fields['Provider'] || 'N/A'}`);
        console.log(`  Role: ${record.fields['Role'] || 'N/A'}`);
        console.log(`  Active: ${record.fields['Active']}`);
      });
      
    } else {
      console.log('No records found or empty table');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

