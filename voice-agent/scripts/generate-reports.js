#!/usr/bin/env node

/**
 * Daily Call Summary Report Generator - CLI Tool
 * 
 * Usage:
 *   node scripts/generate-reports.js                              # Yesterday, all providers
 *   node scripts/generate-reports.js --date 2026-01-05           # Specific date, all providers
 *   node scripts/generate-reports.js --provider rec123456        # Yesterday, specific provider
 *   node scripts/generate-reports.js --date 2026-01-05 --provider rec123456
 */

const https = require('https');
const http = require('http');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    date: null,
    providerId: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && i + 1 < args.length) {
      options.date = args[i + 1];
      i++;
    } else if (args[i] === '--provider' && i + 1 < args.length) {
      options.providerId = args[i + 1];
      i++;
    }
  }

  return options;
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format duration in minutes
function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

// Make HTTP/HTTPS request
function makeRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Main function
async function main() {
  console.log('================================================');
  console.log('📊 Daily Call Summary Report Generator');
  console.log('================================================');
  console.log('Time:', new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
  console.log('');

  try {
    // Parse arguments
    const options = parseArgs();

    // Determine the API endpoint URL
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';
    
    const apiUrl = `${baseUrl}/api/reports/daily-call-summary`;

    console.log('Endpoint:', apiUrl);
    
    if (options.date) {
      console.log('Date:', formatDate(options.date), `(${options.date})`);
    } else {
      console.log('Date: Yesterday (default)');
    }
    
    if (options.providerId) {
      console.log('Provider:', options.providerId, '(single provider)');
    } else {
      console.log('Scope: All providers');
    }
    console.log('');

    // Build request body
    const requestBody = {};
    if (options.date) {
      requestBody.date = options.date;
    }
    if (options.providerId) {
      requestBody.providerId = options.providerId;
    }

    const postData = JSON.stringify(requestBody);

    // Make request
    console.log('Generating reports...');
    console.log('');

    const response = await makeRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    // Parse response
    let data;
    try {
      data = JSON.parse(response.data);
    } catch (parseError) {
      console.error('❌ Failed to parse response');
      console.error('Response:', response.data.substring(0, 500));
      process.exit(1);
    }

    // Handle response
    if (response.statusCode !== 200) {
      console.error(`❌ HTTP ${response.statusCode} Error`);
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    if (data.success) {
      console.log('✅ REPORTS GENERATED SUCCESSFULLY');
      console.log('================================================');
      console.log('Date:', data.date);
      console.log('Total Calls:', data.totalCalls);
      console.log('Total Duration:', formatDuration(data.totalDuration));
      console.log('');

      if (data.reports && data.reports.length > 0) {
        console.log('📋 Provider Reports:');
        console.log('------------------------------------------------');
        
        data.reports.forEach((report, index) => {
          const statusIcon = report.success ? '✅' : '❌';
          console.log(`\n${index + 1}. ${statusIcon} ${report.providerName}`);
          console.log(`   Calls: ${report.callCount}`);
          console.log(`   Duration: ${formatDuration(report.totalDuration)}`);
          
          if (report.success) {
            console.log('   Status: PDF uploaded to S3 ✓');
            if (report.airtableRecordId) {
              console.log('   Record:', report.airtableRecordId);
            }
          } else {
            console.log('   Error:', report.error || 'Unknown error');
          }
        });

        console.log('\n================================================');
        console.log('📊 SUMMARY:');
        console.log('Total Providers:', data.summary.total);
        console.log('Successful:', data.summary.successful);
        console.log('Failed:', data.summary.failed);
        console.log('================================================');
      } else {
        console.log('⚠️  No reports generated (no providers with calls)');
      }

      process.exit(0);

    } else {
      console.log('❌ REPORT GENERATION FAILED');
      console.log('Error:', data.error || 'Unknown error');
      console.log('Date:', data.date || 'Unknown');
      console.log('');
      console.log('💡 This may mean no call logs were found for this date.');
      console.log('   Check your Airtable Call Logs table to verify.');
      
      process.exit(1);
    }

  } catch (error) {
    console.log('');
    console.log('❌ SCRIPT ERROR');
    console.log('================================================');
    console.log('Error:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('- Is the server running?');
    console.log('- Check RAILWAY_PUBLIC_DOMAIN environment variable');
    console.log('- Verify date format is YYYY-MM-DD');
    console.log('- Check Railway/server logs for more details');
    console.log('================================================');
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run main function
main();

