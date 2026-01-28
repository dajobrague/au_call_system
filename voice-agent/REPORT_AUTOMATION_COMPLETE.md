# Daily Report Automation - Implementation Complete ✅

## Summary

Successfully migrated daily report generation from Airtable automation to Railway server using node-cron. This eliminates the circular dependency issue and 5-second timeout problems.

## What Was Implemented

### 1. Automated Cron Job (Midnight AEST)
- **File**: `src/services/cron/report-scheduler.ts`
- **Schedule**: Runs automatically at midnight Australia/Sydney timezone
- **Integrated**: Into `server.js` startup and graceful shutdown
- **Logs**: Full logging of execution results to Railway logs

### 2. On-Demand CLI Script
- **File**: `scripts/generate-reports.js`
- **Executable**: Can be run from command line or npm script
- **Flexible**: Supports date and provider filtering

### 3. Package Updates
- Added `node-cron@^3.0.3` for scheduling
- Added `@types/node-cron@^3.0.11` for TypeScript support
- Added npm script: `npm run generate-reports`

## Usage

### Automatic (Production)
Once deployed to Railway, reports will automatically generate every day at midnight AEST. Check Railway logs for:
- `✅ Report Scheduler initialized (midnight AEST)`
- `✅ Daily Reports Generated Successfully`

### Manual On-Demand

#### From Project Root:
```bash
# Generate yesterday's reports for all providers
cd voice-agent
node scripts/generate-reports.js

# Generate for specific date (all providers)
node scripts/generate-reports.js --date 2026-01-05

# Generate for specific provider only
node scripts/generate-reports.js --provider rec123456

# Generate for specific date AND provider
node scripts/generate-reports.js --date 2026-01-05 --provider rec123456
```

#### Using npm script:
```bash
cd voice-agent

# All providers, yesterday
npm run generate-reports

# With arguments
npm run generate-reports -- --date 2026-01-05
npm run generate-reports -- --provider rec123456
npm run generate-reports -- --date 2026-01-05 --provider rec123456
```

## Output Example

```
================================================
📊 Daily Call Summary Report Generator
================================================
Time: 05/01/2026, 12:01:00 am
Endpoint: https://aucallsystem-ivr-system.up.railway.app/api/reports/daily-call-summary
Date: Sat, 4 Jan 2026 (2026-01-05)
Scope: All providers

Generating reports...

✅ REPORTS GENERATED SUCCESSFULLY
================================================
Date: 2026-01-05
Total Calls: 47
Total Duration: 3420 min

📋 Provider Reports:
------------------------------------------------

1. ✅ Bay Area Family Practice
   Calls: 23
   Duration: 1560 min
   Status: PDF uploaded to S3 ✓
   Record: recABC123456

2. ✅ City Medical Center
   Calls: 15
   Duration: 1020 min
   Status: PDF uploaded to S3 ✓
   Record: recXYZ789012

3. ✅ Coastal Health Services
   Calls: 9
   Duration: 840 min
   Status: PDF uploaded to S3 ✓
   Record: recDEF345678

================================================
📊 SUMMARY:
Total Providers: 3
Successful: 3
Failed: 0
================================================
```

## Files Modified

1. **voice-agent/package.json**
   - Added node-cron dependencies
   - Added generate-reports npm script

2. **voice-agent/server.js**
   - Integrated cron scheduler initialization (line ~347)
   - Integrated cron scheduler shutdown (line ~535)

## Files Created

1. **voice-agent/src/services/cron/report-scheduler.ts**
   - Cron job scheduler
   - Automatic midnight AEST execution
   - Internal API endpoint caller
   - Full error handling and logging

2. **voice-agent/scripts/generate-reports.js**
   - CLI tool for on-demand generation
   - Argument parsing (--date, --provider)
   - Formatted output display
   - Exit codes (0=success, 1=error)

## Architecture Change

### Before (Failed):
```
Airtable Automation (cron) → Railway API → Airtable API
         ↑_______________|
         (circular dependency, 5s timeout)
```

### After (Working):
```
Railway Cron Job (midnight AEST) → Airtable API ✓
                                    (direct, fast)

CLI Script (on-demand) → Railway API → Airtable API ✓
                         (localhost or Railway URL)
```

## Benefits

1. ✅ **No circular dependency** - Direct Railway → Airtable connection
2. ✅ **No timeout issues** - Railway has 30s+ timeout, plenty of time
3. ✅ **Faster execution** - No extra network hop through Airtable servers
4. ✅ **Better error handling** - Full control over retries and logging in Railway
5. ✅ **On-demand capability** - CLI script for manual execution anytime
6. ✅ **Cost savings** - No Airtable automation usage charges
7. ✅ **Better monitoring** - All logs in one place (Railway)
8. ✅ **Flexible scheduling** - Easy to change timing if needed

## Next Steps

### 1. Deploy to Railway
```bash
cd voice-agent
git add .
git commit -m "Add automated report generation with cron"
git push
```

Railway will automatically:
- Install node-cron
- Start the cron scheduler on server startup
- Execute reports at midnight AEST daily

### 2. Verify in Railway Logs
After deployment, check Railway logs for:
```
✅ Report Scheduler initialized (midnight AEST)
📅 Report Scheduler: Midnight AEST daily
```

### 3. Disable Airtable Automation
Once confirmed working on Railway:
- Go to Airtable automation settings
- Disable or delete the "Daily Call Summary Report Generator" automation
- The Railway cron job now handles this automatically

### 4. Test On-Demand CLI (Optional)
From your local machine or Railway terminal:
```bash
cd voice-agent
npm run generate-reports -- --date 2026-01-04
```

## Troubleshooting

### Server Logs Show Error
Check Railway logs for detailed error messages:
- Look for `cron_report_error` type logs
- Check Airtable API connectivity
- Verify environment variables are set

### No Reports Generated
1. Check Railway logs at midnight AEST
2. Verify Call Logs table has data for that date
3. Ensure Provider field is populated in call logs
4. Manually test: `npm run generate-reports -- --date YYYY-MM-DD`

### CLI Script Not Working Locally
- Ensure server is running: `npm start`
- Or set RAILWAY_PUBLIC_DOMAIN to test against production
- Check the API endpoint returns 200 (not redirecting to /login)

## Testing Checklist

- [x] TypeScript compiles without errors
- [x] server.js syntax valid
- [x] CLI script accepts arguments correctly
- [x] CLI script makes HTTP requests
- [x] Cron scheduler initializes on server start
- [x] Cron scheduler shuts down gracefully
- [ ] End-to-end test on Railway (deploy and wait for midnight)
- [ ] Verify PDFs appear in S3
- [ ] Verify Airtable Reports table updated

## Support

If issues arise:
1. Check Railway logs for cron execution details
2. Run CLI script manually to test: `npm run generate-reports`
3. Verify Airtable API credentials in Railway environment variables
4. Check S3 credentials for PDF upload

