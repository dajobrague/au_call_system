#!/usr/bin/env node

/**
 * Check Multi-Provider Employees
 * Analyze which employees work for multiple providers
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

console.log('🔍 Analyzing Multi-Provider Employees...\n');

function makeAirtableRequest(tableName, filterFormula) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    
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

async function analyzeMultiProviderEmployees() {
  try {
    // Get all employees
    console.log('1. Getting all employees...');
    const employeesResult = await makeAirtableRequest('Employees');
    
    if (!employeesResult.success || !employeesResult.data.records) {
      console.log('❌ Failed to get employees');
      return;
    }
    
    const employees = employeesResult.data.records;
    console.log(`   ✅ Found ${employees.length} employees\n`);

    // Analyze provider relationships
    console.log('2. Analyzing provider relationships:');
    const multiProviderEmployees = [];
    const singleProviderEmployees = [];
    
    for (const employee of employees) {
      const name = employee.fields['Display Name'];
      const pin = employee.fields['Employee PIN'];
      const providers = employee.fields['Provider'] || [];
      
      console.log(`   👤 ${name} (PIN: ${pin})`);
      console.log(`      Providers: ${providers.length} - ${JSON.stringify(providers)}`);
      
      if (providers.length > 1) {
        multiProviderEmployees.push({
          name,
          pin,
          id: employee.id,
          providers
        });
        console.log(`      🎯 MULTI-PROVIDER EMPLOYEE!`);
      } else {
        singleProviderEmployees.push({
          name,
          pin,
          id: employee.id,
          providers
        });
        console.log(`      ✅ Single provider`);
      }
      console.log('');
    }

    // Get provider names for multi-provider employees
    console.log('3. Multi-Provider Employee Details:');
    if (multiProviderEmployees.length === 0) {
      console.log('   ℹ️  No multi-provider employees found in current data');
      console.log('   📝 We\'ll implement the feature anyway for future use');
    } else {
      for (const employee of multiProviderEmployees) {
        console.log(`\n   🎯 ${employee.name} (PIN: ${employee.pin})`);
        console.log(`      Provider IDs: ${JSON.stringify(employee.providers)}`);
        
        // Get provider names
        for (let i = 0; i < employee.providers.length; i++) {
          const providerId = employee.providers[i];
          try {
            const providerResult = await getRecord('Providers', providerId);
            if (providerResult.success && providerResult.data.fields) {
              const providerName = providerResult.data.fields['Name'];
              console.log(`      ${i + 1}. ${providerName} (${providerId})`);
            }
          } catch (error) {
            console.log(`      ${i + 1}. Provider ${providerId} (couldn't fetch name)`);
          }
        }
      }
    }

    // Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   👥 Total Employees: ${employees.length}`);
    console.log(`   🏥 Single Provider: ${singleProviderEmployees.length}`);
    console.log(`   🏥🏥 Multi-Provider: ${multiProviderEmployees.length}`);
    
    if (multiProviderEmployees.length > 0) {
      console.log(`\n🎯 IMPLEMENTATION NEEDED:`);
      console.log(`   - Provider selection menu for ${multiProviderEmployees.length} employees`);
      console.log(`   - Dynamic provider list generation`);
      console.log(`   - Provider-specific job filtering`);
    } else {
      console.log(`\n📝 IMPLEMENTATION STRATEGY:`);
      console.log(`   - Build multi-provider support for future scalability`);
      console.log(`   - Test with mock multi-provider scenarios`);
      console.log(`   - System will gracefully handle single providers`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeMultiProviderEmployees();
