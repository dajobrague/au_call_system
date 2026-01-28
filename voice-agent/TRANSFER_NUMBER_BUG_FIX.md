# Dynamic Transfer Number - Bug Fix

## Problem
The dynamic transfer number feature was NOT working in production. Even though providers had transfer numbers configured in Airtable, the system was using a hardcoded fallback number `+61490550941`.

**Provider Tested:** A Plus Care (`recexHQJ13oafJkxZ`)  
**Configured Number:** `+61424341800`  
**What Was Happening:** Calls were transferring to `+61490550941` instead

## Root Cause

The bug was found through systematic diagnosis scripts. The issue was **NOT** in the transfer logic itself, but in how the provider data was being saved to the call state.

### The Actual Bug

In `/src/fsm/phases/provider-phase.ts`, when the provider was added to the call state, the **`transferNumber` field was missing**:

#### Bug Location 1: Single Provider Case (Line 40-44)
```typescript
// BEFORE (BROKEN):
provider: providerResult.providers.length > 0 ? {
  id: providerResult.providers[0].id,
  name: providerResult.providers[0].name,
  greeting: providerResult.providers[0].greeting,
  // ❌ transferNumber was MISSING!
} : null,
```

#### Bug Location 2: Multiple Providers Case (Line 64-69)
```typescript
// BEFORE (BROKEN):
availableProviders: providerResult.providers.map(p => ({
  id: p.id,
  name: p.name,
  greeting: p.greeting,
  // ❌ transferNumber was MISSING!
  selectionNumber: p.selectionNumber,
})),
```

## The Fix

### 1. Fixed Provider Phase to Include transferNumber

**File:** `/src/fsm/phases/provider-phase.ts`

**Change 1 - Single Provider:**
```typescript
// AFTER (FIXED):
provider: providerResult.providers.length > 0 ? {
  id: providerResult.providers[0].id,
  name: providerResult.providers[0].name,
  greeting: providerResult.providers[0].greeting,
  transferNumber: providerResult.providers[0].transferNumber, // ✅ ADDED
} : null,
```

**Change 2 - Multiple Providers:**
```typescript
// AFTER (FIXED):
availableProviders: providerResult.providers.map(p => ({
  id: p.id,
  name: p.name,
  greeting: p.greeting,
  transferNumber: p.transferNumber, // ✅ ADDED
  selectionNumber: p.selectionNumber,
})),
```

### 2. Removed Hardcoded Fallback Numbers

Removed the hardcoded `+61490550941` fallback from all transfer endpoints. Now the system:
- ✅ Uses provider's transfer number (primary)
- ✅ Falls back to `process.env.REPRESENTATIVE_PHONE` (if set)
- ❌ **NO hardcoded fallback** - will error with clear message if not configured

**Files Updated:**
- `/src/websocket/dtmf-router.ts` - Removed hardcoded fallback, added validation
- `/app/api/queue/transfer/route.ts` - Removed hardcoded fallback, added validation
- `/app/api/queue/initiate-transfer/route.ts` - Removed hardcoded fallback, added validation
- `/app/api/transfer/after-connect/route.ts` - Removed hardcoded fallback, added validation

### 3. Added Proper Error Handling

If no transfer number is configured, the system now:
- Logs a clear error message
- Tells the caller: "Transfer is not configured for this provider. Please contact support."
- Does not attempt transfer with wrong number

## Verification

### Test Scripts Created

1. **`diagnose-transfer-flow.js`** - Simulates the data flow from Airtable → Call State → Transfer
2. **`verify-provider-transfer-fix.js`** - Validates all 7 checkpoints in the transfer flow
3. **`check-provider-transfer-number.js`** - Checks if a provider has transfer number configured

### Test Results
```
✅ Provider from Airtable has transferNumber: +61424341800
✅ Transformed provider includes transferNumber: +61424341800
✅ Single provider call state includes transferNumber: +61424341800
✅ Multi-provider availableProviders includes transferNumber: +61424341800
✅ dtmf-router resolves to provider number: +61424341800
✅ pendingTransfer has provider number: +61424341800
✅ Transfer API uses provider number: +61424341800

✅ ✅ ✅ ALL CHECKS PASSED! ✅ ✅ ✅
```

## Transfer Number Priority Order

The system now resolves transfer numbers in this order:

1. **`callState.pendingTransfer.representativePhone`** (highest priority)
   - Set when transfer is initiated in dtmf-router
   - Contains provider's transfer number

2. **`callState.provider.transferNumber`** (NEW - main fix)
   - Now properly included in call state
   - Provider-specific from Airtable

3. **`process.env.REPRESENTATIVE_PHONE`** (environment fallback)
   - System-wide default

4. **Error** (NO hardcoded fallback)
   - Clear error message to user
   - Logs for debugging

## Files Changed

### Fixed (Added transferNumber)
- ✅ `/src/fsm/phases/provider-phase.ts` - **THE KEY FIX**

### Enhanced (Removed hardcoded fallback + validation)
- ✅ `/src/websocket/dtmf-router.ts`
- ✅ `/app/api/queue/transfer/route.ts`
- ✅ `/app/api/queue/initiate-transfer/route.ts`
- ✅ `/app/api/transfer/after-connect/route.ts`

### Already Working (No changes needed)
- ✅ `/src/services/airtable/employee-service.ts` - `transformProviderRecord` already included `transferNumber`
- ✅ `/src/websocket/dtmf-router.ts` - Provider selection already included `transferNumber` (line 311)

## Impact

### Before Fix
- ❌ Provider transfer numbers were ignored
- ❌ ALL calls transferred to hardcoded `+61490550941`
- ❌ Provider Portal's Transfer Number field was non-functional
- ❌ Silent failure - users didn't know it wasn't working

### After Fix
- ✅ Each provider uses their configured transfer number
- ✅ Provider Portal's Transfer Number field is fully functional
- ✅ Clear error messages if transfer number not configured
- ✅ Proper logging with source tracking

## Testing in Production

### Before Deployment

Run the verification script:
```bash
cd /Users/davidbracho/auestralian_project/voice-agent
node scripts/verify-provider-transfer-fix.js
```

Expected output: All 7 checks should pass.

### After Deployment

1. **Test with A Plus Care provider:**
   - Make a test call
   - Request transfer to representative
   - Verify call goes to: `+61424341800`

2. **Check logs for:**
   - `type: 'transfer_number_from_provider'`
   - `source: 'provider'`
   - Provider name in transfer logs

3. **Monitor for errors:**
   - `type: 'transfer_no_number'` - Provider missing transfer number
   - `type: 'transfer_no_number_configured'` - System has no fallback

## Configuration

### For Providers to Use This Feature

1. Admin logs into Provider Portal
2. Goes to Admin section
3. Configures Transfer Number field
4. Saves changes
5. Transfer number is immediately active for new calls

### Phone Number Format

Accepts Australian phone numbers:
- Mobile: `+61 4XX XXX XXX` or `04XX XXX XXX`
- Landline: `+61 X XXXX XXXX` or `0X XXXX XXXX`

## Breaking Changes

⚠️ **IMPORTANT:** Hardcoded fallback removed!

If a provider does NOT have:
- A transfer number configured in Airtable, AND
- `REPRESENTATIVE_PHONE` environment variable set

Then transfers will **fail with error message** instead of silently using wrong number.

**This is intentional** - it's better to fail clearly than transfer to the wrong number.

## Backward Compatibility

- ✅ Providers with transfer numbers configured will work immediately
- ✅ System-wide `REPRESENTATIVE_PHONE` env variable still works as fallback
- ⚠️ Providers without either will get clear error (better than wrong behavior)

## Date Fixed
December 21, 2025

## Tested By
Comprehensive diagnostic and verification scripts

## Next Steps

1. Deploy to production
2. Test with real A Plus Care calls
3. Monitor logs for `transfer_number_from_provider` events
4. Configure transfer numbers for all active providers
5. Consider setting `REPRESENTATIVE_PHONE` env variable as system-wide fallback

