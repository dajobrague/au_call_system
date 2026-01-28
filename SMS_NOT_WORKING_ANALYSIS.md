# 🚨 SMS Not Working - Root Cause Analysis

## Status: NO SMS BEING SENT

---

## 🔴 ROOT CAUSE

The system is creating **temporary Patient objects** with `staffPoolIds: []` (empty array) instead of fetching the **actual patient record** from Airtable.

When `staffPoolIds` is empty → `filterByStaffPool()` returns `[]` → No employees → **NO SMS SENT**

---

## 📍 Problem Locations

### Location 1: `voice-agent/src/fsm/phases/reason-phase.ts`
**Lines 305-314:**
```typescript
const fullPatient = {
  id: state.patient?.id || '',
  name: state.patient?.name || 'Unknown Patient',
  patientId: state.patient?.patientId || 0,
  phone: '',
  dateOfBirth: '',
  providerId: state.provider?.id || '',
  active: true,
  staffPoolIds: [], // ⚠️ HARDCODED EMPTY ARRAY - This is the problem!
};
```

**Available Data:**
- Patient ID: `state.jobTemplate?.patientId` (line 283, 301)
- Patient partial data: `state.patient?.id` (line 306)

**What's Missing:**
- NOT fetching actual patient record from Airtable
- NOT using `airtableClient.getPatientById(patientId)`
- NOT transforming to get real `staffPoolIds`

---

### Location 2: `voice-agent/src/websocket/dtmf-router.ts`
**Lines 526-535:**
```typescript
const fullPatient = {
  id: callState.selectedOccurrence?.patient?.id || '',
  name: callState.selectedOccurrence?.patient?.fullName || 'Unknown Patient',
  patientId: 0,
  phone: '',
  dateOfBirth: '',
  providerId: providerId,
  active: true,
  staffPoolIds: [], // ⚠️ HARDCODED EMPTY ARRAY - This is the problem!
};
```

**Available Data:**
- Patient ID: `callState.selectedOccurrence?.patient?.id` (line 504, 522, 527)
- Job Template patient ID: From job template if available

**What's Missing:**
- NOT fetching actual patient record from Airtable
- NOT using `airtableClient.getPatientById(patientId)`
- NOT transforming to get real `staffPoolIds`

---

## ✅ What SHOULD Happen (The Fix Needed)

### Required Steps:

1. **Import airtableClient**
   ```typescript
   import { airtableClient } from '../../services/airtable/client';
   ```

2. **Fetch actual patient record from Airtable**
   ```typescript
   const patientId = state.jobTemplate?.patientId || state.patient?.id || '';
   const patientRecord = await airtableClient.getPatientById(patientId);
   ```

3. **Transform to Patient object (includes staffPoolIds)**
   ```typescript
   import { transformPatientRecord } from '../../services/airtable/job-service';
   const fullPatient = transformPatientRecord(patientRecord);
   ```

4. **Use real patient data in redistribution**
   ```typescript
   await jobNotificationService.processInstantJobRedistribution(
     fullJobOccurrence,
     fullJobTemplate,
     fullPatient, // ✅ Now has real staffPoolIds from Airtable
     formattedReason,
     state.employee
   );
   ```

---

## 🔍 Why This Is Happening

### Current Flow (BROKEN):
```
Job Left Open
  ↓
Create temporary fullPatient object
  ↓
staffPoolIds = [] (hardcoded empty)
  ↓
processInstantJobRedistribution(fullPatient)
  ↓
filterByStaffPool(employees, [])
  ↓
Returns empty array (no staff pool)
  ↓
❌ NO SMS SENT
```

### Correct Flow (NEEDS TO BE IMPLEMENTED):
```
Job Left Open
  ↓
Extract patient ID from job/occurrence data
  ↓
Fetch patient record: airtableClient.getPatientById(patientId)
  ↓
Transform record: transformPatientRecord(record)
  ↓
Patient object has real staffPoolIds from Airtable
  ↓
processInstantJobRedistribution(fullPatient)
  ↓
filterByStaffPool(employees, staffPoolIds)
  ↓
Returns staff pool employees
  ↓
✅ SMS SENT to staff pool
```

---

## 📋 Required Changes

### File 1: `voice-agent/src/fsm/phases/reason-phase.ts`

**Imports needed (add at top):**
```typescript
import { airtableClient } from '../../services/airtable/client';
```

**Change needed (around line 274-314):**
Replace the temporary `fullPatient` object creation with:
```typescript
// Fetch actual patient record from Airtable to get staff pool
const patientId = state.jobTemplate?.patientId || state.patient?.id || '';

let fullPatient: Patient;
if (patientId) {
  try {
    const patientRecord = await airtableClient.getPatientById(patientId);
    if (patientRecord) {
      // Import transformPatientRecord from job-service
      const { transformPatientRecord } = await import('../../services/airtable/job-service');
      fullPatient = transformPatientRecord(patientRecord);
    } else {
      // Fallback if patient not found
      fullPatient = {
        id: patientId,
        name: state.patient?.name || 'Unknown Patient',
        patientId: state.patient?.patientId || 0,
        phone: '',
        dateOfBirth: '',
        providerId: state.provider?.id || '',
        active: true,
        staffPoolIds: [], // Empty if patient not found
      };
    }
  } catch (error) {
    console.error('Failed to fetch patient for staff pool:', error);
    // Fallback
    fullPatient = {
      id: patientId,
      name: state.patient?.name || 'Unknown Patient',
      patientId: state.patient?.patientId || 0,
      phone: '',
      dateOfBirth: '',
      providerId: state.provider?.id || '',
      active: true,
      staffPoolIds: [],
    };
  }
} else {
  // No patient ID available
  fullPatient = {
    id: '',
    name: 'Unknown Patient',
    patientId: 0,
    phone: '',
    dateOfBirth: '',
    providerId: state.provider?.id || '',
    active: true,
    staffPoolIds: [],
  };
}
```

---

### File 2: `voice-agent/src/websocket/dtmf-router.ts`

**Imports needed (add at top):**
```typescript
import { airtableClient } from '../services/airtable/client';
```

**Change needed (around line 492-535):**
Replace the temporary `fullPatient` object creation with:
```typescript
// Fetch actual patient record from Airtable to get staff pool
const patientId = callState.selectedOccurrence?.patient?.id || '';

let fullPatient: Patient;
if (patientId) {
  try {
    const patientRecord = await airtableClient.getPatientById(patientId);
    if (patientRecord) {
      // Import transformPatientRecord from job-service
      const { transformPatientRecord } = await import('../services/airtable/job-service');
      fullPatient = transformPatientRecord(patientRecord);
    } else {
      // Fallback if patient not found
      fullPatient = {
        id: patientId,
        name: callState.selectedOccurrence?.patient?.fullName || 'Unknown Patient',
        patientId: 0,
        phone: '',
        dateOfBirth: '',
        providerId: providerId,
        active: true,
        staffPoolIds: [],
      };
    }
  } catch (error) {
    logger.error('Failed to fetch patient for staff pool', {
      patientId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'patient_fetch_error'
    });
    // Fallback
    fullPatient = {
      id: patientId,
      name: callState.selectedOccurrence?.patient?.fullName || 'Unknown Patient',
      patientId: 0,
      phone: '',
      dateOfBirth: '',
      providerId: providerId,
      active: true,
      staffPoolIds: [],
    };
  }
} else {
  // No patient ID available
  logger.warn('No patient ID available for staff pool filtering', {
    occurrenceId: callState.selectedOccurrence?.occurrenceId,
    type: 'no_patient_id'
  });
  fullPatient = {
    id: '',
    name: 'Unknown Patient',
    patientId: 0,
    phone: '',
    dateOfBirth: '',
    providerId: providerId,
    active: true,
    staffPoolIds: [],
  };
}
```

---

## 🔧 How getPatientById Works

**Location:** `voice-agent/src/services/airtable/client.ts` (line 490)

**Function:**
```typescript
async getPatientById(patientId: string): Promise<PatientRecord | null>
```

**What it does:**
1. Makes raw GET request to Airtable API
2. Fetches `/v0/{baseId}/Patients/{patientId}`
3. Returns **ALL fields** including `Related Staff Pool`
4. Returns `null` if patient not found

**Returns:** `PatientRecord` which includes:
```typescript
{
  id: string,
  fields: {
    'Patient Full Name': string,
    'Patient ID': number,
    'Phone': string,
    'DOB': string,
    'Related Staff Pool': string[], // ✅ This is what we need!
    // ... other fields
  }
}
```

---

## 🔄 How transformPatientRecord Works

**Location:** `voice-agent/src/services/airtable/job-service.ts` (line 44)

**Function:**
```typescript
function transformPatientRecord(record: PatientRecord): Patient
```

**What it does:**
```typescript
return {
  id: record.id,
  name: fields['Patient Full Name'] || 'Unknown Patient',
  patientId: fields['Patient ID'] || 0,
  phone: fields['Phone'] || '',
  dateOfBirth: fields['DOB'] || '',
  address: fields['Address'],
  notes: fields['Important Notes'],
  providerId: fields['Provider']?.[0] || '',
  active: fields['Active'] !== false,
  staffPoolIds: fields['Related Staff Pool'] || [], // ✅ Transforms to staffPoolIds
};
```

**Note:** This function is NOT exported! Need to either:
1. Export it from job-service.ts, OR
2. Import the entire job-service module dynamically

---

## 📊 Testing After Fix

### Test Case 1: Patient WITH Staff Pool (3 employees)
```
1. Create patient in Airtable with 3 employees in Related Staff Pool
2. Leave job open via voice call
3. Check logs: Should show "Filtered employees by staff pool"
4. Check logs: filteredCount should be 3
5. Verify: 3 SMS sent (Wave 1)
```

### Test Case 2: Patient WITHOUT Staff Pool
```
1. Patient exists but Related Staff Pool is empty
2. Leave job open
3. Check logs: "No staff pool defined for patient"
4. Verify: NO SMS sent (expected)
5. Portal shows warning banner
```

### Test Case 3: Patient Not Found
```
1. Invalid patient ID
2. Leave job open
3. Check logs: "Patient not found" or fetch error
4. Falls back to empty staffPoolIds
5. No SMS sent
```

---

## 🎯 Summary

### The Problem:
❌ Hardcoded `staffPoolIds: []` in temporary patient objects  
❌ Never fetching actual patient data from Airtable  
❌ Filter sees empty array → returns no employees → no SMS

### The Solution:
✅ Fetch patient record with `airtableClient.getPatientById(patientId)`  
✅ Transform with `transformPatientRecord(record)`  
✅ Use real staffPoolIds from Airtable  
✅ Filter works correctly → SMS sent to staff pool

### Required Code Changes:
1. **reason-phase.ts**: Replace temporary patient with Airtable fetch
2. **dtmf-router.ts**: Replace temporary patient with Airtable fetch
3. **job-service.ts**: Export `transformPatientRecord` function (if not using dynamic import)

---

## ⚠️ Critical Note

The temporary patient objects were created as a quick fix for the TypeScript error, but they broke the SMS functionality because `staffPoolIds` is always empty.

The correct approach is to **fetch the actual patient record from Airtable** so we have the real Related Staff Pool data.

---

**Status:** Analysis Complete - Code changes needed in 2 files

