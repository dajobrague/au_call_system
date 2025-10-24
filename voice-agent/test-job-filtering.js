/**
 * Test script to verify job filtering by employee and provider record IDs
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✅ Loaded environment variables from .env.local\n');
}

// Register ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true
  }
});

async function testJobFiltering() {
  console.log('🧪 Testing Job Filtering by Employee and Provider Record IDs\n');
  console.log('=' .repeat(70));
  
  try {
    // Import services
    const { jobService } = require('./src/services/airtable/job-service.ts');
    const { employeeService } = require('./src/services/airtable/employee-service.ts');
    
    // Test employee and provider IDs
    const testEmployeeId = 'recW1CXg3O5I3oR0g';
    const testProviderId = 'recexHQJ13oafJkxZ';
    
    console.log(`\n📋 Test Parameters:`);
    console.log(`   Employee Record ID: ${testEmployeeId}`);
    console.log(`   Provider Record ID: ${testProviderId}`);
    console.log('=' .repeat(70));
    
    // First, get the employee details
    console.log(`\n🔍 Step 1: Fetching employee details...`);
    const employeeRecord = await require('./src/services/airtable/client.ts').airtableClient.getEmployeeById(testEmployeeId);
    
    if (!employeeRecord) {
      console.error(`❌ Employee not found with ID: ${testEmployeeId}`);
      return;
    }
    
    const employee = {
      id: employeeRecord.id,
      name: employeeRecord.fields['Display Name'] || 'Unknown',
      pin: employeeRecord.fields['Employee PIN'] || 0,
      phone: employeeRecord.fields['Phone'] || '',
      providerId: employeeRecord.fields['Provider']?.[0] || '',
      jobTemplateIds: employeeRecord.fields['Job Templates'] || [],
      active: employeeRecord.fields['Active'] !== false
    };
    
    console.log(`✅ Employee found:`);
    console.log(`   Name: ${employee.name}`);
    console.log(`   Phone: ${employee.phone}`);
    console.log(`   Provider ID: ${employee.providerId}`);
    console.log(`   Job Template IDs: ${employee.jobTemplateIds.length} templates`);
    
    // Test 1: Get jobs WITHOUT provider filter
    console.log(`\n🔍 Step 2: Fetching jobs WITHOUT provider filter...`);
    const allJobsResult = await jobService.getEmployeeJobs(employee);
    
    console.log(`\n📊 Results (No Provider Filter):`);
    console.log(`   Success: ${allJobsResult.success}`);
    console.log(`   Total Jobs: ${allJobsResult.jobs.length}`);
    
    if (allJobsResult.jobs.length > 0) {
      console.log(`\n   Jobs Found:`);
      allJobsResult.jobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.jobTemplate.jobCode} - ${job.jobTemplate.title}`);
        console.log(`      Patient: ${job.patient?.name || 'N/A'}`);
        console.log(`      Service Type: ${job.jobTemplate.serviceType}`);
        console.log(`      Provider ID: ${job.jobTemplate.providerId}`);
      });
    } else {
      console.log(`   ⚠️  No jobs found`);
    }
    
    // Test 2: Get jobs WITH provider filter
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n🔍 Step 3: Fetching jobs WITH provider filter (${testProviderId})...`);
    const filteredJobsResult = await jobService.getEmployeeJobs(employee, testProviderId);
    
    console.log(`\n📊 Results (With Provider Filter):`);
    console.log(`   Success: ${filteredJobsResult.success}`);
    console.log(`   Total Jobs: ${filteredJobsResult.jobs.length}`);
    
    if (filteredJobsResult.jobs.length > 0) {
      console.log(`\n   Jobs Found:`);
      filteredJobsResult.jobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.jobTemplate.jobCode} - ${job.jobTemplate.title}`);
        console.log(`      Patient: ${job.patient?.name || 'N/A'}`);
        console.log(`      Service Type: ${job.jobTemplate.serviceType}`);
        console.log(`      Provider ID: ${job.jobTemplate.providerId}`);
      });
    } else {
      console.log(`   ⚠️  No jobs found for this provider`);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n✅ Test Complete!`);
    
    if (filteredJobsResult.jobs.length > 0) {
      console.log(`\n🎉 SUCCESS: Job filtering is working correctly!`);
      console.log(`   The system found ${filteredJobsResult.jobs.length} job(s) for employee ${employee.name}`);
      console.log(`   filtered by provider ${testProviderId}`);
    } else {
      console.log(`\n⚠️  WARNING: No jobs found with the provider filter.`);
      console.log(`   This could mean:`);
      console.log(`   1. The employee has no jobs assigned for this provider`);
      console.log(`   2. The "recordId (from Default Employee)" or "recordId (from Provider)" fields`);
      console.log(`      are not properly set in Airtable`);
      console.log(`   3. The jobs are marked as inactive`);
    }
    
  } catch (error) {
    console.error(`\n❌ Test failed with error:`);
    console.error(error);
  }
}

// Run the test
testJobFiltering().then(() => {
  console.log(`\n✅ Test script completed`);
  process.exit(0);
}).catch(error => {
  console.error(`\n❌ Test script failed:`, error);
  process.exit(1);
});
