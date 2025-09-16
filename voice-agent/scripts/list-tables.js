#!/usr/bin/env node

/**
 * List Airtable Tables Script
 * Lists all tables in the Airtable base to help identify correct table names
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Read environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

console.log('🔍 Airtable Base Table Listing...\n');

// Validate credentials
if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID environment variable is required');
  process.exit(1);
}

console.log(`📊 Base ID: ${AIRTABLE_BASE_ID}`);
console.log(`🔑 API Key: ${AIRTABLE_API_KEY.substring(0, 8)}...`);
console.log('');

/**
 * Make Airtable Meta API request to get base schema
 */
function getBaseSchema() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Try to list records from a specific table
 */
function testTableAccess(tableName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?maxRecords=1`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ tableName, success: !jsonData.error, data: jsonData });
        } catch (error) {
          resolve({ tableName, success: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ tableName, success: false, error: error.message });
    });

    req.end();
  });
}

/**
 * Main function
 */
async function listTables() {
  try {
    console.log('📡 Fetching base schema...\n');
    
    // Try to get base schema first
    const schema = await getBaseSchema();
    
    if (schema.error) {
      console.log('⚠️  Could not fetch base schema via Meta API');
      console.log(`Error: ${schema.error.message || JSON.stringify(schema.error)}`);
      console.log('\n🔍 Trying common table names instead...\n');
      
      // Try common table names
      const commonNames = [
        'Jobs', 'jobs', 'Job', 'job',
        'Tasks', 'tasks', 'Task', 'task',
        'Assignments', 'assignments', 'Assignment', 'assignment',
        'Projects', 'projects', 'Project', 'project',
        'Clients', 'clients', 'Client', 'client',
        'Workers', 'workers', 'Worker', 'worker',
        'Table 1', 'Table1', 'Main', 'Data'
      ];
      
      console.log('Testing common table names:');
      for (const tableName of commonNames) {
        const result = await testTableAccess(tableName);
        if (result.success) {
          console.log(`✅ "${tableName}" - Accessible (${result.data.records?.length || 0} records found)`);
        } else {
          console.log(`❌ "${tableName}" - ${result.error || result.data?.error?.message || 'Not accessible'}`);
        }
      }
      
    } else {
      console.log('✅ Base schema retrieved successfully!\n');
      console.log('📋 Available Tables:');
      console.log('='.repeat(50));
      
      if (schema.tables && schema.tables.length > 0) {
        schema.tables.forEach((table, index) => {
          console.log(`\n${index + 1}. ${table.name} (ID: ${table.id})`);
          console.log(`   Description: ${table.description || 'No description'}`);
          
          if (table.fields && table.fields.length > 0) {
            console.log(`   Fields (${table.fields.length}):`);
            table.fields.slice(0, 5).forEach(field => {
              console.log(`     - ${field.name} (${field.type})`);
            });
            if (table.fields.length > 5) {
              console.log(`     ... and ${table.fields.length - 5} more fields`);
            }
          }
        });
        
        console.log('\n🎯 RECOMMENDED TABLE NAMES FOR INTEGRATION:');
        console.log('='.repeat(50));
        schema.tables.forEach(table => {
          console.log(`"${table.name}"`);
        });
        
      } else {
        console.log('No tables found in the base.');
      }
    }
    
    console.log('\n✅ Table listing complete!');
    
  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
    process.exit(1);
  }
}

// Run the listing
listTables();
