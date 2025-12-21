/**
 * List all job occurrences with their fields
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function listJobs() {
  console.log('\nListing job occurrences...\n');
  
  try {
    const jobs = await airtableClient.findRecords('Job Occurrences', '', { maxRecords: 20 });
    
    console.log(`Found ${jobs.length} job occurrences:\n`);
    
    jobs.forEach((job, index) => {
      const hasProvider = job.fields['Provider'] && job.fields['Provider'].length > 0;
      const hasTemplate = job.fields['Job Template'] && job.fields['Job Template'].length > 0;
      const hasPatient = job.fields['Patient (Link)'] && job.fields['Patient (Link)'].length > 0;
      
      const status = hasProvider && hasTemplate && hasPatient ? '✓' : '✗';
      
      console.log(`${status} ${index + 1}. ${job.id}`);
      console.log(`   Status: ${job.fields['Status'] || 'N/A'}`);
      console.log(`   Provider: ${hasProvider ? job.fields['Provider'][0] : 'MISSING'}`);
      console.log(`   Job Template: ${hasTemplate ? job.fields['Job Template'][0] : 'MISSING'}`);
      console.log(`   Patient: ${hasPatient ? job.fields['Patient (Link)'][0] : 'MISSING'}`);
      console.log(`   Scheduled: ${job.fields['Scheduled At'] || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listJobs().then(() => process.exit(0));
