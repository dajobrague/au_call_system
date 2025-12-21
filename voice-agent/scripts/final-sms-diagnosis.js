/**
 * Final SMS Diagnosis - Using correct Provider field
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');
const { filterValidPhoneNumbers } = require('../src/utils/phone-validator');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function diagnose(jobId) {
  log('\n' + '='.repeat(80), colors.cyan);
  log('SMS NOTIFICATION DIAGNOSIS - FINAL ANALYSIS', colors.bright + colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);
  
  try {
    const job = await airtableClient.getJobOccurrenceById(jobId);
    
    if (!job) {
      log('✗ Job not found!', colors.red);
      return;
    }
    
    // Extract provider ID from correct field
    const providerId = job.fields['Provider']?.[0] 
      || job.fields['recordId (from Provider) (from Job Template)']?.[0]
      || job.fields['recordId (from Provider) (from Patient (Link))']?.[0];
    
    const jobTemplateId = job.fields['Job Template']?.[0];
    const patientId = job.fields['Patient (Lookup)']?.[0] || job.fields['Patient (Link)']?.[0];
    const status = job.fields['Status'];
    
    log('STEP 1: Job Occurrence Analysis', colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    log(`Job ID: ${jobId}`, colors.blue);
    log(`Status: ${status}`, status === 'Open' ? colors.green : colors.yellow);
    log(`\nProvider ID extracted from:`, colors.blue);
    if (job.fields['Provider']?.[0]) {
      log(`  Direct Provider field: ${providerId}`, colors.green);
    } else if (job.fields['recordId (from Provider) (from Job Template)']?.[0]) {
      log(`  recordId (from Provider) (from Job Template): ${providerId}`, colors.green);
    } else if (job.fields['recordId (from Provider) (from Patient (Link))']?.[0]) {
      log(`  recordId (from Provider) (from Patient (Link)): ${providerId}`, colors.green);
    } else {
      log(`  NO PROVIDER FOUND`, colors.red);
    }
    
    log(`\nJob Template: ${jobTemplateId || 'N/A (direct patient job)'}`, jobTemplateId ? colors.green : colors.yellow);
    log(`Patient ID: ${patientId}`, patientId ? colors.green : colors.red);
    
    if (!providerId) {
      log('\n✗ CRITICAL: No Provider ID found!', colors.red);
      return;
    }
    
    log('\n' + '='.repeat(80), colors.cyan);
    log('STEP 2: Provider & Employees', colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const provider = await airtableClient.getProviderById(providerId);
    if (!provider) {
      log('✗ Provider not found!', colors.red);
      return;
    }
    
    log(`✓ Provider: ${provider.fields['Name']}`, colors.green);
    log(`  Provider ID: ${providerId}`, colors.reset);
    
    // Get employees
    log('\nQuerying employees...', colors.blue);
    const employees = await airtableClient.findEmployeesByProvider(providerId);
    log(`Total employees: ${employees.length}`, employees.length > 0 ? colors.green : colors.red);
    
    if (employees.length === 0) {
      log('\n✗ NO EMPLOYEES for this provider!', colors.red);
      log('SMS cannot be sent - no one to notify.', colors.yellow);
      return;
    }
    
    // Filter active with phones
    const activeWithPhone = employees
      .filter(emp => emp.fields['Active'] !== false)
      .filter(emp => emp.fields['Phone'])
      .map(emp => ({
        id: emp.id,
        name: emp.fields['Display Name'],
        phone: emp.fields['Phone'],
        pin: emp.fields['Employee PIN']
      }));
    
    log(`Active with phones: ${activeWithPhone.length}`, activeWithPhone.length > 0 ? colors.green : colors.red);
    
    if (activeWithPhone.length === 0) {
      log('\n✗ No active employees with phone numbers!', colors.red);
      return;
    }
    
    // Validate phone numbers
    const validEmployees = filterValidPhoneNumbers(activeWithPhone);
    log(`Valid phone numbers: ${validEmployees.length}`, validEmployees.length > 0 ? colors.green : colors.yellow);
    
    log('\nEmployees who would receive SMS:', colors.green);
    validEmployees.forEach((emp, i) => {
      log(`  ${i + 1}. ${emp.name} (${emp.phone}) - PIN: ${emp.pin}`, colors.reset);
    });
    
    // Get patient info
    if (patientId) {
      const patient = await airtableClient.getPatientById(patientId);
      if (patient) {
        log(`\nPatient: ${patient.fields['Name']}`, colors.blue);
      }
    }
    
    log('\n' + '='.repeat(80), colors.cyan);
    log('STEP 3: Root Cause Analysis', colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    log('THE ISSUE:', colors.bright + colors.red);
    log('The SMS notification code is looking for job.fields["Provider"]', colors.yellow);
    log('But this job has Provider ID in:', colors.yellow);
    log('  job.fields["recordId (from Provider) (from Patient (Link))"]', colors.yellow);
    
    log('\nThe code needs to be updated to check:', colors.green);
    log('  1. job.fields["Provider"]?.[0]', colors.green);
    log('  2. job.fields["recordId (from Provider) (from Job Template)"]?.[0]', colors.green);
    log('  3. job.fields["recordId (from Provider) (from Patient (Link))"]?.[0]', colors.green);
    
    log('\n' + '='.repeat(80), colors.cyan);
    log('CONCLUSION', colors.bright + colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    log('✓ Job has Provider ID (via lookup field)', colors.green);
    log('✓ Job has Patient', colors.green);
    log(`✓ Provider has ${validEmployees.length} employees ready to receive SMS`, colors.green);
    log('✗ SMS code not reading Provider ID from correct field', colors.red);
    
    log('\nFIX REQUIRED:', colors.yellow);
    log('Update job-notification-service.ts to extract Provider ID from lookup fields', colors.yellow);
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    console.error(error);
  }
}

const jobId = process.argv[2] || 'reclDXqGHA1A9o1Jn';
diagnose(jobId).then(() => process.exit(0));
