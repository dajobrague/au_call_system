/**
 * Diagnose SMS Issue - Check why SMS notifications aren't working
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
  log('SMS NOTIFICATION ISSUE DIAGNOSIS', colors.bright + colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);
  
  log(`Analyzing job occurrence: ${jobId}\n`, colors.blue);
  
  try {
    // Get the job occurrence
    const job = await airtableClient.getJobOccurrenceById(jobId);
    
    if (!job) {
      log('✗ Job occurrence not found!', colors.red);
      return;
    }
    
    log('✓ Job occurrence found', colors.green);
    log('\nJob Occurrence Data:', colors.cyan);
    console.log(JSON.stringify(job.fields, null, 2));
    
    // Check required fields for SMS notifications
    log('\n' + '='.repeat(80), colors.cyan);
    log('REQUIRED FIELDS CHECK', colors.bright + colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    const checks = [
      { name: 'Status', field: 'Status', expected: 'Open', value: job.fields['Status'] },
      { name: 'Provider', field: 'Provider', expected: 'Array with provider ID', value: job.fields['Provider'] },
      { name: 'Job Template', field: 'Job Template', expected: 'Array with template ID', value: job.fields['Job Template'] },
      { name: 'Patient', field: 'Patient (Link)', expected: 'Array with patient ID', value: job.fields['Patient (Link)'] },
      { name: 'Scheduled At', field: 'Scheduled At', expected: 'Date string', value: job.fields['Scheduled At'] },
    ];
    
    let allPassed = true;
    
    checks.forEach(check => {
      const hasValue = check.value !== undefined && check.value !== null;
      const isArray = Array.isArray(check.value);
      const hasArrayValue = isArray && check.value.length > 0;
      
      let status = '✗';
      let color = colors.red;
      let message = '';
      
      if (check.field === 'Status') {
        if (check.value === 'Open') {
          status = '✓';
          color = colors.green;
          message = `${check.value}`;
        } else {
          message = `${check.value || 'MISSING'} (should be "Open")`;
          allPassed = false;
        }
      } else if (check.field === 'Scheduled At') {
        if (hasValue) {
          status = '✓';
          color = colors.green;
          message = `${check.value}`;
        } else {
          message = 'MISSING';
          allPassed = false;
        }
      } else {
        // Array fields
        if (hasArrayValue) {
          status = '✓';
          color = colors.green;
          message = `${check.value[0]}`;
        } else {
          message = 'MISSING';
          allPassed = false;
        }
      }
      
      log(`${status} ${check.name}: ${message}`, color);
    });
    
    // Diagnosis
    log('\n' + '='.repeat(80), colors.cyan);
    log('DIAGNOSIS', colors.bright + colors.cyan);
    log('='.repeat(80) + '\n', colors.cyan);
    
    if (!allPassed) {
      log('✗ SMS NOTIFICATIONS CANNOT WORK', colors.red);
      log('\nREASON:', colors.yellow);
      log('This job occurrence is missing required fields for SMS notifications.', colors.yellow);
      log('\nThe SMS wave system requires:', colors.blue);
      log('  1. Provider field - to find which employees to notify', colors.blue);
      log('  2. Job Template field - to get job details', colors.blue);
      log('  3. Patient field - to include patient info in SMS', colors.blue);
      log('  4. Status = "Open" - to trigger notifications', colors.blue);
      
      log('\nHOW TO FIX:', colors.green);
      log('1. This job occurrence needs to be properly linked to:', colors.green);
      log('   - A Provider record', colors.green);
      log('   - A Job Template record', colors.green);
      log('   - A Patient record (already has Patient (Link))', colors.green);
      log('\n2. Check how job occurrences are created in your system', colors.green);
      log('3. Ensure the voice agent properly sets these fields when creating/updating jobs', colors.green);
      
      // Check if this is a pattern
      log('\n' + '='.repeat(80), colors.cyan);
      log('CHECKING OTHER JOBS', colors.bright + colors.cyan);
      log('='.repeat(80) + '\n', colors.cyan);
      
      const recentJobs = await airtableClient.findRecords('Job Occurrences', '', { maxRecords: 10 });
      log(`Found ${recentJobs.length} recent job occurrences\n`, colors.blue);
      
      let jobsWithProvider = 0;
      let jobsWithTemplate = 0;
      
      recentJobs.forEach(j => {
        if (j.fields['Provider']?.[0]) jobsWithProvider++;
        if (j.fields['Job Template']?.[0]) jobsWithTemplate++;
      });
      
      log(`Jobs with Provider field: ${jobsWithProvider}/${recentJobs.length}`, jobsWithProvider > 0 ? colors.green : colors.red);
      log(`Jobs with Job Template field: ${jobsWithTemplate}/${recentJobs.length}`, jobsWithTemplate > 0 ? colors.green : colors.red);
      
      if (jobsWithProvider === 0 || jobsWithTemplate === 0) {
        log('\n⚠ WARNING: This appears to be a SYSTEMIC ISSUE', colors.yellow);
        log('Most or all job occurrences are missing these fields.', colors.yellow);
        log('The SMS notification system cannot work until this is fixed.', colors.yellow);
      }
      
    } else {
      log('✓ ALL REQUIRED FIELDS PRESENT', colors.green);
      log('\nThis job should trigger SMS notifications when left open.', colors.green);
      log('\nIf SMS still not working, check:', colors.blue);
      log('  1. Redis configuration (RAILWAY_REDIS_URL or REDIS_URL)', colors.blue);
      log('  2. Twilio configuration (credentials and messaging SID)', colors.blue);
      log('  3. SMS Wave Worker is running (check logs)', colors.blue);
      log('  4. Employees have valid phone numbers', colors.blue);
    }
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    console.error(error);
  }
}

const jobId = process.argv[2] || 'reclDXqGHA1A9o1Jn';
diagnose(jobId).then(() => process.exit(0));
