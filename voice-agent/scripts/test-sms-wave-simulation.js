/**
 * Test Script: SMS Wave System Simulation
 * 
 * This script simulates the SMS wave notification system when a job is opened (released).
 * It fetches the job occurrence, finds all employees that should receive notifications,
 * and simulates (but doesn't actually send) the SMS messages that would be sent.
 * 
 * Usage: node scripts/test-sms-wave-simulation.js [jobOccurrenceId]
 * Default job: reclDXqGHA1A9o1Jn
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Import required services
const { airtableClient } = require('../src/services/airtable/client');
const { jobNotificationService } = require('../src/services/sms/job-notification-service');
const { filterValidPhoneNumbers } = require('../src/utils/phone-validator');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

/**
 * Format privacy-safe patient name (FirstName LastInitial)
 */
function formatPrivacyName(fullName) {
  if (!fullName) return 'Patient';
  
  const parts = fullName.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0];
  }
  
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  
  return `${firstName} ${lastInitial}.`;
}

/**
 * Format date for SMS (short format)
 */
function formatDateForSMS(dateString) {
  if (!dateString) return 'TBD';
  
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-AU', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch (error) {
    return 'TBD';
  }
}

/**
 * Extract time from display date
 */
function extractTimeFromDisplay(displayDate) {
  if (!displayDate) return 'TBD';
  
  // Try to extract time from "September 9th at 4:30 PM" format
  const timeMatch = displayDate.match(/(\d{1,2}:\d{2}\s?(AM|PM))/i);
  if (timeMatch) {
    return timeMatch[0];
  }
  
  return 'TBD';
}

/**
 * Calculate wave intervals based on shift timing
 */
function calculateWaveIntervals(scheduledAt) {
  try {
    const now = new Date();
    const shiftTime = new Date(scheduledAt);
    const hoursUntilShift = (shiftTime - now) / (1000 * 60 * 60);
    
    let intervalMinutes;
    
    if (hoursUntilShift <= 2) {
      intervalMinutes = 10;
    } else if (hoursUntilShift <= 3) {
      intervalMinutes = 15;
    } else if (hoursUntilShift <= 4) {
      intervalMinutes = 20;
    } else if (hoursUntilShift <= 5) {
      intervalMinutes = 25;
    } else {
      intervalMinutes = 30;
    }
    
    return {
      baseIntervalMinutes: intervalMinutes,
      wave2DelayMinutes: intervalMinutes,
      wave3DelayMinutes: intervalMinutes * 2,
      hoursUntilShift: hoursUntilShift.toFixed(2)
    };
  } catch (error) {
    return {
      baseIntervalMinutes: 30,
      wave2DelayMinutes: 30,
      wave3DelayMinutes: 60,
      hoursUntilShift: 'Unknown'
    };
  }
}

/**
 * Generate SMS content for each wave
 */
function generateSMSContent(waveNumber, jobOccurrence, patient, employeeId, baseUrl) {
  const privacyName = formatPrivacyName(patient.name);
  const shortDate = formatDateForSMS(jobOccurrence.scheduledAt);
  const shortTime = extractTimeFromDisplay(jobOccurrence.displayDate);
  const jobUrl = `${baseUrl}/job/${jobOccurrence.id}?emp=${employeeId}`;
  
  if (waveNumber === 1) {
    return `JOB AVAILABLE: ${privacyName}, ${shortDate} ${shortTime}. Reply or view: ${jobUrl}`;
  } else {
    return `JOB AVAILABLE (Wave ${waveNumber}): ${privacyName}, ${shortDate} ${shortTime}. Reply or view: ${jobUrl}`;
  }
}

/**
 * Main test function
 */
async function testSMSWaveSimulation(jobOccurrenceId) {
  try {
    logSection('SMS Wave System Simulation Test');
    
    // Get base URL for SMS links
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
      : process.env.BASE_URL || 'http://localhost:3000';
    
    logInfo(`Using base URL: ${baseUrl}`);
    logInfo(`Target job occurrence: ${jobOccurrenceId}`);
    console.log();
    
    // ============================================================
    // STEP 1: Fetch Job Occurrence
    // ============================================================
    logSection('STEP 1: Fetching Job Occurrence from Airtable');
    
    const jobOccurrence = await airtableClient.getJobOccurrenceById(jobOccurrenceId);
    
    if (!jobOccurrence) {
      logError(`Job occurrence not found: ${jobOccurrenceId}`);
      process.exit(1);
    }
    
    logSuccess(`Job occurrence found: ${jobOccurrence.id}`);
    console.log('\nJob Details:');
    console.log(`  Status: ${jobOccurrence.fields['Status']}`);
    console.log(`  Scheduled At: ${jobOccurrence.fields['Scheduled At']}`);
    console.log(`  Display Date: ${jobOccurrence.fields['Display Date']}`);
    console.log(`  Provider: ${jobOccurrence.fields['Provider']?.[0] || 'N/A'}`);
    console.log(`  Assigned Employee: ${jobOccurrence.fields['Assigned Employee']?.[0] || 'None'}`);
    
    // Extract provider ID from various possible fields
    const providerId = jobOccurrence.fields['Provider']?.[0]
      || jobOccurrence.fields['recordId (from Provider) (from Job Template)']?.[0]
      || jobOccurrence.fields['recordId (from Provider) (from Patient (Link))']?.[0];
      
    const jobTemplateId = jobOccurrence.fields['Job Template']?.[0];
    const patientId = jobOccurrence.fields['Patient (Lookup)']?.[0] || jobOccurrence.fields['Patient (Link)']?.[0];
    
    if (!providerId) {
      logError('Job occurrence has no provider!');
      logInfo('Checked fields: Provider, recordId (from Provider) (from Job Template), recordId (from Provider) (from Patient (Link))');
      process.exit(1);
    }
    
    logSuccess(`Provider ID found: ${providerId}`);
    
    // Job template is optional (direct patient jobs don't have one)
    if (!jobTemplateId) {
      logWarning('Job occurrence has no job template (direct patient job)');
    }
    
    if (!patientId) {
      logError('Job occurrence has no patient!');
      process.exit(1);
    }
    
    // ============================================================
    // STEP 2: Fetch Provider Details
    // ============================================================
    logSection('STEP 2: Fetching Provider Details');
    
    const provider = await airtableClient.getProviderById(providerId);
    
    if (!provider) {
      logError(`Provider not found: ${providerId}`);
      process.exit(1);
    }
    
    logSuccess(`Provider found: ${provider.fields['Name']}`);
    console.log('\nProvider Details:');
    console.log(`  Provider ID: ${provider.id}`);
    console.log(`  Name: ${provider.fields['Name']}`);
    console.log(`  Active: ${provider.fields['Active'] !== false ? 'Yes' : 'No'}`);
    console.log(`  Timezone: ${provider.fields['Timezone'] || 'Not set'}`);
    
    // ============================================================
    // STEP 3: Fetch Job Template Details (if exists)
    // ============================================================
    logSection('STEP 3: Fetching Job Template Details');
    
    let jobTemplate = null;
    if (jobTemplateId) {
      jobTemplate = await airtableClient.getJobTemplateById(jobTemplateId);
      
      if (!jobTemplate) {
        logError(`Job template not found: ${jobTemplateId}`);
        process.exit(1);
      }
      
      logSuccess(`Job template found: ${jobTemplate.fields['Job Code']}`);
      console.log('\nJob Template Details:');
      console.log(`  Job Code: ${jobTemplate.fields['Job Code']}`);
      console.log(`  Title: ${jobTemplate.fields['Title']}`);
      console.log(`  Service Type: ${jobTemplate.fields['Service Type']}`);
    } else {
      logInfo('No job template (direct patient job)');
      console.log('\nThis is a direct patient job without a template.');
    }
    
    // ============================================================
    // STEP 4: Fetch Patient Details
    // ============================================================
    logSection('STEP 4: Fetching Patient Details');
    
    const patient = await airtableClient.getPatientById(patientId);
    
    if (!patient) {
      logError(`Patient not found: ${patientId}`);
      process.exit(1);
    }
    
    logSuccess(`Patient found: ${patient.fields['Name']}`);
    console.log('\nPatient Details:');
    console.log(`  Full Name: ${patient.fields['Name']}`);
    console.log(`  Privacy Name: ${formatPrivacyName(patient.fields['Name'])}`);
    
    // ============================================================
    // STEP 5: Find All Provider Employees
    // ============================================================
    logSection('STEP 5: Finding All Provider Employees');
    
    logInfo(`Querying Airtable for employees of provider: ${providerId}`);
    const employeeRecords = await airtableClient.findEmployeesByProvider(providerId);
    
    logSuccess(`Found ${employeeRecords.length} total employees`);
    
    // Transform employees
    const allEmployees = employeeRecords
      .filter(record => record.fields['Active'] !== false)
      .filter(record => record.fields['Phone'])
      .map(record => ({
        id: record.id,
        name: record.fields['Display Name'] || 'Unknown Employee',
        pin: record.fields['Employee PIN'] || 0,
        phone: record.fields['Phone'],
        active: record.fields['Active'] !== false
      }));
    
    logSuccess(`${allEmployees.length} active employees with phone numbers`);
    
    // Filter to valid phone numbers
    const validEmployees = filterValidPhoneNumbers(allEmployees);
    
    if (validEmployees.length === 0) {
      logError('No valid employees found for SMS notifications!');
      console.log('\nPossible reasons:');
      console.log('  - No employees assigned to this provider');
      console.log('  - All employees are inactive');
      console.log('  - No employees have valid phone numbers');
      console.log('  - Phone numbers are not in valid format (+61 for Australia)');
      process.exit(1);
    }
    
    logSuccess(`${validEmployees.length} employees with valid phone numbers`);
    
    // Display employee list
    console.log('\nEmployees that will receive notifications:');
    validEmployees.forEach((emp, index) => {
      console.log(`  ${index + 1}. ${emp.name} (PIN: ${emp.pin})`);
      console.log(`     Phone: ${emp.phone}`);
      console.log(`     Employee ID: ${emp.id}`);
    });
    
    // ============================================================
    // STEP 6: Calculate Wave Intervals
    // ============================================================
    logSection('STEP 6: Calculating Wave Intervals');
    
    const intervals = calculateWaveIntervals(jobOccurrence.fields['Scheduled At']);
    
    console.log('\nWave Timing:');
    console.log(`  Hours until shift: ${intervals.hoursUntilShift} hours`);
    console.log(`  Base interval: ${intervals.baseIntervalMinutes} minutes`);
    console.log(`  Wave 1: Immediate (sent right away)`);
    console.log(`  Wave 2: After ${intervals.wave2DelayMinutes} minutes`);
    console.log(`  Wave 3: After ${intervals.wave3DelayMinutes} minutes (total from Wave 1)`);
    
    // ============================================================
    // STEP 7: Simulate Wave 1 (Immediate SMS)
    // ============================================================
    logSection('STEP 7: Simulating Wave 1 (Immediate SMS)');
    
    logInfo('Wave 1 would be sent immediately when job is opened');
    console.log('\nWave 1 SMS Messages:');
    console.log('-'.repeat(80));
    
    validEmployees.forEach((employee, index) => {
      const smsContent = generateSMSContent(1, {
        id: jobOccurrence.id,
        scheduledAt: jobOccurrence.fields['Scheduled At'],
        displayDate: jobOccurrence.fields['Display Date']
      }, {
        name: patient.fields['Name']
      }, employee.id, baseUrl);
      
      console.log(`\n${index + 1}. To: ${employee.name} (${employee.phone})`);
      console.log(`   Message: ${smsContent}`);
      console.log(`   Length: ${smsContent.length} characters ${smsContent.length <= 160 ? '✓ Single segment' : '⚠ Multiple segments'}`);
    });
    
    logSuccess(`Wave 1 would send ${validEmployees.length} SMS messages`);
    
    // ============================================================
    // STEP 8: Simulate Wave 2 (Delayed SMS)
    // ============================================================
    logSection('STEP 8: Simulating Wave 2 (Delayed SMS)');
    
    logInfo(`Wave 2 would be sent after ${intervals.wave2DelayMinutes} minutes if job still open`);
    console.log('\nWave 2 SMS Messages:');
    console.log('-'.repeat(80));
    
    validEmployees.forEach((employee, index) => {
      const smsContent = generateSMSContent(2, {
        id: jobOccurrence.id,
        scheduledAt: jobOccurrence.fields['Scheduled At'],
        displayDate: jobOccurrence.fields['Display Date']
      }, {
        name: patient.fields['Name']
      }, employee.id, baseUrl);
      
      console.log(`\n${index + 1}. To: ${employee.name} (${employee.phone})`);
      console.log(`   Message: ${smsContent}`);
      console.log(`   Length: ${smsContent.length} characters ${smsContent.length <= 160 ? '✓ Single segment' : '⚠ Multiple segments'}`);
    });
    
    logSuccess(`Wave 2 would send ${validEmployees.length} SMS messages`);
    
    // ============================================================
    // STEP 9: Simulate Wave 3 (Final Wave)
    // ============================================================
    logSection('STEP 9: Simulating Wave 3 (Final Wave)');
    
    logInfo(`Wave 3 would be sent after ${intervals.wave3DelayMinutes} minutes if job still open`);
    logInfo('After Wave 3, if job is still open, it will be marked as "UNFILLED_AFTER_SMS"');
    console.log('\nWave 3 SMS Messages:');
    console.log('-'.repeat(80));
    
    validEmployees.forEach((employee, index) => {
      const smsContent = generateSMSContent(3, {
        id: jobOccurrence.id,
        scheduledAt: jobOccurrence.fields['Scheduled At'],
        displayDate: jobOccurrence.fields['Display Date']
      }, {
        name: patient.fields['Name']
      }, employee.id, baseUrl);
      
      console.log(`\n${index + 1}. To: ${employee.name} (${employee.phone})`);
      console.log(`   Message: ${smsContent}`);
      console.log(`   Length: ${smsContent.length} characters ${smsContent.length <= 160 ? '✓ Single segment' : '⚠ Multiple segments'}`);
    });
    
    logSuccess(`Wave 3 would send ${validEmployees.length} SMS messages`);
    
    // ============================================================
    // SUMMARY
    // ============================================================
    logSection('SUMMARY');
    
    console.log('Test Results:');
    console.log(`  ✓ Job Occurrence: ${jobOccurrence.id}`);
    console.log(`  ✓ Provider: ${provider.fields['Name']}`);
    console.log(`  ✓ Patient: ${formatPrivacyName(patient.fields['Name'])}`);
    console.log(`  ✓ Eligible Employees: ${validEmployees.length}`);
    console.log(`  ✓ Total SMS in Wave 1: ${validEmployees.length}`);
    console.log(`  ✓ Total SMS in Wave 2: ${validEmployees.length} (after ${intervals.wave2DelayMinutes} min)`);
    console.log(`  ✓ Total SMS in Wave 3: ${validEmployees.length} (after ${intervals.wave3DelayMinutes} min)`);
    console.log(`  ✓ Total SMS across all waves: ${validEmployees.length * 3}`);
    
    console.log('\nNOTE: This was a SIMULATION. No actual SMS messages were sent.');
    console.log('The system appears to be configured correctly for sending SMS notifications.');
    
    // ============================================================
    // POTENTIAL ISSUES CHECK
    // ============================================================
    logSection('POTENTIAL ISSUES CHECK');
    
    let issuesFound = false;
    
    // Check if job status is Open
    if (jobOccurrence.fields['Status'] !== 'Open') {
      logWarning(`Job status is "${jobOccurrence.fields['Status']}" (not "Open")`);
      logInfo('SMS waves are only triggered when job status is "Open"');
      issuesFound = true;
    }
    
    // Check if job has assigned employee
    if (jobOccurrence.fields['Assigned Employee']?.[0]) {
      logWarning('Job already has an assigned employee');
      logInfo('SMS waves are only triggered when job is left open (no employee assigned)');
      issuesFound = true;
    }
    
    // Check Redis configuration
    if (!process.env.RAILWAY_REDIS_URL && !process.env.REDIS_URL) {
      logError('No Redis URL configured!');
      logInfo('SMS waves require Redis for Bull queue. Set RAILWAY_REDIS_URL or REDIS_URL');
      issuesFound = true;
    } else {
      logSuccess('Redis URL is configured');
    }
    
    // Check Twilio configuration
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logError('Twilio credentials not configured!');
      logInfo('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment');
      issuesFound = true;
    } else {
      logSuccess('Twilio credentials are configured');
    }
    
    if (!process.env.TWILIO_MESSAGING_SID) {
      logWarning('TWILIO_MESSAGING_SID not configured');
      logInfo('SMS sending may not work without Messaging Service SID');
      issuesFound = true;
    } else {
      logSuccess('Twilio Messaging Service SID is configured');
    }
    
    if (!issuesFound) {
      logSuccess('No configuration issues detected!');
      console.log('\nIf SMS notifications are not working, check:');
      console.log('  1. Is the SMS Wave Worker running? (Check Railway logs for "SMS Wave Worker initialized")');
      console.log('  2. Are the jobs being triggered correctly? (Check logs for "wave_redistribution_start")');
      console.log('  3. Is Redis connection stable? (Check logs for Redis connection errors)');
      console.log('  4. Are there any Twilio API errors? (Check logs for SMS send failures)');
    }
    
    logSection('Test Complete');
    
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Get job occurrence ID from command line or use default
const jobOccurrenceId = process.argv[2] || 'reclDXqGHA1A9o1Jn';

// Run the test
testSMSWaveSimulation(jobOccurrenceId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });

