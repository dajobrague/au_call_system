/**
 * Inspect Redis Stream - Check what's actually stored
 */

require('dotenv').config({ path: '.env.local' });
const Redis = require('ioredis');

async function inspectRedisStream() {
  console.log('🔍 Inspecting Redis Streams...\n');

  const redis = new Redis(process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL);

  try {
    // Get all keys matching our pattern
    const keys = await redis.keys('call-events:*');
    
    console.log(`Found ${keys.length} stream key(s):\n`);
    
    for (const key of keys) {
      console.log(`📋 Key: ${key}`);
      
      // Check the type
      const type = await redis.type(key);
      console.log(`   Type: ${type}`);
      
      // Get TTL
      const ttl = await redis.ttl(key);
      console.log(`   TTL: ${ttl} seconds (${Math.round(ttl / 3600)} hours)`);
      
      // Get stream info
      try {
        const info = await redis.xinfo('STREAM', key);
        console.log(`   Stream info:`, info);
      } catch (e) {
        console.log(`   ⚠️  Could not get stream info:`, e.message);
      }
      
      // Get entries count
      try {
        const length = await redis.xlen(key);
        console.log(`   Entries: ${length}`);
      } catch (e) {
        console.log(`   ⚠️  Could not get length:`, e.message);
      }
      
      // Try to read entries
      try {
        const entries = await redis.xrange(key, '-', '+', 'COUNT', 5);
        console.log(`\n   Sample entries (first 5):`);
        entries.forEach(([id, fields]) => {
          const data = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          console.log(`     ${id}:`, data);
        });
      } catch (e) {
        console.log(`   ⚠️  Could not read entries:`, e.message);
      }
      
      console.log('\n' + '-'.repeat(80) + '\n');
    }
    
    // If no keys found
    if (keys.length === 0) {
      console.log('ℹ️  No call-events streams found in Redis.');
      console.log('   This is normal if no calls have been made yet or streams have expired.');
    }
    
    redis.disconnect();
  } catch (error) {
    console.error('❌ Error inspecting Redis:', error);
    redis.disconnect();
    process.exit(1);
  }
}

inspectRedisStream();
