/**
 * Test different date formats with the report API
 * This will help us identify what date format Airtable is using
 */

async function testDateFormats() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('==========================================');
  console.log('   DATE FORMAT TEST');
  console.log('==========================================\n');

  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const endpoint = `${API_URL}/api/reports/daily-call-summary`;

  // Test different date representations for October 1, 2, 3
  const testDates = [
    { date: '2025-10-01', description: 'Oct 1 (YYYY-MM-DD)' },
    { date: '2025-10-02', description: 'Oct 2 (YYYY-MM-DD)' },
    { date: '2025-10-03', description: 'Oct 3 (YYYY-MM-DD)' },
  ];

  for (const test of testDates) {
    console.log(`\nTesting: ${test.description}`);
    console.log('--------------------------------------');
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: test.date })
      });

      const data = await response.json();
      
      if (data.success && data.totalCalls > 0) {
        console.log(`✅ FOUND CALLS!`);
        console.log(`   Total Calls: ${data.totalCalls}`);
        console.log(`   Providers: ${data.reports?.length || 0}`);
        
        if (data.reports && data.reports.length > 0) {
          data.reports.forEach((report, idx) => {
            console.log(`   ${idx + 1}. ${report.providerName}: ${report.callCount} calls`);
          });
        }
      } else {
        console.log(`❌ No calls found`);
        console.log(`   API response: success=${data.success}, totalCalls=${data.totalCalls || 0}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n==========================================');
  console.log('TEST COMPLETE');
  console.log('==========================================\n');
  console.log('Check the logs above to see which dates returned results.');
  console.log('The API is looking for text field format: M/D/YYYY');
  console.log('Example: 10/1/2025 for October 1st, 2025\n');
}

// Run the test
console.log('Starting date format test...\n');
testDateFormats();

