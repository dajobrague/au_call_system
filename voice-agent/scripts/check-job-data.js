/**
 * Quick script to check job occurrence data
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function checkJob(jobId) {
  console.log(`\nChecking job occurrence: ${jobId}\n`);
  
  try {
    const job = await airtableClient.getJobOccurrenceById(jobId);
    
    if (!job) {
      console.log('Job not found!');
      return;
    }
    
    console.log('Job Record:');
    console.log(JSON.stringify(job, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

const jobId = process.argv[2] || 'reclDXqGHA1A9o1Jn';
checkJob(jobId).then(() => process.exit(0));
