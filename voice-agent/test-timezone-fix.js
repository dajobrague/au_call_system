/**
 * Timezone Fix Verification Test
 * Tests that wave intervals are calculated correctly with Australian timezone
 */

// Register ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  }
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function testTimezoneHandling() {
  console.log('==================================================');
  console.log('  TIMEZONE FIX VERIFICATION');
  console.log('==================================================\n');

  const { calculateWaveInterval } = require('./src/services/sms/wave-interval-calculator');

  // Test scenario: Shift scheduled for Sept 15, 2025 at 14:00 (2:00 PM) Sydney time
  const testDate = '2025-09-15';
  const testTime = '14:00';
  const timezone = 'Australia/Sydney';

  console.log('📅 Test Scenario:');
  console.log(`   Date: ${testDate}`);
  console.log(`   Time: ${testTime}`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   Full: ${testDate} ${testTime} ${timezone}\n`);

  // Calculate current time
  const now = new Date();
  console.log('🕐 Current Time:');
  console.log(`   UTC: ${now.toISOString()}`);
  console.log(`   Sydney: ${now.toLocaleString('en-AU', { timeZone: timezone })}`);
  console.log('');

  // Create a test shift time (2 hours from now in Sydney time)
  const nowSydney = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const shiftTimeSydney = new Date(nowSydney.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  
  const testDateFormatted = shiftTimeSydney.toISOString().split('T')[0]; // YYYY-MM-DD
  const testTimeFormatted = shiftTimeSydney.toTimeString().substring(0, 5); // HH:MM

  console.log('🎯 Creating test shift 2 hours from now:');
  console.log(`   Date: ${testDateFormatted}`);
  console.log(`   Time: ${testTimeFormatted}`);
  console.log(`   Full Sydney time: ${shiftTimeSydney.toLocaleString('en-AU', { timeZone: timezone })}\n`);

  // Test WITH timezone handling (NEW)
  console.log('✅ NEW: With Timezone Handling');
  console.log('═══════════════════════════════');
  try {
    const intervalWithTZ = calculateWaveInterval(testDateFormatted, testTimeFormatted, timezone);
    const intervalMinutes = Math.round(intervalWithTZ / 60000);
    
    console.log(`   Interval calculated: ${intervalMinutes} minutes`);
    console.log(`   Expected: 10 minutes (shift in ~2 hours)`);
    console.log(`   Wave 2 in: ${intervalMinutes} minutes`);
    console.log(`   Wave 3 in: ${intervalMinutes * 2} minutes`);
    
    if (intervalMinutes === 10) {
      console.log('   ✅ CORRECT! Interval matches expected value.\n');
    } else {
      console.log(`   ⚠️  WARNING: Expected 10 minutes, got ${intervalMinutes} minutes.\n`);
    }
  } catch (error) {
    console.error('   ❌ ERROR:', error.message, '\n');
  }

  // Test WITHOUT time (OLD way - should show warning)
  console.log('⚠️  OLD: Without Time (Date Only - WRONG)');
  console.log('═══════════════════════════════════════════');
  try {
    const intervalWithoutTime = calculateWaveInterval(testDateFormatted);
    const intervalMinutes = Math.round(intervalWithoutTime / 60000);
    
    console.log(`   Interval calculated: ${intervalMinutes} minutes`);
    console.log(`   This is WRONG because it uses midnight UTC`);
    console.log(`   ❌ NOT timezone-aware!\n`);
  } catch (error) {
    console.error('   ❌ ERROR:', error.message, '\n');
  }

  // Test various shift times
  console.log('==================================================');
  console.log('  INTERVAL TESTING: Various Shift Times');
  console.log('==================================================\n');

  const testCases = [
    { label: '1.5 hours from now', hours: 1.5, expectedInterval: 10 },
    { label: '3 hours from now', hours: 3, expectedInterval: 15 },
    { label: '4 hours from now', hours: 4, expectedInterval: 20 },
    { label: '5 hours from now', hours: 5, expectedInterval: 25 },
    { label: '8 hours from now', hours: 8, expectedInterval: 30 },
    { label: '24 hours from now', hours: 24, expectedInterval: 30 },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    const futureTime = new Date(nowSydney.getTime() + testCase.hours * 60 * 60 * 1000);
    const futureDate = futureTime.toISOString().split('T')[0];
    const futureTimeStr = futureTime.toTimeString().substring(0, 5);

    const interval = calculateWaveInterval(futureDate, futureTimeStr, timezone);
    const intervalMinutes = Math.round(interval / 60000);

    const status = intervalMinutes === testCase.expectedInterval ? '✅' : '❌';
    console.log(`${status} ${testCase.label}:`);
    console.log(`   Expected: ${testCase.expectedInterval} min, Got: ${intervalMinutes} min`);

    if (intervalMinutes !== testCase.expectedInterval) {
      allPassed = false;
    }
  }

  console.log('\n==================================================');
  console.log('  SUMMARY');
  console.log('==================================================\n');

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Timezone handling is CORRECT');
    console.log('✅ Wave intervals calculated accurately');
    console.log('\nThe system will now:');
    console.log('1. Parse shift date + time in Australia/Sydney timezone');
    console.log('2. Convert to UTC for accurate comparison');
    console.log('3. Calculate hours until shift correctly');
    console.log('4. Apply correct interval rules\n');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('Please review the interval calculator logic.\n');
    process.exit(1);
  }
}

// Run test
testTimezoneHandling().catch(error => {
  console.error('\n❌ Test error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});
