/**
 * Test PDF Generation
 * Quick test to verify PDF generation works without hitting Airtable
 */

const { generateProviderReportHTML } = require('./src/services/reports/pdf-template.ts');
const { generatePdf, closeBrowser } = require('./src/services/reports/pdf-generator.ts');
const fs = require('fs');
const path = require('path');

// Sample provider data
const sampleProvider = {
  providerId: 'rec123',
  providerName: 'Bay Area Family Practice',
  providerLogo: null, // Can add a real URL here if testing logo
  callCount: 5,
  totalDuration: 850,
  avgDuration: 170,
  calls: [
    {
      id: '1',
      callSid: 'CA123',
      providerName: 'Bay Area Family Practice',
      employeeName: 'Dr. Sarah Johnson',
      patientName: 'John Smith',
      direction: 'Inbound',
      startedAt: '2025-10-14T09:30:00',
      endedAt: '2025-10-14T09:35:20',
      seconds: 320,
      detectedIntent: 'Appointment confirmation',
      notes: 'Patient confirmed appointment'
    },
    {
      id: '2',
      callSid: 'CA124',
      providerName: 'Bay Area Family Practice',
      employeeName: 'Dr. Michael Chen',
      patientName: 'Emily Davis',
      direction: 'Outbound',
      startedAt: '2025-10-14T10:15:00',
      endedAt: '2025-10-14T10:17:30',
      seconds: 150,
      detectedIntent: 'Follow-up call',
      notes: 'Medication reminder'
    },
    {
      id: '3',
      callSid: 'CA125',
      providerName: 'Bay Area Family Practice',
      employeeName: 'Nurse Linda Martinez',
      patientName: 'Robert Wilson',
      direction: 'Inbound',
      startedAt: '2025-10-14T14:20:00',
      endedAt: '2025-10-14T14:25:40',
      seconds: 340,
      detectedIntent: 'Prescription request',
      notes: null
    },
    {
      id: '4',
      callSid: 'CA126',
      providerName: 'Bay Area Family Practice',
      employeeName: 'Dr. Sarah Johnson',
      patientName: 'Mary Thompson',
      direction: 'Inbound',
      startedAt: '2025-10-14T16:45:00',
      endedAt: '2025-10-14T16:46:20',
      seconds: 80,
      detectedIntent: 'Billing inquiry',
      notes: 'Transferred to billing department'
    }
  ]
};

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation...\n');

  try {
    // Step 1: Generate HTML
    console.log('📝 Step 1: Generating HTML template...');
    const html = generateProviderReportHTML(sampleProvider, '2025-10-14');
    console.log('✅ HTML generated successfully');
    console.log(`   Length: ${html.length} characters\n`);

    // Optional: Save HTML for inspection
    const htmlPath = path.join(__dirname, 'test-output-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`💾 HTML saved to: ${htmlPath}\n`);

    // Step 2: Generate PDF
    console.log('🎨 Step 2: Converting HTML to PDF...');
    const pdfResult = await generatePdf({
      html,
      fileName: 'test-report.pdf'
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }

    console.log('✅ PDF generated successfully');
    console.log(`   Size: ${Math.round(pdfResult.size / 1024)} KB\n`);

    // Step 3: Save PDF
    const pdfPath = path.join(__dirname, 'test-output-report.pdf');
    fs.writeFileSync(pdfPath, pdfResult.pdfBuffer);
    console.log(`💾 PDF saved to: ${pdfPath}\n`);

    // Cleanup
    await closeBrowser();

    console.log('✅ TEST PASSED!');
    console.log('\nYou can now:');
    console.log('1. Open test-output-report.html in a browser to see the HTML');
    console.log('2. Open test-output-report.pdf to see the final PDF');
    console.log('3. Verify the formatting and styling are correct');

  } catch (error) {
    console.error('❌ TEST FAILED!');
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    
    // Try to cleanup even on error
    try {
      await closeBrowser();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run the test
console.log('==========================================');
console.log('   PDF GENERATION TEST');
console.log('==========================================\n');

testPdfGeneration();

