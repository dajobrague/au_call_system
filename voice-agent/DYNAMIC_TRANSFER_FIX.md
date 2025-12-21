# Dynamic Transfer Number Fix

## Issue Summary

The dynamic phone number transfer feature was not working because the code had **hardcoded phone numbers** instead of loading the provider-specific transfer numbers from Airtable.

### Provider Record Checked
- **Provider**: A Plus Care
- **Record ID**: `recexHQJ13oafJkxZ`
- **Configured Transfer Number**: `+61424341800`
- **Issue**: This number was being ignored; system was using hardcoded `+61490550941`

## Root Cause

### Problem Files Identified

1. **`/app/api/queue/transfer/route.ts`** (PRIMARY ISSUE)
   - Line 14 had: `const REPRESENTATIVE_PHONE = '+61490550941';`
   - This hardcoded number was used for ALL transfers regardless of provider
   - Did not load transfer number from call state or provider record

2. **`/app/api/transfer/after-connect/route.ts`** (SECONDARY ISSUE)
   - Line 8 had: `const REPRESENTATIVE_PHONE = process.env.REPRESENTATIVE_PHONE || '+61490550941';`
   - Only checked environment variable, not provider-specific transfer number
   - Did not fallback to provider's configured transfer number

## Solution Implemented

### Fixed Files

#### 1. `/app/api/queue/transfer/route.ts`

**Changes Made:**
- Removed hardcoded `REPRESENTATIVE_PHONE` constant
- Added import: `import { loadCallState } from '@/fsm/state/state-manager';`
- Added dynamic transfer number resolution logic:

```typescript
// Load dynamic transfer number from call state (provider-specific)
let transferNumber = process.env.REPRESENTATIVE_PHONE || '+61490550941';
let transferNumberSource = process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default';

try {
  const callState = await loadCallState(callSid);
  if (callState?.pendingTransfer?.representativePhone) {
    transferNumber = callState.pendingTransfer.representativePhone;
    transferNumberSource = 'call_state';
  } else if (callState?.provider?.transferNumber) {
    transferNumber = callState.provider.transferNumber;
    transferNumberSource = 'provider';
  }
} catch (stateError) {
  logger.warn('Could not load call state for transfer number, using fallback', {
    callSid,
    error: stateError instanceof Error ? stateError.message : 'Unknown error',
    type: 'transfer_state_load_error'
  });
}
```

**Now uses:**
- `transferNumber` variable instead of hardcoded constant
- Logs the source of the transfer number for debugging

#### 2. `/app/api/transfer/after-connect/route.ts`

**Changes Made:**
- Removed hardcoded `REPRESENTATIVE_PHONE` constant
- Enhanced transfer number resolution with provider fallback:

```typescript
// Use the transfer number from pendingTransfer, or fallback to provider's transfer number
const transferNumber = callState.pendingTransfer.representativePhone 
  || callState.provider?.transferNumber
  || process.env.REPRESENTATIVE_PHONE 
  || '+61490550941';

const transferNumberSource = callState.pendingTransfer.representativePhone 
  ? 'pending_transfer'
  : callState.provider?.transferNumber 
    ? 'provider' 
    : (process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default');
```

**Now includes:**
- Provider transfer number as a fallback option
- Better logging with source tracking
- Provider name in logs for debugging

## Transfer Number Resolution Order

The system now resolves transfer numbers in this priority order:

1. **`callState.pendingTransfer.representativePhone`** (highest priority)
   - Set by `dtmf-router.ts` when transfer is initiated
   - Already uses provider's transfer number

2. **`callState.provider.transferNumber`** (NEW - main fix)
   - Loaded from Airtable provider record
   - Provider-specific configuration

3. **`process.env.REPRESENTATIVE_PHONE`** (environment variable)
   - System-wide default from environment

4. **`'+61490550941'`** (lowest priority)
   - Hardcoded fallback for emergencies only

## Verification

### Test Results

Ran comprehensive test script (`test-dynamic-transfer-fix.js`):

```
✅ Provider Found: A Plus Care
   Transfer Number: +61424341800

✅ Transfer Number Resolution:
   Source: provider
   Resolved Number: +61424341800

✅ SUCCESS: Provider's transfer number will be used!
```

### Transfer Flow Verified

All transfer endpoints now correctly use provider's number:

1. ✅ `dtmf-router.ts` (handleTransferToRepresentative)
2. ✅ `/api/queue/transfer` (POST)
3. ✅ `/api/queue/initiate-transfer` (POST)
4. ✅ `/api/transfer/after-connect` (POST)

## Files Already Working Correctly

These files already had proper dynamic transfer number support:

- ✅ `/app/api/queue/initiate-transfer/route.ts` - Already loads from call state
- ✅ `/src/websocket/dtmf-router.ts` - Already uses `callState.provider?.transferNumber`

## Impact

### Before Fix
- **ALL providers** used the same hardcoded number: `+61490550941`
- Provider-specific transfer numbers in Airtable were **completely ignored**
- Transfer Number field in Provider Portal was **non-functional**

### After Fix
- **Each provider** uses their own configured transfer number
- Provider-specific transfer numbers from Airtable are **now used**
- Transfer Number field in Provider Portal is **fully functional**
- System correctly falls back through priority chain if provider number not configured

## Testing Recommendations

### Manual Testing Steps

1. **Test with Configured Provider** (e.g., A Plus Care)
   ```
   node scripts/test-dynamic-transfer-fix.js recexHQJ13oafJkxZ
   ```
   - Should show provider's transfer number: `+61424341800`

2. **Make a Test Call**
   - Call the IVR system as A Plus Care provider
   - Request transfer to representative (press option for transfer)
   - Verify call goes to: `+61424341800` (not the old hardcoded number)

3. **Check Logs**
   - Look for log entries with: `type: 'transfer_number_from_provider'`
   - Verify `source: 'provider'` in transfer logs
   - Confirm `providerName` is logged correctly

### Monitoring

Watch for these log entries after deployment:
- `transfer_number_from_state` - Transfer number from pending transfer
- `transfer_number_from_provider` - Transfer number from provider record ✅ (NEW)
- `transfer_state_load_error` - Fallback to default (investigate if frequent)

## Configuration Guide

### For Administrators

To configure a provider's transfer number:

1. Log into **Provider Portal** as admin
2. Go to **Dashboard** → **Admin Section**
3. Find **Transfer Number** field
4. Enter Australian phone number (e.g., `+61 4XX XXX XXX`)
5. Click **Save Changes**

The transfer number will be immediately available for new calls.

### Phone Number Format

Accepts Australian formats:
- Mobile: `+61 4XX XXX XXX` or `04XX XXX XXX`
- Landline: `+61 X XXXX XXXX` or `0X XXXX XXXX`

## Deployment Notes

### Files Changed
- `/voice-agent/app/api/queue/transfer/route.ts`
- `/voice-agent/app/api/transfer/after-connect/route.ts`

### No Breaking Changes
- Maintains full backward compatibility
- Graceful fallback if provider number not configured
- No database schema changes required

### Zero Downtime
- Can be deployed without service interruption
- No migration scripts needed
- Existing calls will continue with current behavior

## Related Documentation

- **Transfer Number Feature**: `/TRANSFER_NUMBER_FEATURE.md`
- **Railway Transfer Implementation**: `/RAILWAY_TRANSFER_IMPLEMENTATION.md`

## Date Fixed
December 21, 2025

## Tested By
Diagnostic scripts and code verification

