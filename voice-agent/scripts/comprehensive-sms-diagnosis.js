/**
 * Comprehensive SMS Diagnosis
 * Find the actual issue preventing SMS notifications
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

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
  log('COMPREHENSIVE SMS NOTIFICATION DIAGNOSIS', colors.bright + colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);
  
  try {
    // STEP 1: Check the specific job
    log(`STEP 1: Analyzing job ${jobId}`, colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const job = await airtableClient.getJobOccurrenceById(jobId);
    
    if (!job) {
      log('✗ Job not found!', colors.red);
      return;
    }
    
    const providerId = job.fields['Provider']?.[0];
    const jobTemplateId = job.fields['Job Template']?.[0];
    const patientId = job.fields['Patient (Lookup)']?.[0] || job.fields['Patient (Link)']?.[0];
    const status = job.fields['Status'];
    
    log('Job Fields:', colors.blue);
    log(`  Status: ${status || 'MISSING'}`, status === 'Open' ? colors.green : colors.yellow);
    log(`  Provider: ${providerId || 'MISSING'}`, providerId ? colors.green : colors.red);
    log(`  Job Template: ${jobTemplateId || 'MISSING'}`, jobTemplateId ? colors.green : colors.red);
    log(`  Patient (Lookup): ${job.fields['Patient (Lookup)']?.[0] || 'N/A'}`, colors.reset);
    log(`  Patient (Link): ${job.fields['Patient (Link)']?.[0] || 'N/A'}`, colors.reset);
    log(`  Patient (Either): ${patientId || 'MISSING'}`, patientId ? colors.green : colors.red);
    
    const hasAllFields = providerId && jobTemplateId && patientId;
    
    if (!hasAllFields) {
      log('\n✗ ISSUE FOUND: Missing required fields!', colors.red);
      log('\nThis job CANNOT trigger SMS notifications because:', colors.yellow);
      if (!providerId) log('  - Missing Provider field', colors.yellow);
      if (!jobTemplateId) log('  - Missing Job Template field', colors.yellow);
      if (!patientId) log('  - Missing Patient field (neither Lookup nor Link)', colors.yellow);
      log('\nFIX: Ensure jobs are created with all required linked fields', colors.green);
      return;
    }
    
    log('\n✓ Job has all required fields', colors.green);
    
    // STEP 2: Check provider and employees
    log('\n' + '='.repeat(80), colors.cyan);
    log('STEP 2: Checking Provider and Employees', colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const provider = await airtableClient.getProviderById(providerId);
    if (!provider) {
      log('✗ Provider not found!', colors.red);
      return;
    }
    
    log(`Provider: ${provider.fields['Name']}`, colors.green);
    log(`Provider ID: ${providerId}`, colors.reset);
    
    // Find employees
    const employees = await airtableClient.findEmployeesByProvider(providerId);
    log(`\nTotal employees in system: ${employees.length}`, colors.blue);
    
    if (employees.length === 0) {
      log('\n✗ ISSUE FOUND: No employees for this provider!', colors.red);
      log('\nThis provider has NO employees assigned.', colors.yellow);
      log('SMS notifications cannot be sent because there is nobody to notify.', colors.yellow);
      log('\nFIX: Assign employees to this provider in Airtable', colors.green);
      return;
    }
    
    // Check active employees with phones
    const activeWithPhone = employees.filter(emp => 
      emp.fields['Active'] !== false && emp.fields['Phone']
    );
    
    log(`Active employees with phone numbers: ${activeWithPhone.length}`, 
      activeWithPhone.length > 0 ? colors.green : colors.red);
    
    if (activeWithPhone.length === 0) {
      log('\n✗ ISSUE FOUND: No active employees with phone numbers!', colors.red);
      log('\nAll employees are either:', colors.yellow);
      log('  - Marked as inactive, OR', colors.yellow);
      log('  - Missing phone numbers', colors.yellow);
      log('\nFIX: Ensure employees are Active and have valid phone numbers', colors.green);
      return;
    }
    
    // Show employees
    log('\nEmployees who would receive SMS:', colors.green);
    activeWithPhone.forEach((emp, i) => {
      log(`  ${i + 1}. ${emp.fields['Display Name']} - ${emp.fields['Phone']}`, colors.reset);
    });
    
    // STEP 3: Check configuration
    log('\n' + '='.repeat(80), colors.cyan);
    log('STEP 3: Checking System Configuration', colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const hasRedis = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL;
    const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
    const hasMessaging = process.env.TWILIO_MESSAGING_SID;
    
    log(`Redis configured: ${hasRedis ? '✓' : '✗'}`, hasRedis ? colors.green : colors.red);
    log(`Twilio credentials: ${hasTwilio ? '✓' : '✗'}`, hasTwilio ? colors.green : colors.red);
    log(`Twilio Messaging SID: ${hasMessaging ? '✓' : '✗'}`, hasMessaging ? colors.green : colors.red);
    
    // FINAL VERDICT
    log('\n' + '='.repeat(80), colors.cyan);
    log('FINAL DIAGNOSIS', colors.bright + colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const allConfigured = hasRedis && hasTwilio && hasMessaging;
    
    if (allConfigured) {
      log('✓ SMS SYSTEM IS PROPERLY CONFIGURED', colors.green);
      log(`✓ Job has all required fields`, colors.green);
      log(`✓ Provider has ${activeWithPhone.length} employees to notify`, colors.green);
      log('\nIf SMS still not working, check:', colors.blue);
      log('  1. SMS Wave Worker is running (check server logs)', colors.blue);
      log('  2. Job status is "Open" when employee releases it', colors.blue);
      log('  3. Check Railway logs for wave scheduling messages', colors.blue);
    } else {
      log('✗ CONFIGURATION ISSUES FOUND', colors.red);
      if (!hasRedis) log('  - Redis not configured (required for wave queue)', colors.yellow);
      if (!hasTwilio) log('  - Twilio credentials missing', colors.yellow);
      if (!hasMessaging) log('  - Twilio Messaging SID missing', colors.yellow);
    }
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    console.error(error);
  }
}

const jobId = process.argv[2] || 'reclDXqGHA1A9o1Jn';
diagnose(jobId).then(() => process.exit(0));
