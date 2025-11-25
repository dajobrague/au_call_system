/**
 * Script to check all recent occurrences (no filter)
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
      path: `/v0/${AIRTABLE_BASE_ID}/Job%20Occurrences?maxRecords=10&sort%5B0%5D%5Bfield%5D=Scheduled%20At&sort%5B0%5D%5Bdirection%5D=desc`,
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
  console.log('ALL RECENT JOB OCCURRENCES (NO FILTER)');
  console.log('========================================\n');

  try {
    const result = await makeRequest();
    
    if (result.records && result.records.length > 0) {
      console.log(`Found ${result.records.length} records\n`);
      
      result.records.forEach((record, idx) => {
        console.log(`\n${'-'.repeat(60)}`);
        console.log(`Record ${idx + 1}: ${record.id}`);
        console.log('-'.repeat(60));
        console.log('Patient:', record.fields['Patient TXT'] || 'N/A');
        console.log('Employee:', record.fields['Employee TXT'] || 'N/A');
        console.log('Date:', record.fields['Scheduled At'] || 'N/A');
        console.log('Time:', record.fields['Time'] || 'N/A');
        console.log('Status:', record.fields['Status'] || 'N/A');
        console.log('Job Template:', record.fields['Job Template'] ? 'YES' : 'NO');
        
        console.log('\nProvider-related fields:');
        console.log('  Provider:', record.fields['Provider'] || 'N/A');
        console.log('  recordId (from Provider) (from Job Template):', record.fields['recordId (from Provider) (from Job Template)'] || 'N/A');
        console.log('  recordId (from Provider) (from Assigned Employee):', record.fields['recordId (from Provider) (from Assigned Employee)'] || 'N/A');
        
        console.log('\nPatient/Employee links:');
        console.log('  Patient (Link):', record.fields['Patient (Link)'] || 'N/A');
        console.log('  Patient (Lookup):', record.fields['Patient (Lookup)'] || 'N/A');
        console.log('  Assigned Employee:', record.fields['Assigned Employee'] || 'N/A');
        
        console.log('\nAll Fields:');
        console.log(JSON.stringify(record.fields, null, 2));
      });
    } else {
      console.log('No records found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

