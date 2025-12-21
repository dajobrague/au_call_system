/**
 * Check Provider Transfer Number Configuration
 * Checks a specific provider record to see if transfer number is configured
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const Airtable = require('airtable');

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment variables');
  process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

async function checkProviderTransferNumber(providerId) {
  try {
    console.log('\n📋 Checking Provider Transfer Number Configuration');
    console.log('=' .repeat(60));
    console.log(`Provider ID: ${providerId}\n`);

    // Fetch the provider record
    const provider = await base('Providers').find(providerId);

    if (!provider) {
      console.error(`❌ Provider not found: ${providerId}`);
      return;
    }

    console.log('✅ Provider Found:');
    console.log(`   Name: ${provider.fields['Name']}`);
    console.log(`   ID: ${provider.id}`);
    console.log('');

    // Check Transfer Number field
    const transferNumber = provider.fields['Transfer Number'];
    
    if (transferNumber) {
      console.log('✅ Transfer Number Configured:');
      console.log(`   Number: ${transferNumber}`);
      console.log('   Status: CONFIGURED');
    } else {
      console.log('⚠️  Transfer Number:');
      console.log('   Status: NOT CONFIGURED');
      console.log('   This provider does not have a transfer number set!');
      console.log('   The system will fall back to the default: +61490550941');
    }

    console.log('');
    console.log('📝 All Provider Fields:');
    console.log('-'.repeat(60));
    Object.entries(provider.fields).forEach(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      console.log(`   ${key}: ${displayValue}`);
    });

    console.log('');
    console.log('=' .repeat(60));
    
    // Check if this provider has any issues
    console.log('\n🔍 Analysis:');
    if (!transferNumber) {
      console.log('   ❌ ISSUE FOUND: No Transfer Number configured for this provider');
      console.log('   📌 ACTION NEEDED: Configure a transfer number in the Provider Portal');
      console.log('      1. Log into Provider Portal as admin');
      console.log('      2. Go to Admin section');
      console.log('      3. Set Transfer Number field');
      console.log('      4. Save changes');
    } else {
      console.log('   ✅ Provider has a transfer number configured');
      console.log('   ⚠️  Check if the code is actually using this number (see code issues below)');
    }

  } catch (error) {
    console.error('❌ Error checking provider:', error.message);
    if (error.statusCode === 404) {
      console.error('   Provider record not found in Airtable');
    }
  }
}

// Get provider ID from command line argument
const providerId = process.argv[2] || 'recexHQJ13oafJkxZ';

console.log('\n🔍 Provider Transfer Number Diagnostic Tool');
console.log('='.repeat(60));

checkProviderTransferNumber(providerId).then(() => {
  console.log('\n\n📌 KNOWN CODE ISSUES:');
  console.log('='.repeat(60));
  console.log('Even if the transfer number is configured, there are bugs in the code:');
  console.log('');
  console.log('1. /voice-agent/app/api/queue/transfer/route.ts (line 14)');
  console.log('   ❌ Hardcoded: const REPRESENTATIVE_PHONE = \'+61490550941\'');
  console.log('   📝 Should load from call state or provider');
  console.log('');
  console.log('2. /voice-agent/app/api/initiate-transfer/route.ts (line 47)');
  console.log('   ❌ SYNTAX ERROR: let transferNumber =  || \'+61490550941\'');
  console.log('   📝 Missing value before || operator');
  console.log('');
  console.log('These bugs prevent dynamic transfer numbers from working!');
  console.log('='.repeat(60));
  
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

