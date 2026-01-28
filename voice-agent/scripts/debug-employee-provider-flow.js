/**
 * Debug Employee Provider Flow
 * Check what's actually in the employee and provider records
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const Airtable = require('airtable');

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

async function debugEmployeeProviderFlow(employeeId) {
  console.log('\n🔍 DEBUGGING EMPLOYEE PROVIDER FLOW');
  console.log('='.repeat(80));
  console.log(`Employee ID: ${employeeId}\n`);

  try {
    // Step 1: Get Employee
    console.log('📋 STEP 1: Fetching Employee Record');
    console.log('-'.repeat(80));
    const employee = await base('Employees').find(employeeId);
    
    console.log(`✅ Employee: ${employee.fields['Display Name']}`);
    console.log(`   Phone: ${employee.fields['Phone']}`);
    console.log(`   Active: ${employee.fields['Active']}`);
    console.log(`   Provider IDs: ${JSON.stringify(employee.fields['Provider'])}`);
    console.log('');

    // Step 2: Get Provider(s)
    const providerIds = employee.fields['Provider'] || [];
    
    if (providerIds.length === 0) {
      console.log('❌ No providers linked to this employee!');
      return;
    }

    console.log('📋 STEP 2: Fetching Provider Records');
    console.log('-'.repeat(80));
    
    for (const providerId of providerIds) {
      const provider = await base('Providers').find(providerId);
      
      console.log(`\n✅ Provider: ${provider.fields['Name']}`);
      console.log(`   ID: ${provider.id}`);
      console.log(`   Transfer Number: ${provider.fields['Transfer Number'] || 'NOT SET'}`);
      console.log(`   Greeting: ${provider.fields['Greeting (IVR)']?.substring(0, 60)}...`);
      console.log(`   Active: ${provider.fields['Active']}`);
      console.log('');

      // Step 3: Simulate transformation
      console.log('📋 STEP 3: Simulating transformProviderRecord');
      console.log('-'.repeat(80));
      
      const transformedProvider = {
        id: provider.id,
        name: provider.fields['Name'],
        providerId: provider.fields['Provider ID'],
        greeting: provider.fields['Greeting (IVR)'],
        timezone: provider.fields['Timezone'],
        transferNumber: provider.fields['Transfer Number'], // Line 51 in employee-service.ts
        active: provider.fields['Active'] !== false
      };

      console.log('Transformed provider:');
      console.log(JSON.stringify(transformedProvider, null, 2));
      console.log('');

      if (!transformedProvider.transferNumber) {
        console.log('❌ WARNING: transformedProvider.transferNumber is NOT SET!');
      } else {
        console.log(`✅ transferNumber present: ${transformedProvider.transferNumber}`);
      }
      console.log('');
    }

    // Step 4: Check what multiProviderService would return
    console.log('📋 STEP 4: Checking Multi-Provider Service Response');
    console.log('-'.repeat(80));
    
    console.log('This is what getEmployeeProviders() would return:');
    console.log(`   hasMultipleProviders: ${providerIds.length > 1}`);
    console.log(`   Number of providers: ${providerIds.length}`);
    console.log('');

    // Step 5: Check what goes into call state
    console.log('📋 STEP 5: What Should Go Into Call State');
    console.log('-'.repeat(80));

    const firstProvider = await base('Providers').find(providerIds[0]);
    
    if (providerIds.length === 1) {
      console.log('Single provider scenario (provider-phase.ts line 40-46):');
      const callStateProvider = {
        id: firstProvider.id,
        name: firstProvider.fields['Name'],
        greeting: firstProvider.fields['Greeting (IVR)'],
        transferNumber: firstProvider.fields['Transfer Number'], // SHOULD BE HERE
      };
      console.log(JSON.stringify(callStateProvider, null, 2));
      
      if (!callStateProvider.transferNumber) {
        console.log('\n❌ ISSUE: transferNumber is missing from call state!');
        console.log('   This provider does not have Transfer Number field set in Airtable.');
      } else {
        console.log(`\n✅ transferNumber would be in call state: ${callStateProvider.transferNumber}`);
      }
    } else {
      console.log('Multi-provider scenario (provider-phase.ts line 64-69):');
      const availableProviders = [];
      let index = 1;
      for (const providerId of providerIds) {
        const provider = await base('Providers').find(providerId);
        availableProviders.push({
          id: provider.id,
          name: provider.fields['Name'],
          greeting: provider.fields['Greeting (IVR)'],
          transferNumber: provider.fields['Transfer Number'], // SHOULD BE HERE
          selectionNumber: index++
        });
      }
      console.log(JSON.stringify(availableProviders, null, 2));
      
      const withoutTransferNumber = availableProviders.filter(p => !p.transferNumber);
      if (withoutTransferNumber.length > 0) {
        console.log(`\n❌ ISSUE: ${withoutTransferNumber.length} provider(s) missing transferNumber!`);
        withoutTransferNumber.forEach(p => {
          console.log(`   - ${p.name} (${p.id})`);
        });
      } else {
        console.log('\n✅ All providers have transferNumber in availableProviders array');
      }
    }

    // Step 6: Check the actual phase scenario
    console.log('\n📋 STEP 6: Checking Phase Scenario');
    console.log('-'.repeat(80));
    console.log('From error log: phase="no_occurrences_found"');
    console.log('This is a special case - let me check if provider is set differently here...');
    console.log('');

    // Final Report
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    
    const firstProviderRecord = await base('Providers').find(providerIds[0]);
    const hasTransferNumber = !!firstProviderRecord.fields['Transfer Number'];
    
    if (!hasTransferNumber) {
      console.log('❌ ROOT CAUSE FOUND:');
      console.log(`   Provider "${firstProviderRecord.fields['Name']}" does NOT have Transfer Number set in Airtable`);
      console.log('');
      console.log('ACTION NEEDED:');
      console.log('   1. Go to Provider Portal');
      console.log('   2. Login as admin');
      console.log('   3. Navigate to Admin section');
      console.log(`   4. Set Transfer Number for provider: ${firstProviderRecord.fields['Name']}`);
      console.log('   5. Save changes');
    } else {
      console.log('✅ Provider HAS Transfer Number in Airtable:');
      console.log(`   ${firstProviderRecord.fields['Transfer Number']}`);
      console.log('');
      console.log('⚠️  If the error still happens, it means:');
      console.log('   1. Provider is loaded but transferNumber is not included in call state');
      console.log('   2. OR there\'s a different code path for "no_occurrences_found" phase');
      console.log('   3. Let me check the no_occurrences_found handler...');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.statusCode === 404) {
      console.error('   Record not found in Airtable');
    }
  }
}

const employeeId = process.argv[2] || 'recKICNXdnWxk43i8';

debugEmployeeProviderFlow(employeeId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

