/**
 * Diagnose Transfer Flow
 * Tests what actually happens when provider data flows through the system
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

// Mock Redis and test the actual code flow
async function diagnoseTransferFlow() {
  console.log('\n🔍 TRANSFER FLOW DIAGNOSIS');
  console.log('='.repeat(70));
  
  // Step 1: Test Provider Loading from Airtable
  console.log('\n📋 STEP 1: Loading Provider from Airtable');
  console.log('-'.repeat(70));
  
  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
  
  const providerId = 'recexHQJ13oafJkxZ';
  const provider = await base('Providers').find(providerId);
  
  console.log('✅ Raw Provider from Airtable:');
  console.log(`   Name: ${provider.fields['Name']}`);
  console.log(`   Transfer Number: ${provider.fields['Transfer Number']}`);
  console.log('');
  
  // Step 2: Test Employee Service Transformation
  console.log('📋 STEP 2: Testing Employee Service Transform');
  console.log('-'.repeat(70));
  
  try {
    // Load the actual transformation function
    const { default: employeeServiceModule } = await import('../src/services/airtable/employee-service.ts');
    
    // Check if transformProviderRecord exists and what it does
    console.log('✅ Employee service loaded');
    console.log(`   Module keys: ${Object.keys(employeeServiceModule)}`);
  } catch (error) {
    console.log('⚠️  Could not load employee service (expected in Node.js)');
    console.log(`   Error: ${error.message}`);
  }
  
  // Step 3: Simulate what goes into Call State
  console.log('\n📋 STEP 3: Simulating Call State Creation');
  console.log('-'.repeat(70));
  
  const mockProvider = {
    id: provider.id,
    name: provider.fields['Name'],
    greeting: provider.fields['Greeting (IVR)'],
    transferNumber: provider.fields['Transfer Number']
  };
  
  console.log('✅ Provider object that SHOULD go into call state:');
  console.log(JSON.stringify(mockProvider, null, 2));
  console.log('');
  
  // Step 4: Test Transfer Number Resolution (dtmf-router logic)
  console.log('📋 STEP 4: Testing Transfer Number Resolution');
  console.log('-'.repeat(70));
  
  const mockCallState = {
    sid: 'CA_test_123',
    from: '+61400000000',
    phase: 'job_options',
    provider: mockProvider,
    employee: {
      id: 'rec_employee_123',
      name: 'Test Employee',
      phone: '+61400000000'
    }
  };
  
  // Simulate dtmf-router logic
  const transferNumber = mockCallState.provider?.transferNumber 
    || process.env.REPRESENTATIVE_PHONE 
    || '+61490550941';
  
  const transferNumberSource = mockCallState.provider?.transferNumber 
    ? 'provider' 
    : (process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default');
  
  console.log('✅ Transfer number resolution (dtmf-router logic):');
  console.log(`   Provider has transferNumber: ${!!mockCallState.provider?.transferNumber}`);
  console.log(`   Resolved number: ${transferNumber}`);
  console.log(`   Source: ${transferNumberSource}`);
  console.log('');
  
  if (transferNumber !== provider.fields['Transfer Number']) {
    console.log('❌ PROBLEM: Transfer number does NOT match provider!');
    console.log(`   Expected: ${provider.fields['Transfer Number']}`);
    console.log(`   Got: ${transferNumber}`);
  } else {
    console.log('✅ SUCCESS: Transfer number matches provider!');
  }
  
  // Step 5: Test pendingTransfer creation
  console.log('\n📋 STEP 5: Testing pendingTransfer Creation');
  console.log('-'.repeat(70));
  
  const mockPendingTransfer = {
    representativePhone: transferNumber,
    callerPhone: mockCallState.employee?.phone || mockCallState.from || 'Unknown'
  };
  
  console.log('✅ pendingTransfer object that SHOULD be saved:');
  console.log(JSON.stringify(mockPendingTransfer, null, 2));
  console.log('');
  
  // Step 6: Test transfer route logic
  console.log('📋 STEP 6: Testing Transfer Route Logic');
  console.log('-'.repeat(70));
  
  // Simulate what happens when transfer route loads call state
  const loadedCallState = mockCallState; // In real code, this comes from Redis
  
  let routeTransferNumber = process.env.REPRESENTATIVE_PHONE || '+61490550941';
  let routeSource = process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default';
  
  if (loadedCallState?.provider?.transferNumber) {
    routeTransferNumber = loadedCallState.provider.transferNumber;
    routeSource = 'provider';
  }
  
  console.log('✅ Transfer route resolution:');
  console.log(`   Loaded call state has provider: ${!!loadedCallState?.provider}`);
  console.log(`   Provider has transferNumber: ${!!loadedCallState?.provider?.transferNumber}`);
  console.log(`   Resolved number: ${routeTransferNumber}`);
  console.log(`   Source: ${routeSource}`);
  console.log('');
  
  // Final Report
  console.log('\n📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(70));
  
  const checks = [
    {
      name: 'Provider has Transfer Number in Airtable',
      pass: !!provider.fields['Transfer Number'],
      value: provider.fields['Transfer Number']
    },
    {
      name: 'Provider object includes transferNumber',
      pass: !!mockProvider.transferNumber,
      value: mockProvider.transferNumber
    },
    {
      name: 'Call state includes provider with transferNumber',
      pass: !!mockCallState.provider?.transferNumber,
      value: mockCallState.provider?.transferNumber
    },
    {
      name: 'dtmf-router resolves to provider number',
      pass: transferNumber === provider.fields['Transfer Number'],
      value: transferNumber
    },
    {
      name: 'Transfer route resolves to provider number',
      pass: routeTransferNumber === provider.fields['Transfer Number'],
      value: routeTransferNumber
    }
  ];
  
  checks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   Value: ${check.value || 'NOT SET'}`);
  });
  
  const allPass = checks.every(c => c.pass);
  
  console.log('\n' + '='.repeat(70));
  if (allPass) {
    console.log('✅ ALL CHECKS PASSED - Logic should work!');
    console.log('\n⚠️  If it\'s still not working in production, the issue is:');
    console.log('   1. Provider data is not being saved to Redis in call state');
    console.log('   2. OR call state is not being loaded in transfer endpoints');
  } else {
    console.log('❌ SOME CHECKS FAILED - Need to fix the logic!');
  }
  console.log('='.repeat(70));
}

diagnoseTransferFlow().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

