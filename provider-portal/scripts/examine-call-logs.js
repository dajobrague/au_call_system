#!/usr/bin/env node

/**
 * Script to examine Call Logs and Reports tables in Airtable
 * This helps understand the data structure for Daily Reports feature
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';
const REPORTS_TABLE_ID = 'tblglgaQInesliTlR';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  console.error('Please run with environment variables set');
  process.exit(1);
}

/**
 * Make a request to Airtable API
 */
function makeAirtableRequest(tableId, maxRecords = 5) {
  return new Promise((resolve, reject) => {
    const path = `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableId)}?maxRecords=${maxRecords}`;
    
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
 * Display table structure
 */
function displayTableStructure(tableName, tableId, records) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`TABLE: ${tableName} (${tableId})`);
  console.log(`${'='.repeat(100)}\n`);
  
  if (!records || records.length === 0) {
    console.log('No records found in this table.\n');
    return;
  }
  
  // Collect all unique fields
  const allFields = new Set();
  records.forEach(record => {
    Object.keys(record.fields).forEach(field => allFields.add(field));
  });
  
  console.log(`Total Records Fetched: ${records.length}`);
  console.log(`\nFIELDS (${allFields.size} total):`);
  console.log('-'.repeat(100));
  
  const sortedFields = Array.from(allFields).sort();
  sortedFields.forEach((field, index) => {
    console.log(`  ${(index + 1).toString().padStart(2, ' ')}. ${field}`);
  });
  
  console.log('\n' + '-'.repeat(100));
  console.log('SAMPLE RECORDS:');
  console.log('-'.repeat(100));
  
  records.forEach((record, index) => {
    console.log(`\n[Record ${index + 1}] ID: ${record.id}`);
    console.log('─'.repeat(80));
    
    Object.entries(record.fields).forEach(([key, value]) => {
      let displayValue = value;
      
      // Format different value types
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object' && value[0].url) {
          displayValue = `[${value.length} attachment(s)]`;
        } else {
          displayValue = `[${value.length} item(s)]: ${JSON.stringify(value)}`;
        }
      } else if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value);
      } else if (typeof value === 'string' && value.length > 150) {
        displayValue = value.substring(0, 150) + '...';
      }
      
      console.log(`  ${key.padEnd(30, ' ')}: ${displayValue}`);
    });
  });
  
  console.log('\n');
}

/**
 * Get counts and stats
 */
async function getTableStats(tableId, tableName) {
  try {
    const response = await makeAirtableRequest(tableId, 100);
    
    console.log(`\n${'='.repeat(100)}`);
    console.log(`${tableName} - Statistics (first 100 records)`);
    console.log(`${'='.repeat(100)}`);
    
    if (response.records.length === 0) {
      console.log('No records found.\n');
      return;
    }
    
    // Analyze fields
    const fieldCounts = {};
    const fieldTypes = {};
    
    response.records.forEach(record => {
      Object.entries(record.fields).forEach(([key, value]) => {
        if (!fieldCounts[key]) {
          fieldCounts[key] = 0;
          fieldTypes[key] = new Set();
        }
        fieldCounts[key]++;
        
        if (Array.isArray(value)) {
          fieldTypes[key].add('array');
        } else {
          fieldTypes[key].add(typeof value);
        }
      });
    });
    
    console.log(`\nTotal Records Examined: ${response.records.length}`);
    console.log(`\nField Usage Analysis:`);
    console.log('-'.repeat(100));
    
    Object.entries(fieldCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        const percentage = ((count / response.records.length) * 100).toFixed(1);
        const types = Array.from(fieldTypes[field]).join(', ');
        console.log(`  ${field.padEnd(40, ' ')} : ${count}/${response.records.length} (${percentage}%) | Type: ${types}`);
      });
    
    console.log('\n');
    
  } catch (error) {
    console.error(`Error analyzing ${tableName}:`, error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('AIRTABLE CALL LOGS & REPORTS ANALYSIS');
  console.log('='.repeat(100));
  console.log(`Base ID: ${AIRTABLE_BASE_ID}`);
  console.log('This script examines the Call Logs and Reports tables for Daily Reports feature planning\n');
  
  // Examine Call Logs table
  try {
    console.log('Fetching Call Logs table...');
    const callLogsResponse = await makeAirtableRequest(CALL_LOGS_TABLE_ID, 5);
    displayTableStructure('Call Logs', CALL_LOGS_TABLE_ID, callLogsResponse.records);
    await getTableStats(CALL_LOGS_TABLE_ID, 'Call Logs');
  } catch (error) {
    console.error('\nError fetching Call Logs:', error.message);
  }
  
  // Examine Reports table
  try {
    console.log('\nFetching Reports table...');
    const reportsResponse = await makeAirtableRequest(REPORTS_TABLE_ID, 5);
    displayTableStructure('Reports', REPORTS_TABLE_ID, reportsResponse.records);
    await getTableStats(REPORTS_TABLE_ID, 'Reports');
  } catch (error) {
    console.error('\nError fetching Reports:', error.message);
  }
  
  console.log('='.repeat(100));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(100));
  console.log('\nKey Findings to Consider for Daily Reports Feature:');
  console.log('  1. What fields from Call Logs are most relevant for daily summaries?');
  console.log('  2. What relationship exists between Call Logs and Reports tables?');
  console.log('  3. How is the "recordId (from Provider)" field used for filtering?');
  console.log('  4. What additional report types might be useful beyond daily summaries?');
  console.log('\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

