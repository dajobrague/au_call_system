#!/usr/bin/env node

/**
 * Analyze Railway Airtable Connection Test Results
 * 
 * Usage: node analyze-railway-test.js <json-file>
 */

const fs = require('fs');
const path = require('path');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function analyze(filePath) {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Railway Airtable Test Analysis${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  // Read file
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!Array.isArray(data) || data.length === 0) {
    console.error(`${colors.red}Error: Invalid or empty data file${colors.reset}`);
    process.exit(1);
  }

  const totalTests = data.length;
  
  // Basic statistics
  const successful = data.filter(d => d.success).length;
  const failed = totalTests - successful;
  const successRate = ((successful / totalTests) * 100).toFixed(2);
  
  console.log(`${colors.cyan}Basic Statistics:${colors.reset}`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ${colors.green}Successful: ${successful}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`  Success Rate: ${successRate}%\n`);

  // Duration statistics
  const durations = data.map(d => d.totalDuration).filter(d => d > 0);
  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0);
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    console.log(`${colors.cyan}Duration Statistics (ms):${colors.reset}`);
    console.log(`  Min: ${minDuration}`);
    console.log(`  Max: ${maxDuration}`);
    console.log(`  Avg: ${avgDuration}`);
    console.log(`  P50: ${p50}`);
    console.log(`  P95: ${p95}`);
    console.log(`  P99: ${p99}\n`);
  }

  // Step analysis
  console.log(`${colors.cyan}Step Success Rates:${colors.reset}`);
  const stepNames = new Set();
  data.forEach(d => {
    if (d.steps && Array.isArray(d.steps)) {
      d.steps.forEach(s => stepNames.add(s.step));
    }
  });

  Array.from(stepNames).forEach(stepName => {
    const stepResults = [];
    data.forEach(d => {
      if (d.steps) {
        const step = d.steps.find(s => s.step === stepName);
        if (step) stepResults.push(step);
      }
    });

    const stepSuccess = stepResults.filter(s => s.success).length;
    const stepRate = ((stepSuccess / stepResults.length) * 100).toFixed(1);
    const avgStepDuration = (stepResults.reduce((sum, s) => sum + s.duration, 0) / stepResults.length).toFixed(0);
    
    const statusColor = stepRate >= 95 ? colors.green : stepRate >= 80 ? colors.yellow : colors.red;
    console.log(`  ${stepName}: ${statusColor}${stepRate}%${colors.reset} (${stepSuccess}/${stepResults.length}) - avg ${avgStepDuration}ms`);
  });
  console.log('');

  // Error analysis
  const failedTests = data.filter(d => !d.success);
  if (failedTests.length > 0) {
    console.log(`${colors.cyan}Error Analysis:${colors.reset}`);
    
    const errorTypes = {};
    failedTests.forEach(test => {
      if (test.errorDetails) {
        const key = test.errorDetails.code || test.errorDetails.message || 'Unknown';
        errorTypes[key] = (errorTypes[key] || 0) + 1;
      }
      
      if (test.steps) {
        test.steps.forEach(step => {
          if (!step.success && step.error) {
            const key = step.error;
            errorTypes[key] = (errorTypes[key] || 0) + 1;
          }
        });
      }
    });

    Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        const percentage = ((count / failed) * 100).toFixed(1);
        console.log(`  ${colors.red}${error}${colors.reset}: ${count} times (${percentage}%)`);
      });
    console.log('');
  }

  // Railway metadata
  const firstTest = data[0];
  if (firstTest && firstTest.railwayMetadata) {
    console.log(`${colors.cyan}Railway Environment:${colors.reset}`);
    console.log(`  Region: ${firstTest.railwayMetadata.region}`);
    console.log(`  Environment: ${firstTest.railwayMetadata.environment}`);
    console.log(`  Service ID: ${firstTest.railwayMetadata.serviceId}`);
    console.log(`  Instance ID: ${firstTest.railwayMetadata.instanceId}\n`);
  }

  // Failure pattern analysis
  if (failed > 0) {
    console.log(`${colors.cyan}Failure Pattern:${colors.reset}`);
    let consecutiveFailures = 0;
    let maxConsecutiveFailures = 0;
    let currentStreak = 0;

    data.forEach((test, idx) => {
      if (!test.success) {
        currentStreak++;
        maxConsecutiveFailures = Math.max(maxConsecutiveFailures, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    const failureIndices = data.map((t, i) => t.success ? -1 : i).filter(i => i >= 0);
    const isRandom = maxConsecutiveFailures <= 2;
    const isBursty = maxConsecutiveFailures > 5;

    console.log(`  Max consecutive failures: ${maxConsecutiveFailures}`);
    console.log(`  Pattern: ${isBursty ? colors.red + 'Bursty' : isRandom ? colors.green + 'Random' : colors.yellow + 'Mixed'}${colors.reset}`);
    
    if (failureIndices.length <= 10) {
      console.log(`  Failed at tests: ${failureIndices.map(i => i + 1).join(', ')}`);
    }
    console.log('');
  }

  // Recommendations
  console.log(`${colors.cyan}Recommendations:${colors.reset}`);
  if (successRate >= 95) {
    console.log(`  ${colors.green}✓ Connection is stable. No action needed.${colors.reset}`);
  } else if (successRate >= 80) {
    console.log(`  ${colors.yellow}⚠ Connection has intermittent issues.${colors.reset}`);
    console.log(`    - Review error types above`);
    console.log(`    - Consider increasing retry delays`);
    console.log(`    - Monitor Railway status`);
  } else {
    console.log(`  ${colors.red}✗ Connection is highly unstable.${colors.reset}`);
    console.log(`    - Contact Railway support immediately`);
    console.log(`    - Provide this analysis file`);
    console.log(`    - Consider alternative hosting`);
  }
  console.log('');
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node analyze-railway-test.js <json-file>');
  console.error('Example: node analyze-railway-test.js railway-airtable-test-20260105_123456.json');
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`${colors.red}Error: File not found: ${filePath}${colors.reset}`);
  process.exit(1);
}

analyze(filePath);

