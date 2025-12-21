/**
 * Check employees using correct field name
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function checkEmployees(providerId) {
  console.log(`\nChecking employees for provider: ${providerId}\n`);
  
  try {
    // Query using the correct field name and Active filter
    const filterFormula = `AND(FIND('${providerId}', ARRAYJOIN({recordId (from Provider)})), {Active} = TRUE())`;
    
    console.log('Filter formula:', filterFormula);
    console.log('');
    
    const employees = await airtableClient.findRecords('Employees', filterFormula, { maxRecords: 50 });
    
    console.log(`Found ${employees.length} active employees:\n`);
    
    employees.forEach((emp, i) => {
      console.log(`${i + 1}. ${emp.fields['Display Name']}`);
      console.log(`   Phone: ${emp.fields['Phone']}`);
      console.log(`   PIN: ${emp.fields['Employee PIN']}`);
      console.log(`   Active: ${emp.fields['Active']}`);
      console.log(`   Employee ID: ${emp.id}`);
      console.log('');
    });
    
    if (employees.length > 0) {
      console.log(`✓ Found ${employees.length} employees who would receive SMS notifications`);
    } else {
      console.log('✗ No active employees found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

const providerId = process.argv[2] || 'recexHQJ13oafJkxZ';
checkEmployees(providerId).then(() => process.exit(0));
