/**
 * Test Report Generation for October 10th, 2025
 * Direct test for the date requested by the user
 */

async function testOct10() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('==========================================');
  console.log('   OCTOBER 10, 2025 - REPORT TEST');
  console.log('==========================================\n');

  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const endpoint = `${API_URL}/api/reports/daily-call-summary`;

  console.log(`📡 API: ${endpoint}`);
  console.log(`📅 Date: 2025-10-10\n`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2025-10-10' })
    });

    const data = await response.json();
    
    console.log('✅ API Response Received\n');
    console.log('==========================================');
    console.log('RESULTS');
    console.log('==========================================');
    console.log(`Success: ${data.success}`);
    console.log(`Date: ${data.date}`);
    console.log(`Total Calls: ${data.totalCalls || 0}`);
    console.log(`Total Duration: ${data.totalDuration || 0}s`);
    console.log(`Providers Found: ${data.summary?.total || 0}`);
    
    if (data.reports && data.reports.length > 0) {
      console.log('\n==========================================');
      console.log('PROVIDER REPORTS');
      console.log('==========================================\n');
      
      data.reports.forEach((report, index) => {
        console.log(`${index + 1}. ${report.providerName}`);
        console.log(`   Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Call Count: ${report.callCount}`);
        console.log(`   Total Duration: ${report.totalDuration}s`);
        
        if (report.success) {
          console.log(`   PDF URL: ${report.pdfUrl || 'N/A'}`);
          console.log(`   Airtable Record: ${report.airtableRecordId || 'N/A'}`);
        } else {
          console.log(`   Error: ${report.error || 'Unknown'}`);
        }
        console.log('');
      });
    } else {
      console.log('\n⚠️  No reports generated');
      console.log('This means no call logs exist for October 10th, 2025 in Airtable');
    }

    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ TEST FAILED!');
    console.error('Error:', error.message);
  }
}

console.log('Testing October 10th, 2025...\n');
testOct10();

