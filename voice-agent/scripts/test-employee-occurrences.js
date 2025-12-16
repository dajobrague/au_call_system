/**
 * Diagnostic Script: Test Employee Occurrence Filtering
 * Tests the exact websocket authentication and occurrence filtering flow
 * for a specific employee to identify why occurrences aren't being found
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Import the services used in websocket authentication flow
const { employeeService } = require('../src/services/airtable/employee-service');
const { multiProviderService } = require('../src/services/airtable/multi-provider-service');
const { jobService } = require('../src/services/airtable/job-service');
const { jobOccurrenceService } = require('../src/services/airtable/job-occurrence-service');
const { airtableClient } = require('../src/services/airtable/client');

// Test employee ID
const TEST_EMPLOYEE_ID = 'recW1CXg3O5I3oR0g';

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
 * Main diagnostic function
 */
async function runDiagnostics() {
  logSection('EMPLOYEE OCCURRENCE FILTERING DIAGNOSTICS');
  
  log(`Testing Employee ID: ${TEST_EMPLOYEE_ID}`, colors.bright);
  log(`Today's Date: ${new Date().toISOString().split('T')[0]}`, colors.bright);
  
  try {
    // Step 1: Fetch employee directly
    logSection('Step 1: Fetch Employee Record');
    const employee = await airtableClient.getEmployeeById(TEST_EMPLOYEE_ID);
    
    if (!employee) {
      logError('Employee not found in Airtable!');
      return;
    }
    
    logSuccess('Employee found!');
    console.log('Employee Details:');
    console.log('  ID:', employee.id);
    console.log('  Display Name:', employee.fields['Display Name']);
    console.log('  Phone:', employee.fields['Phone']);
    console.log('  Provider:', employee.fields['Provider']);
    console.log('  Active:', employee.fields['Active']);
    console.log('  Job Templates:', employee.fields['Job Templates']?.length || 0);
    
    // Transform to Employee object
    const employeeObj = {
      id: employee.id,
      name: employee.fields['Display Name'],
      pin: employee.fields['PIN'],
      phone: employee.fields['Phone'],
      providerId: employee.fields['Provider']?.[0],
      jobTemplateIds: employee.fields['Job Templates'] || [],
      active: employee.fields['Active'] !== false
    };
    
    // Step 2: Fetch providers
    logSection('Step 2: Fetch Employee Providers');
    const providerResult = await multiProviderService.getEmployeeProviders(employeeObj);
    
    console.log('Provider Results:');
    console.log('  Has Multiple Providers:', providerResult.hasMultipleProviders);
    console.log('  Provider Count:', providerResult.providers?.length || 0);
    
    if (providerResult.providers && providerResult.providers.length > 0) {
      providerResult.providers.forEach((p, i) => {
        console.log(`  Provider ${i + 1}:`, p.name, `(${p.id})`);
      });
    }
    
    // Step 3: Fetch job templates (PATH A setup)
    logSection('Step 3: Fetch Job Templates (PATH A)');
    
    const providerId = employeeObj.providerId;
    
    // Show the exact filter that will be used
    let jobFilterFormula = `FIND('${employeeObj.id}', ARRAYJOIN({recordId (from Default Employee)}))`;
    if (providerId) {
      jobFilterFormula = `AND(${jobFilterFormula}, FIND('${providerId}', ARRAYJOIN({recordId (from Provider)})))`;
    }
    
    logInfo('Job Template Filter Formula:');
    console.log(`  ${jobFilterFormula}\n`);
    
    const employeeJobsResult = await jobService.getEmployeeJobs(employeeObj, providerId);
    
    if (!employeeJobsResult.success) {
      logError(`Failed to fetch jobs: ${employeeJobsResult.error}`);
      return;
    }
    
    const employeeJobs = employeeJobsResult.jobs || [];
    
    console.log('Job Templates Found:', employeeJobs.length);
    
    if (employeeJobs.length > 0) {
      employeeJobs.forEach((job, i) => {
        console.log(`\n  Job ${i + 1}:`);
        console.log(`    Job Code: ${job.jobTemplate.jobCode}`);
        console.log(`    Title: ${job.jobTemplate.title}`);
        console.log(`    Job Template ID: ${job.jobTemplate.id}`);
        console.log(`    Patient: ${job.patient?.name || 'No patient'}`);
        console.log(`    Occurrence IDs: ${job.jobTemplate.occurrenceIds?.length || 0}`);
      });
    } else {
      logWarning('No job templates found for this employee!');
    }
    
    // Step 4: Fetch occurrences via Job Templates (PATH A)
    logSection('Step 4: Fetch Occurrences via Job Templates (PATH A)');
    
    if (employeeJobs.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      logInfo('Occurrence Filter Criteria (applied in getFutureOccurrences):');
      console.log(`  - Status must be: 'Scheduled'`);
      console.log(`  - Scheduled At must be >= '${today}'`);
      console.log(`  - Assigned Employee ID must match: '${employeeObj.id}'`);
      console.log('');
      
      // Fetch enriched occurrences
      const enrichedOccurrences = await jobOccurrenceService.getAllEmployeeOccurrencesEnriched(
        employeeJobs,
        employeeObj.id
      );
      
      console.log('Enriched Occurrences Found:', enrichedOccurrences.length);
      
      if (enrichedOccurrences.length > 0) {
        enrichedOccurrences.forEach((occ, i) => {
          console.log(`\n  Occurrence ${i + 1}:`);
          console.log(`    Job: ${occ.jobTemplate.title} (${occ.jobTemplate.jobCode})`);
          console.log(`    Patient: ${occ.patient.fullName}`);
          console.log(`    Scheduled: ${occ.scheduledAt} at ${occ.time}`);
          console.log(`    Display: ${occ.displayDateTime}`);
          console.log(`    Status: ${occ.status}`);
          console.log(`    Occurrence Record ID: ${occ.occurrenceRecordId}`);
        });
        
        logSuccess(`PATH A: Found ${enrichedOccurrences.length} occurrence(s)`);
      } else {
        logWarning('PATH A: No occurrences found via job templates');
        
        // Let's check individual job occurrences to see why they're filtered out
        logSection('Step 4a: Deep Dive - Check Individual Occurrences');
        
        for (const job of employeeJobs) {
          if (job.jobTemplate.occurrenceIds && job.jobTemplate.occurrenceIds.length > 0) {
            console.log(`\nChecking occurrences for Job ${job.jobTemplate.jobCode}:`);
            console.log(`  Total Occurrence IDs: ${job.jobTemplate.occurrenceIds.length}`);
            
            // Fetch all occurrences
            const occurrencePromises = job.jobTemplate.occurrenceIds.map(occId => 
              airtableClient.getJobOccurrenceById(occId)
            );
            
            const occurrenceRecords = await Promise.all(occurrencePromises);
            const validRecords = occurrenceRecords.filter(r => r !== null);
            
            console.log(`  Valid Records Fetched: ${validRecords.length}`);
            
            validRecords.forEach((record, idx) => {
              const fields = record.fields;
              const scheduledAt = fields['Scheduled At'] || '';
              const time = fields['Time'] || '';
              const status = fields['Status'] || 'Unknown';
              const assignedEmployees = fields['Assigned Employee'] || [];
              const assignedEmployeeId = assignedEmployees[0] || '';
              
              const isFuture = scheduledAt >= today;
              const isScheduled = status === 'Scheduled';
              const isAssigned = assignedEmployeeId === employeeObj.id;
              
              console.log(`\n    Occurrence ${idx + 1}:`);
              console.log(`      Record ID: ${record.id}`);
              console.log(`      Scheduled At: ${scheduledAt} (Future: ${isFuture ? 'YES' : 'NO'})`);
              console.log(`      Time: ${time}`);
              console.log(`      Status: ${status} (Match: ${isScheduled ? 'YES' : 'NO'})`);
              console.log(`      Assigned Employee ID: ${assignedEmployeeId}`);
              console.log(`      Employee Match: ${isAssigned ? 'YES' : 'NO'}`);
              console.log(`      ✓ Would be included: ${isFuture && isScheduled && isAssigned ? 'YES' : 'NO'}`);
              
              if (!isFuture) logWarning('      → FILTERED OUT: Date is not in the future');
              if (!isScheduled) logWarning(`      → FILTERED OUT: Status is '${status}', not 'Scheduled'`);
              if (!isAssigned) logWarning(`      → FILTERED OUT: Assigned to '${assignedEmployeeId}', not '${employeeObj.id}'`);
            });
          }
        }
      }
    } else {
      logWarning('PATH A: Skipped (no job templates found)');
    }
    
    // Step 5: Test direct occurrence fetch (PATH B) - FORCE THIS TO RUN
    logSection('Step 5: Fetch Occurrences Directly (PATH B - FORCED)');
    
    const today = new Date().toISOString().split('T')[0];
    const directFilterFormula = `AND(FIND('${employeeObj.id}', ARRAYJOIN({recordId (from Assigned Employee)})), {Status} = 'Scheduled', {Scheduled At} >= '${today}')`;
    
    logInfo('Direct Occurrence Filter Formula:');
    console.log(`  ${directFilterFormula}\n`);
    
    // Manually test the direct fetch path
    try {
      const https = require('https');
      const airtableConfig = require('../src/config/airtable').airtableConfig;
      
      const params = new URLSearchParams({
        filterByFormula: directFilterFormula,
        maxRecords: '9'
      });
      
      const fields = ['Occurrence ID', 'Job Template', 'Scheduled At', 'Time', 'Status', 'Assigned Employee', 'Provider', 'Patient TXT', 'Employee TXT', 'recordId (from Assigned Employee)'];
      fields.forEach(field => params.append('fields[]', field));
      
      params.append('sort[0][field]', 'Scheduled At');
      params.append('sort[0][direction]', 'asc');
      
      const path = `/v0/${airtableConfig.baseId}/${encodeURIComponent('Job Occurrences')}?${params.toString()}`;
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.airtable.com',
          port: 443,
          path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${airtableConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error('Failed to parse response'));
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
      
      console.log('Direct Occurrences Found:', response.records?.length || 0);
      
      if (response.records && response.records.length > 0) {
        response.records.forEach((record, i) => {
          const fields = record.fields;
          console.log(`\n  Occurrence ${i + 1}:`);
          console.log(`    Record ID: ${record.id}`);
          console.log(`    Occurrence ID: ${fields['Occurrence ID']}`);
          console.log(`    Scheduled At: ${fields['Scheduled At']}`);
          console.log(`    Time: ${fields['Time']}`);
          console.log(`    Status: ${fields['Status']}`);
          console.log(`    Patient: ${fields['Patient TXT']}`);
          console.log(`    Employee: ${fields['Employee TXT']}`);
        });
        
        logSuccess(`PATH B: Found ${response.records.length} occurrence(s)`);
      } else {
        logWarning('PATH B: No occurrences found via direct query');
        
        if (response.error) {
          logError(`Airtable Error: ${JSON.stringify(response.error)}`);
        }
      }
      
    } catch (error) {
      logError(`Direct fetch error: ${error.message}`);
    }
    
    // Step 6: Summary
    logSection('SUMMARY');
    
    console.log('Test Employee:', employeeObj.name, `(${employeeObj.id})`);
    console.log('Provider ID:', providerId || 'None');
    console.log('Job Templates Found:', employeeJobs.length);
    console.log('Total Occurrence IDs in Job Templates:', 
      employeeJobs.reduce((sum, job) => sum + (job.jobTemplate.occurrenceIds?.length || 0), 0)
    );
    
    logSection('DIAGNOSIS');
    
    if (employeeJobs.length === 0) {
      logError('ROOT CAUSE: Employee has NO job templates assigned');
      logInfo('SOLUTION: Ensure employee is assigned to job templates in the "Default Employee" field');
      logInfo('          Or ensure job templates exist for this employee\'s provider');
    } else if (employeeJobs.every(job => !job.jobTemplate.occurrenceIds || job.jobTemplate.occurrenceIds.length === 0)) {
      logError('ROOT CAUSE: Job templates have NO occurrences linked');
      logInfo('SOLUTION: Link occurrences to job templates in Airtable');
    } else {
      logWarning('ROOT CAUSE: Occurrences exist but are being filtered out');
      logInfo('POSSIBLE REASONS:');
      logInfo('  1. Occurrences have Status != "Scheduled" (check Status field)');
      logInfo('  2. Occurrences have Scheduled At < today (check dates)');
      logInfo('  3. Occurrences not assigned to this employee (check Assigned Employee field)');
      logInfo('SOLUTION: Check the deep dive output above to see exact filter failures');
    }
    
  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
  }
}

// Run diagnostics
runDiagnostics()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    log('Diagnostics Complete', colors.bright + colors.green);
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });

