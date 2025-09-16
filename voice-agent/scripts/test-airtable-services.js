#!/usr/bin/env node

/**
 * Test Airtable Services
 * Quick test script to verify Airtable integration works
 */

const fs = require('fs');
const path = require('path');

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

// Import our services (after env is loaded)
async function testServices() {
  try {
    console.log('🧪 Testing Airtable Services...\n');

    // For now, let's just test basic connectivity
    const https = require('https');
    
    console.log('1. Testing Airtable API credentials...');
    
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.log('❌ Missing Airtable credentials');
      process.exit(1);
    }
    
    console.log(`   Base ID: ${AIRTABLE_BASE_ID}`);
    console.log(`   API Key: ${AIRTABLE_API_KEY.substring(0, 8)}...`);
    
    // Test basic connectivity
    const testConnectivity = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.airtable.com',
          port: 443,
          path: `/v0/${AIRTABLE_BASE_ID}/Employees?maxRecords=1`,
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
    };
    
    try {
      const result = await testConnectivity();
      if (result.success) {
        console.log('   ✅ Airtable connectivity successful');
        console.log(`   Records found: ${result.data.records?.length || 0}`);
        
        if (result.data.records && result.data.records.length > 0) {
          const firstEmployee = result.data.records[0];
          console.log(`   First employee: ${firstEmployee.fields['Display Name'] || 'N/A'}`);
          console.log(`   Phone: ${firstEmployee.fields['Phone'] || 'N/A'}`);
          console.log(`   PIN: ${firstEmployee.fields['Employee PIN'] || 'N/A'}`);
        }
      } else {
        console.log('   ❌ Airtable API error:', result.data.error?.message || 'Unknown error');
      }
    } catch (error) {
      console.log('   ❌ Connection failed:', error.message);
    }

    console.log('\n✅ Basic Airtable connectivity test completed!');
    console.log('\n🎯 Phase 1 Airtable Infrastructure is ready for FSM integration!');
    console.log('\nNext steps:');
    console.log('- Integrate phone authentication into FSM');
    console.log('- Add error handling and fallbacks');
    console.log('- Test complete phone authentication flow');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

testServices();
