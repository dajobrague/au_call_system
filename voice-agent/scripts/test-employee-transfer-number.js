/**
 * Script to test employee authentication and verify transfer number is loaded
 * This simulates what happens when an employee calls in
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

function makeRequest(tableName, filterFormula = '') {
  return new Promise((resolve, reject) => {
    const path = filterFormula 
      ? `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(filterFormula)}`
      : `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
    
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: path,
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

async function getProviderById(providerId) {
  const response = await makeRequest('Providers', `RECORD_ID()='${providerId}'`);
  return response.records && response.records.length > 0 ? response.records[0] : null;
}

async function main() {
  console.log('\n========================================');
  console.log('EMPLOYEE AUTHENTICATION & TRANSFER NUMBER TEST');
  console.log('========================================\n');

  try {
    // Get first employee to test with
    console.log('1. Fetching sample employee...');
    const employeesResponse = await makeRequest('Employees', '{Active}=TRUE()');
    
    if (!employeesResponse.records || employeesResponse.records.length === 0) {
      console.log('No active employees found');
      return;
    }
    
    const employee = employeesResponse.records[0];
    console.log(`\n✓ Found employee: ${employee.fields['Name']}`);
    console.log(`  Employee ID: ${employee.id}`);
    console.log(`  Phone: ${employee.fields['Phone']}`);
    console.log(`  PIN: ${employee.fields['PIN']}`);
    console.log(`  Provider IDs: ${JSON.stringify(employee.fields['Provider'])}`);
    
    // Get the employee's provider(s)
    const providerIds = employee.fields['Provider'] || [];
    
    if (providerIds.length === 0) {
      console.log('\n⚠ Employee has no provider assigned');
      return;
    }
    
    console.log(`\n2. Fetching provider information...`);
    console.log(`   Employee has ${providerIds.length} provider(s)\n`);
    
    for (let i = 0; i < providerIds.length; i++) {
      const providerId = providerIds[i];
      const provider = await getProviderById(providerId);
      
      if (provider) {
        console.log(`   Provider ${i + 1}:`);
        console.log(`   - Name: ${provider.fields['Name']}`);
        console.log(`   - Provider ID: ${provider.fields['Provider ID']}`);
        console.log(`   - Record ID: ${provider.id}`);
        
        // Check all possible field names for transfer number
        const transferNumber = provider.fields['Transfer Number (from Provider)'] 
          || provider.fields['Transfer Number']
          || provider.fields['transfer number']
          || provider.fields['transferNumber'];
        
        if (transferNumber) {
          console.log(`   - Transfer Number: ✓ ${transferNumber}`);
          console.log(`   - Status: CONFIGURED ✓`);
        } else {
          console.log(`   - Transfer Number: ❌ NOT SET`);
          console.log(`   - Status: WILL USE FALLBACK`);
        }
        
        console.log(`   - All Provider Fields:`);
        console.log(`     ${Object.keys(provider.fields).join(', ')}`);
        console.log('');
      }
    }
    
    console.log('\n========================================');
    console.log('AUTHENTICATION FLOW SIMULATION');
    console.log('========================================');
    console.log(`\n📞 When employee "${employee.fields['Name']}" calls in:`);
    console.log(`   1. System authenticates by phone: ${employee.fields['Phone']}`);
    console.log(`   2. Loads provider: ${providerIds[0]}`);
    
    const firstProvider = await getProviderById(providerIds[0]);
    if (firstProvider) {
      const transferNumber = firstProvider.fields['Transfer Number (from Provider)'] 
        || firstProvider.fields['Transfer Number'];
      
      if (transferNumber) {
        console.log(`   3. Transfer number loaded: ${transferNumber}`);
        console.log(`   4. ✓ Calls will transfer to: ${transferNumber}`);
      } else {
        console.log(`   3. ⚠ No transfer number configured for provider`);
        console.log(`   4. Will use fallback: process.env.REPRESENTATIVE_PHONE or +61490550941`);
      }
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

main();

