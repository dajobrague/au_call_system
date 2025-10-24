/**
 * Test S3 PDF Upload
 * Tests generating a PDF and uploading it to S3
 */

const puppeteer = require('puppeteer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testS3Upload() {
  console.log('\n==========================================');
  console.log('   S3 PDF UPLOAD TEST');
  console.log('==========================================\n');

  try {
    // Step 1: Generate a test PDF
    console.log('📄 Step 1: Generating test PDF...');
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>S3 Upload Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #0056b3; }
        </style>
      </head>
      <body>
        <h1>S3 Upload Test PDF</h1>
        <p>This is a test PDF generated on ${new Date().toLocaleString()}</p>
        <p>If you can see this, the PDF generation and S3 upload worked!</p>
      </body>
      </html>
    `;
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    
    await browser.close();
    
    console.log(`✅ PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // Step 2: Upload to S3
    console.log('☁️  Step 2: Uploading to S3...');
    console.log(`   Region: ${process.env.S3_REGION || 'not set'}`);
    console.log(`   Bucket: ${process.env.S3_BUCKET || 'not set'}`);
    
    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      throw new Error('S3 credentials not configured in .env.local');
    }
    
    if (!process.env.S3_BUCKET) {
      throw new Error('S3_BUCKET not configured in .env.local');
    }
    
    const s3Client = new S3Client({
      region: process.env.S3_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `reports/tests/test-pdf-${timestamp}.pdf`;
    
    const bucketName = process.env.S3_BUCKET;
    console.log(`   Using bucket: "${bucketName}"`);
    console.log(`   Uploading to key: ${key}\n`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256', // SSE-S3
      Metadata: {
        'test': 'true',
        'generated-at': new Date().toISOString()
      }
    });
    
    await s3Client.send(command);
    
    const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'ap-southeast-2'}.amazonaws.com/${key}`;
    
    console.log(`✅ Upload successful!\n`);
    console.log('==========================================');
    console.log('📍 S3 URL:');
    console.log(`   ${s3Url}`);
    console.log('==========================================\n');
    
    console.log('✅ TEST PASSED! S3 upload is working correctly.\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   ${error.message}\n`);
    
    if (error.name === 'CredentialsProviderError') {
      console.error('💡 Tip: Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env.local\n');
    } else if (error.name === 'NoSuchBucket') {
      console.error('💡 Tip: The S3 bucket does not exist. Check AWS_S3_BUCKET in .env.local\n');
    } else if (error.name === 'AccessDenied') {
      console.error('💡 Tip: AWS credentials do not have permission to upload to the bucket\n');
    }
    
    console.error('Full error:', error);
    process.exit(1);
  }
}

testS3Upload();
