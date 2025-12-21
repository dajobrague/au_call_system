/**
 * Script to check Provider transfer numbers
 * This will verify that the "Transfer Number (from Provider)" field exists and has data
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
      path: `/v0/${AIRTABLE_BASE_ID}/Providers`,
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
  console.log('PROVIDER TRANSFER NUMBERS CHECK');
  console.log('========================================\n');

  try {
    const response = await makeRequest();
    
    if (response.records && response.records.length > 0) {
      console.log(`Found ${response.records.length} provider records\n`);
      
      // Check each provider for transfer number
      console.log('PROVIDER TRANSFER NUMBERS:');
      console.log('---------------------------\n');
      
      let hasTransferNumber = 0;
      let missingTransferNumber = 0;
      
      response.records.forEach((record, idx) => {
        const providerName = record.fields['Name'] || 'Unknown';
        const providerId = record.fields['Provider ID'] || 'N/A';
        const transferNumber = record.fields['Transfer Number (from Provider)'] || record.fields['Transfer Number'];
        const active = record.fields['Active'];
        
        console.log(`${idx + 1}. ${providerName} (ID: ${providerId})`);
        console.log(`   Record ID: ${record.id}`);
        console.log(`   Active: ${active !== false ? 'Yes' : 'No'}`);
        console.log(`   Transfer Number: ${transferNumber || '❌ NOT SET'}`);
        
        if (transferNumber) {
          hasTransferNumber++;
          console.log(`   ✓ Transfer number configured`);
        } else {
          missingTransferNumber++;
          console.log(`   ⚠ No transfer number configured`);
        }
        console.log('');
      });
      
      console.log('\n========================================');
      console.log('SUMMARY:');
      console.log('========================================');
      console.log(`Total Providers: ${response.records.length}`);
      console.log(`With Transfer Number: ${hasTransferNumber}`);
      console.log(`Missing Transfer Number: ${missingTransferNumber}`);
      
      // Show all fields in first record
      if (response.records.length > 0) {
        console.log('\n========================================');
        console.log('FIRST RECORD ALL FIELDS:');
        console.log('========================================');
        console.log(JSON.stringify(response.records[0].fields, null, 2));
      }
      
    } else {
      console.log('No provider records found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

main();

