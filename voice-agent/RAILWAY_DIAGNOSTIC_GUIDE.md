# Railway Airtable Connection Diagnostic Tools

This guide explains how to use the diagnostic tools to test and analyze the connection between Railway and Airtable.

## Overview

These tools help you:
- Test Railway → Airtable connectivity without making actual phone calls
- Collect detailed timing and error information
- Analyze failure patterns and success rates
- Generate reports for Railway support

## Files Created

1. **`/app/api/diagnose/airtable-connection/route.ts`** - API endpoint on Railway
2. **`/scripts/test-railway-airtable.sh`** - Bash script to run multiple tests
3. **`/scripts/analyze-railway-test.js`** - Node script to analyze results

## How to Use

### Step 1: Deploy to Railway

First, commit and push the changes:

```bash
cd voice-agent
git add app/api/diagnose/airtable-connection/route.ts scripts/
git commit -m "Add Railway Airtable diagnostic tools"
git push
```

Wait 2-3 minutes for Railway to deploy.

### Step 2: Run the Diagnostic Test

Run the test script from your local terminal (this will call Railway):

```bash
cd voice-agent/scripts
./test-railway-airtable.sh
```

This will:
- Run 50 tests (default)
- Call Railway every second
- Test Sam's phone number (+61450236063)
- Save results to `railway-airtable-test-TIMESTAMP.json`
- Display real-time progress

**Customization:**

Edit the script to change:
```bash
TEST_RUNS=100        # Number of tests
DELAY=2              # Seconds between tests
TEST_PHONE="+123..."  # Different phone number
```

### Step 3: Analyze the Results

After the test completes, analyze the data:

```bash
node analyze-railway-test.js railway-airtable-test-20260105_123456.json
```

This shows:
- Success/failure rate
- Duration statistics (min, max, avg, p95, p99)
- Error types and frequency
- Failure patterns (random vs bursty)
- Railway environment details
- Recommendations

## Manual Testing (Single Request)

You can also test manually with curl:

```bash
# Test by phone
curl "https://aucallsystem-ivr-system.up.railway.app/api/diagnose/airtable-connection?phone=+61450236063" | jq

# Test by PIN
curl "https://aucallsystem-ivr-system.up.railway.app/api/diagnose/airtable-connection?pin=1990" | jq
```

## Understanding the Results

### Success Rate
- **≥95%**: Connection is stable ✅
- **80-95%**: Intermittent issues ⚠️
- **<80%**: Serious connectivity problems ❌

### Common Error Types

| Error | Meaning | Action |
|-------|---------|--------|
| `ECONNRESET` | Connection reset by peer | Network instability |
| `ETIMEDOUT` | Connection timed out | Railway → Airtable routing issue |
| `ENOTFOUND` | DNS resolution failed | DNS problems |
| `Request timeout` | No response in 8 seconds | Airtable overloaded or blocked |
| `429 Rate Limit` | Too many requests | Reduce request frequency |

### Failure Patterns

- **Random failures**: Network instability, normal for internet
- **Bursty failures**: Rate limiting or Railway deployment issues
- **Consistent failures**: Critical connectivity problem

## Sample Output

### Test Script Output
```
Test 1/50: ✓ Success (1234ms)
Test 2/50: ✓ Success (145ms)
Test 3/50: ✗ Failed - Request timeout
...
========================================
Successes: 45
Failures: 5
Success Rate: 90%
Average Duration: 234ms
```

### Analysis Output
```
Basic Statistics:
  Total Tests: 50
  Successful: 45
  Failed: 5
  Success Rate: 90.00%

Duration Statistics (ms):
  Min: 132
  Max: 8002
  Avg: 456
  P95: 1234
  P99: 3456

Error Analysis:
  Request timeout: 3 times (60%)
  ECONNRESET: 2 times (40%)

Recommendations:
  ⚠ Connection has intermittent issues.
    - Review error types above
    - Consider increasing retry delays
    - Monitor Railway status
```

## Troubleshooting

### "Command not found" when running the script
```bash
chmod +x scripts/test-railway-airtable.sh
```

### "jq: command not found"
Install jq (optional, only for pretty JSON):
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq
```

### Script runs but gets 404 errors
Wait for Railway to deploy (check Railway dashboard) or verify the URL in the script.

### All tests fail immediately
Check if Railway is down or if environment variables are set correctly on Railway.

## For Railway Support

If you need to contact Railway support, include:

1. **This diagnostic data**: Attach the JSON file
2. **Analysis report**: Copy the analysis output
3. **Your summary**:
   - "Railway cannot reliably connect to api.airtable.com"
   - "Success rate: X%"
   - "Main error: [most common error]"
   - "This works 100% locally"

## Safety Notes

✅ **Safe**: This endpoint only reads data, never writes  
✅ **Safe**: No side effects on production calls  
✅ **Safe**: Can run any time without affecting users  
⚠️ **Note**: Counts toward your Airtable API rate limit (5 req/sec)

## Clean Up

After diagnosing, you can optionally remove the diagnostic endpoint:

```bash
rm app/api/diagnose/airtable-connection/route.ts
git commit -am "Remove diagnostic endpoint"
git push
```

Keep the scripts for future use!

