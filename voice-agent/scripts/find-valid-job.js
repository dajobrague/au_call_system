/**
 * Find a valid job occurrence with all required fields
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function findValidJob() {
  console.log('\nSearching for valid job occurrences with all required fields...\n');
  
  try {
    // Get recent job occurrences - just get all open ones first
    const jobs = await airtableClient.findRecords('Job Occurrences', 
      `{Status} = 'Open'`,
      { maxRecords: 20 }
    );
    
    console.log(`Found ${jobs.length} open job occurrences\n`);
    
    // Filter for ones with all required fields
    const validJobs = jobs.filter(job => 
      job.fields['Provider']?.[0] && 
      job.fields['Job Template']?.[0] && 
      job.fields['Patient (Link)']?.[0]
    );
    
    console.log(`${validJobs.length} have all required fields:\n`);
    
    validJobs.forEach((job, index) => {
      console.log(`${index + 1}. Job ID: ${job.id}`);
      console.log(`   Status: ${job.fields['Status']}`);
      console.log(`   Provider: ${job.fields['Provider']?.[0] || 'N/A'}`);
      console.log(`   Job Template: ${job.fields['Job Template']?.[0] || 'N/A'}`);
      console.log(`   Patient: ${job.fields['Patient (Link)']?.[0] || 'N/A'}`);
      console.log(`   Scheduled At: ${job.fields['Scheduled At']}`);
      console.log(`   Display Date: ${job.fields['Display Date']}`);
      console.log('');
    });
    
    if (validJobs.length > 0) {
      console.log(`\nUse this job ID for testing: ${validJobs[0].id}`);
      console.log(`\nRun: npx ts-node --project tsconfig.server.json scripts/test-sms-wave-simulation.js ${validJobs[0].id}`);
    } else {
      console.log('\nNo valid jobs found. The job needs Provider, Job Template, and Patient fields.');
      console.log('\nShowing all open jobs:');
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. Job ID: ${job.id}`);
        console.log(`   Fields: ${Object.keys(job.fields).join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

findValidJob().then(() => process.exit(0));
