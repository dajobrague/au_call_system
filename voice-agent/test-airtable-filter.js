/**
 * Test Airtable Filter for Call Logs
 * Direct test to verify the date format and filter work correctly
 */

// Import the airtable client
const { airtableClient } = require('./dist/services/airtable/client.js');

async function testAirtableFilter() {
  console.log('==========================================');
  console.log('   AIRTABLE FILTER TEST');
  console.log('==========================================\n');

  const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';

  try {
    console.log('Test 1: Get all call logs (no filter)');
    console.log('--------------------------------------');
    const allRecords = await airtableClient.findRecords(CALL_LOGS_TABLE_ID, '', { maxRecords: 10 });
    console.log(`Found ${allRecords.length} total records\n`);
    
    if (allRecords.length > 0) {
      console.log('Sample records:');
      allRecords.forEach((record, index) => {
        const startedAt = record.fields['Started At'];
        const provider = record.fields['Provider (from Provider)'];
        console.log(`  ${index + 1}. Started At: "${startedAt}" | Provider: ${provider}`);
      });
      console.log('');
    }

    // Test different date formats
    const testDates = [
      '10/1/2025',
      '10/2/2025',
      '10/3/2025',
      '1/10/2025',
      '2/10/2025',
      '3/10/2025'
    ];

    for (const testDate of testDates) {
      console.log(`\nTest: Searching for "{Started At} = '${testDate}'"`);
      console.log('--------------------------------------');
      
      const formula = `{Started At} = "${testDate}"`;
      const records = await airtableClient.findRecords(CALL_LOGS_TABLE_ID, formula, { maxRecords: 100 });
      
      console.log(`Found ${records.length} records for ${testDate}`);
      
      if (records.length > 0) {
        records.forEach((record, index) => {
          const callSid = record.fields['CallSid'];
          const provider = record.fields['Provider (from Provider)'];
          const direction = record.fields['Direction'];
          const seconds = record.fields['Seconds'];
          console.log(`  ${index + 1}. CallSid: ${callSid} | Provider: ${provider} | Direction: ${direction} | Duration: ${seconds}s`);
        });
      }
    }

    console.log('\n==========================================');
    console.log('TEST COMPLETE');
    console.log('==========================================\n');
    console.log('Next steps:');
    console.log('1. Identify which date format returned results');
    console.log('2. Update the report service to use that format');
    console.log('3. Re-run the PDF generation test');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('Starting Airtable filter test...\n');
testAirtableFilter();

