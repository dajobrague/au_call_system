/**
 * Script to test different filter formulas for Job Occurrences
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Use your provider ID (recRc4Os4WgAnvun3 based on the previous data)
const PROVIDER_ID = 'recRc4Os4WgAnvun3';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

function makeRequest(filterFormula, testName) {
  return new Promise((resolve, reject) => {
    const encodedFormula = encodeURIComponent(filterFormula);
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${AIRTABLE_BASE_ID}/Job%20Occurrences?filterByFormula=${encodedFormula}&maxRecords=10&sort%5B0%5D%5Bfield%5D=Scheduled%20At&sort%5B0%5D%5Bdirection%5D=desc`,
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
          resolve({ testName, data: json });
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
  console.log('TESTING JOB OCCURRENCE FILTERS');
  console.log(`Provider ID: ${PROVIDER_ID}`);
  console.log('========================================\n');

  const filters = [
    {
      name: 'Filter 1: Direct Provider field',
      formula: `FIND('${PROVIDER_ID}', ARRAYJOIN({Provider}))`
    },
    {
      name: 'Filter 2: Provider through Job Template',
      formula: `FIND('${PROVIDER_ID}', ARRAYJOIN({recordId (from Provider) (from Job Template)}))`
    },
    {
      name: 'Filter 3: Provider through Assigned Employee',
      formula: `FIND('${PROVIDER_ID}', ARRAYJOIN({recordId (from Provider) (from Assigned Employee)}))`
    },
    {
      name: 'Filter 4: Provider through Patient Link',
      formula: `FIND('${PROVIDER_ID}', ARRAYJOIN({recordId (from Provider) (from Patient (Link))}))`
    },
    {
      name: 'Filter 5: Combined OR (current)',
      formula: `OR(FIND('${PROVIDER_ID}', ARRAYJOIN({Provider})), FIND('${PROVIDER_ID}', ARRAYJOIN({recordId (from Provider) (from Job Template)})))`
    }
  ];

  for (const filter of filters) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(filter.name);
      console.log(`Formula: ${filter.formula}`);
      console.log('='.repeat(60));
      
      const result = await makeRequest(filter.formula, filter.name);
      
      if (result.data.records && result.data.records.length > 0) {
        console.log(`✓ Found ${result.data.records.length} records\n`);
        
        // Show first record structure
        console.log('First Record:');
        console.log('  ID:', result.data.records[0].id);
        console.log('  Fields:', JSON.stringify(result.data.records[0].fields, null, 4));
        
        // Show list of all records
        console.log('\nAll Records:');
        result.data.records.forEach((record, idx) => {
          console.log(`  ${idx + 1}. ${record.fields['Patient TXT'] || 'N/A'} - ${record.fields['Scheduled At']} ${record.fields['Time']}`);
        });
      } else if (result.data.error) {
        console.log('✗ Error:', result.data.error.message);
      } else {
        console.log('✗ No records found');
      }
      
    } catch (error) {
      console.log('✗ Request failed:', error.message);
    }
  }
  
  console.log('\n\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Compare the results above to determine which filter captures all your occurrences.');
  console.log('The correct filter should show the most recently created occurrence.');
}

main();

