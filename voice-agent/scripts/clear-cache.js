#!/usr/bin/env node

/**
 * Clear Cache Script
 * Clears all Redis caches to ensure fresh data
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
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

async function clearAllCaches() {
  try {
    console.log('🧹 Clearing all Redis caches...\n');

    // Import Redis client
    const { Redis } = await import('@upstash/redis');
    
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Clear all call state caches
    console.log('1. Clearing call state caches...');
    const callKeys = await redis.keys('call:*');
    if (callKeys.length > 0) {
      await redis.del(...callKeys);
      console.log(`   ✅ Cleared ${callKeys.length} call state keys`);
    } else {
      console.log('   ℹ️  No call state keys found');
    }

    // Clear all Airtable caches
    console.log('\n2. Clearing Airtable caches...');
    const airtableKeys = await redis.keys('airtable:*');
    if (airtableKeys.length > 0) {
      await redis.del(...airtableKeys);
      console.log(`   ✅ Cleared ${airtableKeys.length} Airtable cache keys`);
    } else {
      console.log('   ℹ️  No Airtable cache keys found');
    }

    // Clear any other caches
    console.log('\n3. Clearing all other caches...');
    const allKeys = await redis.keys('*');
    console.log(`   📊 Total keys in Redis: ${allKeys.length}`);
    
    if (allKeys.length > 0) {
      console.log('   Keys found:');
      allKeys.forEach(key => console.log(`     - ${key}`));
      
      await redis.del(...allKeys);
      console.log(`   ✅ Cleared all ${allKeys.length} keys`);
    }

    console.log('\n🎉 All caches cleared successfully!');
    console.log('\nNext call will use fresh data from Airtable.');

  } catch (error) {
    console.error('❌ Error clearing caches:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

clearAllCaches();
