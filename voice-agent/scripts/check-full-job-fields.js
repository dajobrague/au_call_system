/**
 * Check ALL fields in the job occurrence
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { airtableClient } = require('../src/services/airtable/client');

async function checkFullFields(jobId) {
  console.log(`\nChecking ALL fields for job: ${jobId}\n`);
  
  try {
    const job = await airtableClient.getJobOccurrenceById(jobId);
    
    if (!job) {
      console.log('Job not found!');
      return;
    }
    
    console.log('All fields in this job occurrence:\n');
    Object.keys(job.fields).sort().forEach(fieldName => {
      const value = job.fields[fieldName];
      console.log(`${fieldName}:`);
      console.log(`  Type: ${Array.isArray(value) ? 'Array' : typeof value}`);
      console.log(`  Value: ${JSON.stringify(value)}`);
      console.log('');
    });
    
    // Check for provider lookup fields
    console.log('\nLooking for Provider ID fields:');
    const providerFields = Object.keys(job.fields).filter(f => 
      f.toLowerCase().includes('provider') || f.toLowerCase().includes('recordid')
    );
    
    providerFields.forEach(field => {
      console.log(`  ${field}: ${JSON.stringify(job.fields[field])}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

const jobId = process.argv[2] || 'reclDXqGHA1A9o1Jn';
checkFullFields(jobId).then(() => process.exit(0));
