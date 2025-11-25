/**
 * Script to examine Job Occurrences table structure
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

function makeRequest(tableName, maxRecords = 5) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?maxRecords=${maxRecords}`,
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
  console.log('JOB OCCURRENCES TABLE STRUCTURE');
  console.log('========================================\n');

  try {
    // Fetch from Job Occurrences table (tbl0n6Q5dLJArmlEK)
    const response = await makeRequest('Job Occurrences', 3);
    
    if (response.records && response.records.length > 0) {
      console.log(`Found ${response.records.length} sample records\n`);
      
      // Display first record structure
      console.log('FIRST RECORD STRUCTURE:');
      console.log('Record ID:', response.records[0].id);
      console.log('\nFields:');
      console.log(JSON.stringify(response.records[0].fields, null, 2));
      
      // List all unique field names across all records
      const allFields = new Set();
      response.records.forEach(record => {
        Object.keys(record.fields).forEach(field => allFields.add(field));
      });
      
      console.log('\n\nALL UNIQUE FIELDS:');
      Array.from(allFields).sort().forEach(field => {
        console.log(`  - ${field}`);
      });
      
      // Show sample values for key fields
      console.log('\n\nSAMPLE DATA:');
      response.records.forEach((record, idx) => {
        console.log(`\nRecord ${idx + 1}:`);
        console.log(`  Patient (Link): ${record.fields['Patient (Link)'] || 'N/A'}`);
        console.log(`  Patient TXT: ${record.fields['Patient TXT'] || 'N/A'}`);
        console.log(`  Assigned Employee: ${record.fields['Assigned Employee'] || 'N/A'}`);
        console.log(`  Employee TXT: ${record.fields['Employee TXT'] || 'N/A'}`);
        console.log(`  Scheduled At: ${record.fields['Scheduled At'] || 'N/A'}`);
        console.log(`  Time: ${record.fields['Time'] || 'N/A'}`);
        console.log(`  Status: ${record.fields['Status'] || 'N/A'}`);
        console.log(`  Job Template: ${record.fields['Job Template'] || 'N/A'}`);
      });
      
    } else {
      console.log('No records found or empty table');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

