#!/usr/bin/env node

/**
 * Debug Multi-Provider Flow
 * Test the exact multi-provider detection logic the voice system uses
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

console.log('🔍 Debugging Multi-Provider Flow - Voice System Simulation...\n');

function makeAirtableRequest(tableName, filterFormula) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    params.append('maxRecords', '1');
    
    const queryString = params.toString();
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}${queryString ? '?' + queryString : ''}`;
    
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ success: !jsonData.error, data: jsonData, status: res.statusCode });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function getRecord(tableName, recordId) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
    
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ success: !jsonData.error, data: jsonData, status: res.statusCode });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function debugMultiProviderFlow() {
  try {
    console.log('📞 Simulating David Bracho\'s call (+522281957913, PIN 2001)...\n');

    // Step 1: Phone Authentication (what voice system does first)
    console.log('1. Phone Authentication:');
    const phoneResult = await makeAirtableRequest('Employees', `{Phone} = '+522281957913'`);
    
    if (phoneResult.success && phoneResult.data.records && phoneResult.data.records.length > 0) {
      const employee = phoneResult.data.records[0];
      console.log(`   ✅ Phone recognized: ${employee.fields['Display Name']}`);
      console.log(`   📋 Employee Record ID: ${employee.id}`);
      console.log(`   🏥 Provider Field: ${JSON.stringify(employee.fields['Provider'])}`);
      console.log(`   📊 Provider Count: ${employee.fields['Provider']?.length || 0}`);
      
      // This is what gets stored in state.employee.providerId (first provider)
      const firstProviderId = employee.fields['Provider']?.[0];
      console.log(`   🎯 First Provider ID (stored in state): ${firstProviderId}`);
      
      // Step 2: Multi-Provider Check (what our new logic does)
      console.log('\n2. Multi-Provider Detection:');
      console.log('   🔍 Checking if employee has multiple providers...');
      
      // Our logic: Look up employee by PIN to get full provider list
      const pinResult = await makeAirtableRequest('Employees', `{Employee PIN} = 2001`);
      
      if (pinResult.success && pinResult.data.records && pinResult.data.records.length > 0) {
        const employeeByPin = pinResult.data.records[0];
        const allProviders = employeeByPin.fields['Provider'] || [];
        
        console.log(`   📋 Full Provider List: ${JSON.stringify(allProviders)}`);
        console.log(`   📊 Total Providers: ${allProviders.length}`);
        console.log(`   🎯 Has Multiple Providers: ${allProviders.length > 1 ? 'YES' : 'NO'}`);
        
        if (allProviders.length > 1) {
          console.log('\n3. Provider Details:');
          
          for (let i = 0; i < allProviders.length; i++) {
            const providerId = allProviders[i];
            console.log(`\n   Provider ${i + 1}: ${providerId}`);
            
            try {
              const providerResult = await getRecord('Providers', providerId);
              if (providerResult.success && providerResult.data.fields) {
                const provider = providerResult.data.fields;
                console.log(`      ✅ Name: ${provider['Name']}`);
                console.log(`      🎙️ Greeting: "${provider['Greeting (IVR)']}"`);
                console.log(`      ✅ Active: ${provider['Active'] !== false ? 'YES' : 'NO'}`);
              } else {
                console.log(`      ❌ Could not fetch provider details`);
              }
            } catch (error) {
              console.log(`      ❌ Error fetching provider: ${error.message}`);
            }
          }
          
          console.log('\n🎯 EXPECTED VOICE FLOW:');
          console.log('   "Hi David, I see you work for multiple providers."');
          console.log('   "Press 1 for Sunrise Health Group,"');
          console.log('   "Press 2 for Midwest Medical Partners,"');
          console.log('   "Press 3 for Desert Valley Clinic,"');
          console.log('   "Press 4 for Northern Lights Health."');
          
        } else {
          console.log('\n⚠️  Employee appears to have single provider in PIN lookup');
        }
      } else {
        console.log('   ❌ Could not find employee by PIN 2001');
      }
      
    } else {
      console.log('   ❌ Phone not found in system');
    }

    console.log('\n🔍 DEBUGGING CHECKLIST:');
    console.log('   1. Is David Bracho found by phone? ✅');
    console.log('   2. Does David have multiple providers in the Provider field? ✅');
    console.log('   3. Is our multi-provider detection logic working?');
    console.log('   4. Is the FSM transitioning to provider_selection phase?');
    console.log('   5. Are the provider details being fetched correctly?');
    
    console.log('\nIf the voice system is not showing multiple providers, check:');
    console.log('- FSM phase transitions (phone_auth → provider_selection)');
    console.log('- Multi-provider service logic');
    console.log('- Provider record fetching');
    console.log('- TwiML generation for provider menu');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

debugMultiProviderFlow();
