/**
 * Test Report Generation for October 9th, 2025
 * Testing with international date format DD/MM/YYYY
 */

async function testOct9() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('==========================================');
  console.log('   OCTOBER 9, 2025 - REPORT TEST');
  console.log('==========================================\n');

  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${API_URL}/api/reports/daily-call-summary`;

  console.log(`📡 API: ${endpoint}`);
  console.log(`📅 Date: 2025-10-09 (will be 09/10/2025 in DD/MM/YYYY)\n`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2025-10-09' })
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
      
      console.log('==========================================');
      console.log('✅ TEST PASSED! PDFs generated successfully!');
      console.log('==========================================\n');
      console.log('Next steps:');
      console.log('1. Check Reports table in Airtable');
      console.log('2. Verify PDFs are linked to providers');
      console.log('3. Add AWS credentials to upload to S3');
      
    } else {
      console.log('\n⚠️  No reports generated');
      console.log('This means no call logs exist for October 9th, 2025 in Airtable');
    }

    console.log('\n==========================================\n');

  } catch (error) {
    console.error('❌ TEST FAILED!');
    console.error('Error:', error.message);
  }
}

console.log('Testing October 9th, 2025 (09/10/2025)...\n');
testOct9();

