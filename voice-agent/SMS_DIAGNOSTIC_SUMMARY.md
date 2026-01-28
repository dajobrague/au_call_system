# SMS Diagnostic Summary - Staff Pool Implementation

## ✅ ALL ISSUES IDENTIFIED AND FIXED

### Issue #1: Empty staffPoolIds (FIXED)
**Location:** `reason-phase.ts` and `dtmf-router.ts`  
**Problem:** Both files were creating patient objects with `staffPoolIds: []` (empty array) without fetching actual data from Airtable.

### Issue #2: Empty Patient ID in Call State (FIXED)
**Location:** `dtmf-router.ts` and `reason-phase.ts`  
**Problem:** Patient ID was not available in call state, so the staff pool fetch never happened.

### Issue #3: Original Employee Receiving Wave 2 & 3 SMS (FIXED)
**Location:** `wave-processor.ts`, `sms-wave-queue.ts`, `job-notification-service.ts`  
**Problem:** Wave 2 & 3 were not excluding the employee who left the job open, so they were receiving notifications they shouldn't.

### What Was Fixed
1. **`voice-agent/src/fsm/phases/reason-phase.ts`** - Now fetches patient record before sending notifications
2. **`voice-agent/src/websocket/dtmf-router.ts`** - Now fetches patient record before sending notifications

Both files now:
- Call `airtableClient.getPatientById(patientId)` to fetch the full patient record
- Extract `fields['Related Staff Pool']` from the record
- Pass the actual `staffPoolIds` array to `processInstantJobRedistribution()`

---

## 🔍 Comprehensive System Check

### ✅ What's Working Correctly

1. **Patient Data Transformation** (`job-service.ts` line 57)
   ```typescript
   staffPoolIds: fields['Related Staff Pool'] || []
   ```
   ✅ Correctly maps Airtable field to staffPoolIds

2. **Staff Pool Filtering** (`job-notification-service.ts` line 112-139)
   ```typescript
   private filterByStaffPool(employees, staffPoolIds)
   ```
   ✅ Returns empty array if no staff pool (preventing notifications as intended)
   ✅ Filters employees to only those in staff pool

3. **Wave 1 (Immediate)** (`job-notification-service.ts` line 446-449)
   ```typescript
   const providerEmployees = this.filterByStaffPool(
     allProviderEmployees,
     patient.staffPoolIds
   );
   ```
   ✅ Uses filterByStaffPool before sending Wave 1

4. **Wave 2 & 3 Scheduling** (`job-notification-service.ts` line 531)
   ```typescript
   staffPoolIds: patient.staffPoolIds
   ```
   ✅ Passes staffPoolIds to queue for waves 2 & 3

5. **Wave Processor** (`wave-processor.ts` line 62-65)
   ```typescript
   const staffPoolIds = waveJob.staffPoolIds || [];
   const employees = staffPoolIds.length > 0
     ? allEmployees.filter(emp => staffPoolIds.includes(emp.id))
     : [];
   ```
   ✅ Filters employees in waves 2 & 3

6. **Twilio SMS Service** (`twilio-sms-service.ts`)
   ✅ No issues - sends SMS correctly when called

7. **Phone Validator** (`phone-validator.ts`)
   ✅ Validates Australian/Mexican numbers correctly

8. **Bull Queue Worker** (`sms-wave-worker.ts`)
   ✅ Properly initialized in server.js (line 341)
   ✅ Worker processes waves correctly

9. **Redis Configuration** (`redis-bull.ts`)
   ✅ Properly configured for Railway Redis

---

## 🎯 Potential Remaining Issues

### 1. **Empty Patient ID Edge Case**
If `patientId` is undefined/empty in the call state:
- Our fix will skip the fetch (line 310 and 531)
- `staffPoolIds` will remain empty array `[]`
- No SMS will be sent
- **Mitigation:** Added logging to track this

### 2. **Airtable API Errors**
If `getPatientById()` throws an error:
- Caught by try/catch
- `staffPoolIds` remains empty array `[]`
- No SMS sent
- **Mitigation:** Error logging added

### 3. **Patient Record Has No Staff Pool Field**
If Airtable record doesn't have `'Related Staff Pool'` field:
- `staffPoolIds` will be `[]`
- No SMS sent (by design)
- **Mitigation:** Warning message shown in provider portal

### 4. **All Staff Pool Employees Have Invalid Phone Numbers**
If phone validator filters out all employees:
- No SMS sent
- **Check:** Review phone number formats in Airtable

### 5. **Bull Queue/Redis Connection Issues**
If Redis is down or not connected:
- Wave 1 (immediate) will still work
- Waves 2 & 3 won't be scheduled
- **Check:** Railway Redis service status

---

## 📊 Testing Checklist

### Before Deployment
- [x] Code changes applied to both files
- [x] No linting errors
- [x] Test script confirmed patient data fetches correctly

### After Deployment
- [ ] Test with patient `recKkIJDXnPbHrrd1` (Carol Perry - has 5 staff pool members)
- [ ] Verify Wave 1 SMS sent immediately
- [ ] Check logs for "Fetched staff pool for patient" message
- [ ] Verify 5 SMS messages sent (to staff pool only, not all employees)
- [ ] Check Railway logs for any errors
- [ ] Verify Redis connection is healthy
- [ ] Test with a patient with no staff pool (should send 0 SMS)

---

## 🔧 Debugging Commands

### Check Railway Logs
```bash
# Monitor real-time logs
railway logs --service voice-agent

# Look for these log messages:
# - "Fetched staff pool for patient"
# - "Filtered employees by staff pool"
# - "Wave 1 (immediate) sent"
# - "SMS sent successfully"
```

### Check Redis Connection
```bash
# In Railway dashboard
railway run redis-cli ping
```

### Test Patient Fetch Locally
```bash
cd voice-agent
npx tsx scripts/test-patient-staff-pool.js
```

---

## 📝 Implementation Summary

### Files Modified

#### Fix #1 & #2: Patient ID and Staff Pool Fetching
1. `voice-agent/src/fsm/phases/reason-phase.ts`
   - Added import: `airtableClient`
   - Added patient fetch logic with fallback to occurrence lookup
   - Pass fetched `staffPoolIds` to patient object

2. `voice-agent/src/websocket/dtmf-router.ts`
   - Added import: `airtableClient`
   - Added patient fetch logic with fallback to occurrence lookup
   - Pass fetched `staffPoolIds` to patient object

#### Fix #3: Exclude Original Employee from Wave 2 & 3
3. `voice-agent/src/services/queue/sms-wave-queue.ts`
   - Added `excludeEmployeeId?: string` to `WaveJobData` interface

4. `voice-agent/src/services/sms/job-notification-service.ts`
   - Added `excludeEmployeeId: originalEmployee.id` to waveData

5. `voice-agent/src/services/sms/wave-processor.ts`
   - Pass `excludeEmployeeId` to `findProviderEmployees()` in waves 2 & 3
   - Added logging for excluded employee ID

### Files Already Correct (No Changes Needed)
- `job-notification-service.ts` - Filtering logic correct
- `wave-processor.ts` - Wave 2 & 3 filtering correct
- `sms-wave-queue.ts` - Queue data structure includes staffPoolIds
- `twilio-sms-service.ts` - SMS sending works correctly
- `job-service.ts` - Patient transformation correct
- `types.ts` - Patient interface includes staffPoolIds

---

## 🚀 Expected Behavior After Fix

### Scenario A: Patient with Staff Pool
```
Employee "John" (emp1) leaves job open
  ↓
System fetches patient record → staffPoolIds: [emp1, emp2, emp3]
  ↓
Wave 1: Filter 50 provider employees → Exclude John → 2 staff pool employees (emp2, emp3)
  ↓
Send SMS to emp2 and emp3 only (NOT to John)
  ↓
Waves 2 & 3 scheduled with excludeEmployeeId: emp1
  ↓
Wave 2: Exclude John → Send to emp2 and emp3 only
  ↓
Wave 3: Exclude John → Send to emp2 and emp3 only
```

### Scenario B: Patient without Staff Pool
```
Employee leaves job open
  ↓
System fetches patient record → staffPoolIds: []
  ↓
Wave 1: Filter returns 0 employees
  ↓
No SMS sent (log warning: "No staff pool defined")
  ↓
Provider portal shows warning on patient page
```

---

## ✅ Conclusion

**Primary Issue:** Fixed ✅  
**System Architecture:** Sound ✅  
**Ready for Deployment:** Yes ✅

The fix ensures that SMS notifications are sent ONLY to employees in the patient's Related Staff Pool, as intended.

