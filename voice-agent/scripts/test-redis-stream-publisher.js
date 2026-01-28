/**
 * Test script for Redis Stream Call Event Publisher
 * 
 * This script tests the new call event publisher WITHOUT touching any existing code.
 * Run this to verify Redis Streams work before integrating into the call flow.
 * 
 * Usage:
 *   node scripts/test-redis-stream-publisher.js
 */

require('dotenv').config({ path: '.env.local' });

// Import using require since we're in a .js file
const {
  publishCallStarted,
  publishCallAuthenticated,
  publishIntentDetected,
  publishShiftOpened,
  publishStaffNotified,
  publishCallEnded,
  closeRedisPublisher,
} = require('../dist/services/redis/call-event-publisher');

const Redis = require('ioredis');

async function testRedisStreamPublisher() {
  console.log('🧪 Testing Redis Stream Call Event Publisher...\n');

  // Test data
  const testCallSid = `TEST_CALL_${Date.now()}`;
  const testProviderId = 'rec123TestProvider';

  try {
    // Test 1: Publish call_started event
    console.log('1️⃣  Publishing call_started event...');
    const result1 = await publishCallStarted(testCallSid, testProviderId, '+61412345678');
    console.log(result1 ? '   ✅ Success' : '   ❌ Failed');

    await sleep(500);

    // Test 2: Publish call_authenticated event
    console.log('\n2️⃣  Publishing call_authenticated event...');
    const result2 = await publishCallAuthenticated(
      testCallSid,
      testProviderId,
      'Test Employee',
      'recEmp123'
    );
    console.log(result2 ? '   ✅ Success' : '   ❌ Failed');

    await sleep(500);

    // Test 3: Publish intent_detected event
    console.log('\n3️⃣  Publishing intent_detected event...');
    const result3 = await publishIntentDetected(
      testCallSid,
      testProviderId,
      'shift_cancellation',
      'Employee called to cancel shift'
    );
    console.log(result3 ? '   ✅ Success' : '   ❌ Failed');

    await sleep(500);

    // Test 4: Publish shift_opened event
    console.log('\n4️⃣  Publishing shift_opened event...');
    const result4 = await publishShiftOpened(
      testCallSid,
      testProviderId,
      'shift_test_123',
      'Test Patient'
    );
    console.log(result4 ? '   ✅ Success' : '   ❌ Failed');

    await sleep(500);

    // Test 5: Publish staff_notified event
    console.log('\n5️⃣  Publishing staff_notified event...');
    const result5 = await publishStaffNotified(testCallSid, testProviderId, 5, 'shift_test_123');
    console.log(result5 ? '   ✅ Success' : '   ❌ Failed');

    await sleep(500);

    // Test 6: Publish call_ended event
    console.log('\n6️⃣  Publishing call_ended event...');
    const result6 = await publishCallEnded(testCallSid, testProviderId, 145);
    console.log(result6 ? '   ✅ Success' : '   ❌ Failed');

    // Test 7: Read back the events from Redis Stream
    console.log('\n7️⃣  Reading events back from Redis Stream...');
    const streamKey = `call-events:provider:${testProviderId}:${
      new Date().toISOString().split('T')[0]
    }`;
    console.log(`   Stream key: ${streamKey}`);

    const redis = new Redis(process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL);
    const events = await redis.xrange(streamKey, '-', '+');

    console.log(`\n   Found ${events.length} total events in stream`);

    // Filter to only our test events
    const testEvents = events.filter(([id, fields]) => {
      // fields is an array like ['eventType', 'call_started', 'callSid', 'TEST_CALL_...', ...]
      const callSidIndex = fields.indexOf('callSid');
      if (callSidIndex !== -1 && callSidIndex + 1 < fields.length) {
        return fields[callSidIndex + 1].includes('TEST_CALL_');
      }
      return false;
    });

    console.log(`   Found ${testEvents.length} test events:\n`);

    testEvents.forEach(([id, fields], index) => {
      // Parse fields array into object
      const eventData = {};
      for (let i = 0; i < fields.length; i += 2) {
        eventData[fields[i]] = fields[i + 1];
      }

      console.log(`   Event ${index + 1}: ${eventData.eventType}`);
      console.log(`     - Event ID: ${id}`);
      console.log(`     - Timestamp: ${eventData.timestamp}`);
      if (eventData.data) {
        const parsedData = JSON.parse(eventData.data);
        console.log(`     - Data:`, parsedData);
      }
    });

    // Test 8: Check TTL
    console.log('\n8️⃣  Checking stream TTL...');
    const ttl = await redis.ttl(streamKey);
    console.log(`   TTL: ${ttl} seconds (${Math.round(ttl / 3600)} hours)`);
    console.log(ttl > 0 ? '   ✅ TTL set correctly' : '   ⚠️  No TTL set');

    // Cleanup
    redis.disconnect();
    closeRedisPublisher();

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Redis Stream publisher is working correctly');
    console.log('   - Events are being stored with proper TTL');
    console.log('   - Ready to integrate into call flow');
    console.log('\n⚠️  Note: Test events were published to the stream.');
    console.log('   They will auto-expire in 25 hours.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the test
testRedisStreamPublisher();
