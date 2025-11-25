#!/usr/bin/env node

/**
 * Script to read and display Airtable structure for Providers, Employees, and Patients
 * This helps us understand all available fields before making modifications
 */

const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  console.error('Please run with: AIRTABLE_API_KEY=xxx AIRTABLE_BASE_ID=xxx node scripts/read-airtable-structure.js');
  process.exit(1);
}

/**
 * Make a request to Airtable API
 */
function makeAirtableRequest(tableName, maxRecords = 5) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?maxRecords=${maxRecords}`;
    
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (jsonData.error) {
            reject(new Error(`Airtable API error: ${jsonData.error.message}`));
            return;
          }
          
          resolve(jsonData);
        } catch (parseError) {
          reject(new Error(`Failed to parse Airtable response: ${parseError.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Display field information for a table
 */
function displayTableStructure(tableName, records) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TABLE: ${tableName}`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (!records || records.length === 0) {
    console.log('No records found in this table.\n');
    return;
  }
  
  // Collect all unique fields across all records
  const allFields = new Set();
  records.forEach(record => {
    Object.keys(record.fields).forEach(field => allFields.add(field));
  });
  
  console.log(`Total Records Fetched: ${records.length}`);
  console.log(`\nFIELDS FOUND (${allFields.size} total):`);
  console.log('-'.repeat(80));
  
  const sortedFields = Array.from(allFields).sort();
  sortedFields.forEach(field => {
    console.log(`  • ${field}`);
  });
  
  console.log('\n' + '-'.repeat(80));
  console.log('SAMPLE RECORDS:');
  console.log('-'.repeat(80));
  
  records.forEach((record, index) => {
    console.log(`\nRecord ${index + 1} (ID: ${record.id}):`);
    Object.entries(record.fields).forEach(([key, value]) => {
      let displayValue = value;
      
      // Format different value types
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object' && value[0].url) {
          // Attachment field
          displayValue = `[${value.length} attachment(s)]`;
        } else {
          // Linked records or multi-select
          displayValue = `[${value.length} item(s)]: ${JSON.stringify(value)}`;
        }
      } else if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value);
      } else if (typeof value === 'string' && value.length > 100) {
        displayValue = value.substring(0, 100) + '...';
      }
      
      console.log(`    ${key}: ${displayValue}`);
    });
  });
  
  console.log('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('AIRTABLE STRUCTURE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Base ID: ${AIRTABLE_BASE_ID}`);
  console.log(`Reading first 5 records from each table...`);
  
  const tables = ['Providers', 'Employees', 'Patients'];
  
  for (const tableName of tables) {
    try {
      console.log(`\nFetching ${tableName}...`);
      const response = await makeAirtableRequest(tableName, 5);
      displayTableStructure(tableName, response.records);
    } catch (error) {
      console.error(`\nError fetching ${tableName}:`, error.message);
    }
  }
  
  console.log('='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

