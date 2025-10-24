/**
 * Test Report Generation for October 9th, 2025
 * This script will call the API to generate reports for all providers
 */

async function testReportGeneration() {
  const fetch = (await import('node-fetch')).default;
  console.log('==========================================');
  console.log('   DAILY REPORT TEST - OCTOBER 1, 2025');
  console.log('==========================================\n');

  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${API_URL}/api/reports/daily-call-summary`;

  console.log(`📡 Calling API: ${endpoint}`);
  console.log(`📅 Date: 2025-10-01\n`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: '2025-10-01'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    console.log('✅ API RESPONSE RECEIVED\n');
    console.log('==========================================');
    console.log('SUMMARY');
    console.log('==========================================');
    console.log(`Success: ${data.success}`);
    console.log(`Date: ${data.date}`);
    console.log(`Total Calls: ${data.totalCalls || 0}`);
    console.log(`Total Duration: ${data.totalDuration || 0}s`);
    console.log(`\nProviders: ${data.summary?.total || 0}`);
    console.log(`  - Successful: ${data.summary?.successful || 0}`);
    console.log(`  - Failed: ${data.summary?.failed || 0}`);
    console.log('');

    if (data.reports && data.reports.length > 0) {
      console.log('==========================================');
      console.log('PROVIDER REPORTS');
      console.log('==========================================\n');

      data.reports.forEach((report, index) => {
        console.log(`${index + 1}. ${report.providerName}`);
        console.log(`   Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Provider ID: ${report.providerId}`);
        console.log(`   Call Count: ${report.callCount}`);
        console.log(`   Total Duration: ${report.totalDuration}s`);
        
        if (report.success) {
          console.log(`   PDF URL: ${report.pdfUrl}`);
          if (report.airtableRecordId) {
            console.log(`   Airtable Record: ${report.airtableRecordId}`);
          }
        } else {
          console.log(`   Error: ${report.error || 'Unknown error'}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No reports generated');
      console.log('   This could mean:');
      console.log('   - No calls on October 9th');
      console.log('   - Date format issue');
      console.log('   - Airtable query issue\n');
    }

    console.log('==========================================');
    console.log('NEXT STEPS');
    console.log('==========================================');
    
    if (data.success && data.reports && data.reports.length > 0) {
      console.log('✅ Test Passed!\n');
      console.log('You can now:');
      console.log('1. Check the Reports table in Airtable');
      console.log('2. Verify PDFs are linked to providers');
      console.log('3. Download and view the PDFs');
      console.log('4. Verify the date field shows 2025-10-09');
      console.log('');
      console.log('To view in Airtable:');
      console.log('- Go to Reports table');
      console.log('- Filter by Date = October 9, 2025');
      console.log('- Check Provider links and PDF attachments');
    } else {
      console.log('⚠️  Test completed with no reports generated');
      console.log('');
      console.log('Troubleshooting:');
      console.log('1. Verify calls exist on October 9th in Call Logs table');
      console.log('2. Check the date format in Started At field');
      console.log('3. Ensure AWS credentials are configured');
      console.log('4. Review server logs for detailed errors');
    }

    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nDetails:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure the dev server is running: npm run dev');
    console.error('2. Check environment variables are set (.env.local)');
    console.error('3. Verify Airtable API key and base ID');
    console.error('4. Check AWS credentials (if uploading to S3)');
    process.exit(1);
  }
}

// Run the test
console.log('Starting report generation test...\n');
testReportGeneration();

