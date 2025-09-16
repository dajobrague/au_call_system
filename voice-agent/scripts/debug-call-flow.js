#!/usr/bin/env node

/**
 * Debug Call Flow
 * Test the authentication flow with different scenarios
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

async function testCallFlow() {
  try {
    console.log('🧪 Testing Call Flow Scenarios...\n');

    // Import our services after env is loaded
    const { employeeService } = await import('../src/services/airtable/employee-service.js');

    // Test 1: Phone authentication with David Bracho's phone
    console.log('1. Testing phone auth with +522281957913 (David Bracho)...');
    let result = await employeeService.authenticateByPhone('+522281957913');
    console.log(`   Result: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`   Employee: ${result.employee.name} (PIN: ${result.employee.pin})`);
      console.log(`   Provider: ${result.provider?.name || 'N/A'}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    // Test 2: PIN authentication with different PIN
    console.log('\n2. Testing PIN auth with 2007 (David Kim)...');
    result = await employeeService.authenticateByPin(2007);
    console.log(`   Result: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`   Employee: ${result.employee.name} (PIN: ${result.employee.pin})`);
      console.log(`   Provider: ${result.provider?.name || 'N/A'}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    // Test 3: PIN authentication with 2010
    console.log('\n3. Testing PIN auth with 2010 (Maria Lopez)...');
    result = await employeeService.authenticateByPin(2010);
    console.log(`   Result: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`   Employee: ${result.employee.name} (PIN: ${result.employee.pin})`);
      console.log(`   Provider: ${result.provider?.name || 'N/A'}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    // Test 4: Phone auth with unknown number
    console.log('\n4. Testing phone auth with unknown number +1234567890...');
    result = await employeeService.authenticateByPhone('+1234567890');
    console.log(`   Result: ${result.success ? '✅' : '❌'}`);
    if (result.success) {
      console.log(`   Employee: ${result.employee.name} (PIN: ${result.employee.pin})`);
    } else {
      console.log(`   Error: ${result.error} (This should fail and trigger PIN auth)`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCallFlow();
