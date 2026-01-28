# Quick Start: Railway Diagnostic Testing

## Wait for Deployment
Railway is currently deploying your changes (2-3 minutes). Check: https://railway.app

## Once Deployed, Run This:

```bash
cd /Users/davidbracho/auestralian_project/voice-agent/scripts
./test-railway-airtable.sh
```

This will:
- ✅ Run 50 connection tests from your terminal
- ✅ Call Railway endpoint (tests Railway → Airtable)
- ✅ Show real-time results
- ✅ Save data to JSON file

## Then Analyze Results:

```bash
node analyze-railway-test.js railway-airtable-test-*.json
```

This shows:
- Success rate %
- Duration statistics
- Error types
- Recommendations

## Expected Results

### If Railway Connection is Good (≥95% success):
```
✓ Success (234ms)
✓ Success (145ms)
✓ Success (189ms)
...
Success Rate: 98%
```
**Conclusion**: Not a Railway issue, something else is wrong

### If Railway Connection is Bad (<80% success):
```
✓ Success (234ms)
✗ Failed - Request timeout
✗ Failed - ECONNRESET
✓ Success (145ms)
...
Success Rate: 65%
```
**Conclusion**: Railway cannot reliably reach Airtable → Contact Railway support

## Manual Test (Quick Check)

```bash
curl "https://aucallsystem-ivr-system.up.railway.app/api/diagnose/airtable-connection?phone=+61450236063"
```

Should return JSON with success/failure details.

## What This Proves

- ✅ Tests actual Railway environment (not local)
- ✅ No phone calls required
- ✅ Captures real error messages
- ✅ Shows if it's Railway-specific or code issue
- ✅ Safe - read-only, no side effects

## Next Steps Based on Results

### If 95%+ success rate:
- Issue might be timing/race condition
- Check for concurrent calls
- Review rate limiting logic

### If <80% success rate:
- Open Railway support ticket
- Attach JSON results file
- Reference: "Railway → api.airtable.com connectivity"

## Need Help?

See full documentation: `RAILWAY_DIAGNOSTIC_GUIDE.md`

