const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function listS3Reports() {
  console.log('==========================================');
  console.log('   S3 REPORTS FOLDER LISTING');
  console.log('==========================================\n');

  try {
    // Check S3 credentials
    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      throw new Error('S3 credentials not configured in .env.local');
    }

    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      throw new Error('S3_BUCKET not configured in .env.local');
    }

    console.log(`📂 Bucket: ${bucketName}`);
    console.log(`🌏 Region: ${process.env.S3_REGION || 'ap-southeast-2'}\n`);

    // Create S3 client
    const s3Client = new S3Client({
      region: process.env.S3_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    });

    // List objects in the reports folder
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'reports/', // List everything under reports/
      MaxKeys: 100
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      console.log('⚠️  No files found in reports/ folder\n');
      return;
    }

    console.log(`📄 Found ${response.Contents.length} file(s):\n`);
    console.log('==========================================');

    // Sort by last modified date (newest first)
    const sortedFiles = response.Contents.sort((a, b) => 
      (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
    );

    for (const file of sortedFiles) {
      console.log(`\n📋 File: ${file.Key}`);
      console.log(`   Size: ${(file.Size / 1024).toFixed(2)} KB`);
      console.log(`   Last Modified: ${file.LastModified?.toISOString()}`);
      
      // Public URL (if bucket allows public access)
      const publicUrl = `https://${bucketName}.s3.${process.env.S3_REGION || 'ap-southeast-2'}.amazonaws.com/${file.Key}`;
      console.log(`   Public URL: ${publicUrl}`);

      // Generate presigned URL (valid for 7 days)
      try {
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: file.Key
        });
        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 7 days
        console.log(`   Presigned URL (7 days): ${presignedUrl.substring(0, 100)}...`);
      } catch (error) {
        console.log(`   Presigned URL: Error generating - ${error.message}`);
      }

      // Get metadata
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: file.Key
        });
        const metadata = await s3Client.send(headCommand);
        
        if (metadata.Metadata && Object.keys(metadata.Metadata).length > 0) {
          console.log(`   Metadata:`);
          for (const [key, value] of Object.entries(metadata.Metadata)) {
            console.log(`     - ${key}: ${value}`);
          }
        }
      } catch (error) {
        console.log(`   Metadata: Could not retrieve`);
      }

      console.log('   ----------------------------------------');
    }

    console.log('\n==========================================');
    console.log('✅ Listing complete!');
    console.log('==========================================');

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

listS3Reports();

