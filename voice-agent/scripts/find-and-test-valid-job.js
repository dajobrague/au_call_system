/**
 * Find a valid job and show what SMS would be sent
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function findAndTest() {
  console.log('\nFinding a valid job occurrence for SMS testing...\n');
  
  try {
    // Get recent job occurrences
    const jobs = await airtableClient.findRecords('Job Occurrences', '', { maxRecords: 20 });
    
    // Filter for ones with all required fields
    const validJobs = jobs.filter(job => 
      job.fields['Provider']?.[0] && 
      job.fields['Job Template']?.[0] && 
      job.fields['Patient (Link)']?.[0]
    );
    
    if (validJobs.length === 0) {
      console.log('No valid jobs found with all required fields.');
      return;
    }
    
    const testJob = validJobs[0];
    console.log(`Found valid job: ${testJob.id}`);
    console.log(`Status: ${testJob.fields['Status']}`);
    console.log(`Provider: ${testJob.fields['Provider'][0]}`);
    console.log(`Job Template: ${testJob.fields['Job Template'][0]}`);
    console.log(`Patient: ${testJob.fields['Patient (Link)'][0]}`);
    console.log(`\nTo test SMS simulation with this job, run:`);
    console.log(`\nnpx ts-node --project tsconfig.server.json scripts/test-sms-wave-simulation.js ${testJob.id}\n`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findAndTest().then(() => process.exit(0));
