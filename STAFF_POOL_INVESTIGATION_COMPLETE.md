# Staff Pool SMS Notification - Complete Investigation Report

## 📊 Investigation Status: ✅ COMPLETE

Date: December 27, 2025

---

## 🎯 Objective

Modify SMS notification system to send open job notifications ONLY to employees in the patient's "Related Staff Pool" instead of ALL organization employees.

---

## 🔍 Current System Architecture

### 1. **SMS Notification Entry Points**

#### Entry Point A: Instant Wave 1 (Immediate)
**Location:** `voice-agent/src/services/sms/job-notification-service.ts`
**Function:** `processInstantJobRedistribution()`
**Line:** ~343-547

**Triggered when:**
- Employee leaves a job open via voice call
- Two call paths trigger this:
  - `voice-agent/src/fsm/phases/reason-phase.ts` (line 316)
  - `voice-agent/src/websocket/dtmf-router.ts` (line 537)

**Current Flow:**
```typescript
processInstantJobRedistribution(jobOccurrence, jobTemplate, patient, reason, originalEmployee)
  ↓
findProviderEmployees(providerId, excludeEmployeeId) // Gets ALL employees
  ↓
notifyEmployeesOfOpenJob(employees, jobDetails) // Sends SMS to ALL
  ↓
Schedules Wave 2 & 3 via Bull Queue
```

#### Entry Point B: Scheduled Waves 2 & 3
**Location:** `voice-agent/src/services/sms/wave-processor.ts`
**Function:** `processScheduledWave()`
**Line:** ~17-183

**Triggered when:**
- Bull Queue worker processes delayed wave jobs
- Scheduled automatically by Wave 1

**Current Flow:**
```typescript
processScheduledWave(waveJob)
  ↓
Check if job still "Open"
  ↓
findProviderEmployees(providerId) // Gets ALL employees
  ↓
Send SMS to ALL employees
  ↓
If Wave 3 & still Open → Mark as UNFILLED_AFTER_SMS
```

---

### 2. **Employee Fetching Logic**

**Function:** `findProviderEmployees(providerId, excludeEmployeeId?)`
**Location:** `voice-agent/src/services/sms/job-notification-service.ts` (line 46)

**Current Implementation:**
```typescript
async findProviderEmployees(providerId: string, excludeEmployeeId?: string) {
  // Query ALL employees for this provider
  const employeeRecords = await airtableClient.findEmployeesByProvider(providerId);
  
  // Filter active + with phone
  const allEmployees = employeeRecords
    .filter(record => record.fields['Active'] !== false)
    .filter(record => record.fields['Phone'])
    .map(record => ({ id, name, pin, phone, active }));
  
  // Exclude original employee who left job open
  const excludedFiltered = excludeEmployeeId 
    ? allEmployees.filter(emp => emp.id !== excludeEmployeeId)
    : allEmployees;
    
  return filterValidPhoneNumbers(excludedFiltered);
}
```

**Airtable Query:**
```typescript
// voice-agent/src/services/airtable/client.ts (line 742)
async findEmployeesByProvider(providerId: string) {
  const filterFormula = `AND(
    FIND('${providerId}', ARRAYJOIN({recordId (from Provider)})), 
    {Active} = TRUE()
  )`;
  // Returns ALL active employees for provider
}
```

---

### 3. **Patient Data Flow**

#### How Jobs Link to Patients:
**Job Occurrence Fields:**
- `Patient (Link)`: Array of patient record IDs
- `Patient (Lookup)`: Alternate patient field
- `Patient TXT`: Lookup showing patient name

**Extraction Code:**
```typescript
// voice-agent/app/api/job/[id]/route.ts (line 129)
const patientId = jobOccurrence.fields['Patient']?.[0]
  || jobOccurrence.fields['Patient (Link)']?.[0]
  || jobOccurrence.fields['Patient (Lookup)']?.[0];
```

#### Patient Data Fetching:
**Function:** `getPatientById(patientId)`
**Location:** `voice-agent/src/services/airtable/client.ts` (line 490)

**Returns:** Full patient record from Airtable (all fields)

**Transformation:**
```typescript
// voice-agent/src/services/airtable/job-service.ts (line 44)
function transformPatientRecord(record: PatientRecord): Patient {
  return {
    id: record.id,
    name: fields['Patient Full Name'],
    patientId: fields['Patient ID'],
    phone: fields['Phone'],
    dateOfBirth: fields['DOB'],
    address: fields['Address'],
    notes: fields['Important Notes'],
    providerId: fields['Provider']?.[0],
    active: fields['Active'] !== false,
    // ⚠️ MISSING: Related Staff Pool field
  };
}
```

---

### 4. **TypeScript Type Definitions**

#### Patient Types:
**Location:** `voice-agent/src/services/airtable/types.ts`

**Airtable Fields (Line 89):**
```typescript
export interface PatientFields {
  'Patient Full Name': string;
  'Patient ID': number;
  'DOB': string;
  'Phone': string;
  'Address'?: string;
  'Important Notes'?: string;
  'Provider': string[];
  'Job Templates': string[];
  'Active'?: boolean;
  // ⚠️ MISSING: 'Related Staff Pool'?: string[];
}
```

**Application Interface (Line 169):**
```typescript
export interface Patient {
  id: string;
  name: string;
  patientId: number;
  phone: string;
  dateOfBirth: string;
  address?: string;
  notes?: string;
  providerId: string;
  active: boolean;
  // ⚠️ MISSING: staffPoolIds: string[];
}
```

---

## 📋 Required Changes Summary

### Phase 2: Add Warning UI
**Files to Modify:**
- `provider-portal/components/data-entry/PatientsManagement.tsx`
  - Add warning banner when `Related Staff Pool` is empty
  - Show: "⚠️ No one will receive open job notifications because there is no staffing pool associated with this patient yet"

### Phase 3A: Update Type Definitions
**File:** `voice-agent/src/services/airtable/types.ts`

**Changes:**
1. Line ~99: Add to `PatientFields`:
   ```typescript
   'Related Staff Pool'?: string[]; // Array of employee record IDs
   ```

2. Line ~179: Add to `Patient` interface:
   ```typescript
   staffPoolIds: string[]; // Filtered employee IDs for notifications
   ```

### Phase 3B: Update Patient Data Transformation
**File:** `voice-agent/src/services/airtable/job-service.ts`

**Function:** `transformPatientRecord()` (line 44)

**Change:**
```typescript
function transformPatientRecord(record: PatientRecord): Patient {
  return {
    // ... existing fields ...
    staffPoolIds: record.fields['Related Staff Pool'] || [], // Add this line
  };
}
```

### Phase 3C: Create Staff Pool Filter Function
**File:** `voice-agent/src/services/sms/job-notification-service.ts`

**Add New Function:**
```typescript
/**
 * Filter employees by patient's staff pool
 * If no staff pool, return empty array (no notifications)
 */
private filterByStaffPool(
  employees: EmployeeContact[], 
  staffPoolIds: string[]
): EmployeeContact[] {
  // If no staff pool defined, return empty (no notifications)
  if (!staffPoolIds || staffPoolIds.length === 0) {
    logger.warn('No staff pool defined for patient', {
      type: 'no_staff_pool'
    });
    return [];
  }
  
  // Filter to only employees in staff pool
  const filtered = employees.filter(emp => 
    staffPoolIds.includes(emp.id)
  );
  
  logger.info('Filtered employees by staff pool', {
    totalEmployees: employees.length,
    staffPoolSize: staffPoolIds.length,
    filteredCount: filtered.length,
    type: 'staff_pool_filter'
  });
  
  return filtered;
}
```

### Phase 3D: Modify Wave 1 (Instant Redistribution)
**File:** `voice-agent/src/services/sms/job-notification-service.ts`
**Function:** `processInstantJobRedistribution()`
**Line:** ~407

**Current Code:**
```typescript
// Find all employees for this provider (excluding the original employee)
const providerEmployees = await this.findProviderEmployees(
  resolvedProviderId,
  originalEmployee.id
);
```

**Change To:**
```typescript
// Find all employees for this provider (excluding the original employee)
const allProviderEmployees = await this.findProviderEmployees(
  resolvedProviderId,
  originalEmployee.id
);

// Filter to only staff pool employees
const providerEmployees = this.filterByStaffPool(
  allProviderEmployees,
  patient.staffPoolIds
);

// If no staff pool, log and return early
if (providerEmployees.length === 0) {
  logger.warn('No staff pool employees available - notifications skipped', {
    providerId: resolvedProviderId,
    patientId: patient.id,
    patientName: patient.name,
    type: 'no_staff_pool_no_notifications'
  });
  
  return {
    success: true,
    employeesNotified: 0,
    error: 'No staff pool defined for this patient'
  };
}
```

### Phase 3E: Modify Wave Processor (Waves 2 & 3)
**File:** `voice-agent/src/services/sms/wave-processor.ts`
**Function:** `processScheduledWave()`
**Line:** ~59

**Problem:** Wave processor doesn't have access to patient's staff pool!

**Solution:** Add `staffPoolIds` to `WaveJobData` interface

**Step 1:** Update Wave Job Data Type
**File:** `voice-agent/src/services/queue/sms-wave-queue.ts` (line 13)

```typescript
export interface WaveJobData {
  occurrenceId: string;
  waveNumber: number;
  providerId: string;
  scheduledAt: string;
  timeString: string;
  timezone: string;
  staffPoolIds: string[]; // ⚠️ ADD THIS
  jobDetails: {
    patientFirstName: string;
    patientLastInitial: string;
    patientFullName: string;
    dateTime: string;
    displayDate: string;
    suburb?: string;
    startTime?: string;
    endTime?: string;
  };
}
```

**Step 2:** Pass Staff Pool When Scheduling Waves
**File:** `voice-agent/src/services/sms/job-notification-service.ts` (line 482)

**Current:**
```typescript
const waveData = {
  occurrenceId: jobOccurrence.id,
  providerId: resolvedProviderId,
  scheduledAt: jobOccurrence.scheduledAt,
  timeString: timeString,
  timezone: providerTimezone,
  jobDetails: { ... }
};
```

**Change To:**
```typescript
const waveData = {
  occurrenceId: jobOccurrence.id,
  providerId: resolvedProviderId,
  staffPoolIds: patient.staffPoolIds, // ⚠️ ADD THIS
  scheduledAt: jobOccurrence.scheduledAt,
  timeString: timeString,
  timezone: providerTimezone,
  jobDetails: { ... }
};
```

**Step 3:** Filter in Wave Processor
**File:** `voice-agent/src/services/sms/wave-processor.ts` (line 58-69)

**Current:**
```typescript
// Step 2: Get all employees for this provider
const employees = await jobNotificationService.findProviderEmployees(providerId);

if (employees.length === 0) {
  logger.warn('No employees found for provider', {
    occurrenceId,
    waveNumber,
    providerId,
    type: 'wave_no_employees'
  });
  return;
}
```

**Change To:**
```typescript
// Step 2: Get all employees for this provider
const allEmployees = await jobNotificationService.findProviderEmployees(providerId);

// Filter to staff pool only
const staffPoolIds = waveJob.staffPoolIds || [];
const employees = staffPoolIds.length > 0
  ? allEmployees.filter(emp => staffPoolIds.includes(emp.id))
  : [];

if (employees.length === 0) {
  logger.warn('No staff pool employees found', {
    occurrenceId,
    waveNumber,
    providerId,
    totalProviderEmployees: allEmployees.length,
    staffPoolSize: staffPoolIds.length,
    type: 'wave_no_staff_pool_employees'
  });
  return;
}
```

---

## 🚨 Edge Cases & Considerations

### 1. **Empty Staff Pool**
**Scenario:** Patient has no Related Staff Pool defined
**Behavior:** 
- No SMS sent
- Warning shown in provider portal
- Logged for monitoring

### 2. **Existing Jobs**
**Scenario:** Jobs created before staff pools existed
**Behavior:**
- `staffPoolIds` will be empty array
- No notifications sent
- Provider needs to assign staff pool

### 3. **Employee Not in Pool**
**Scenario:** Job assigned to employee not in staff pool
**Behavior:**
- System still allows assignment
- Only affects notifications
- Staff pool is filter, not authorization

### 4. **Pool vs Provider Mismatch**
**Scenario:** Employee in staff pool but different provider
**Behavior:**
- Won't happen: employees linked to provider
- Staff pool only contains provider's employees

### 5. **Inactive Employees in Pool**
**Scenario:** Staff pool includes inactive employee
**Behavior:**
- Already filtered by `findProviderEmployees`
- Only active employees with phones receive SMS

---

## 📁 Complete File List

### Files to Modify:
1. ✅ `provider-portal/components/data-entry/PatientsManagement.tsx` (Warning UI)
2. `voice-agent/src/services/airtable/types.ts` (Add types)
3. `voice-agent/src/services/airtable/job-service.ts` (Transform patient)
4. `voice-agent/src/services/sms/job-notification-service.ts` (Filter logic + Wave 1)
5. `voice-agent/src/services/sms/wave-processor.ts` (Filter Waves 2 & 3)
6. `voice-agent/src/services/queue/sms-wave-queue.ts` (Wave data type)

### Files to Review (No Changes):
- `voice-agent/src/services/airtable/client.ts` (getPatientById - works as-is)
- `voice-agent/src/fsm/phases/reason-phase.ts` (Trigger point - works as-is)
- `voice-agent/src/websocket/dtmf-router.ts` (Trigger point - works as-is)

---

## ✅ Testing Checklist

### Test Case 1: Patient WITH Staff Pool
- [ ] Create/edit patient with 3 employees in staff pool
- [ ] Leave job open for that patient
- [ ] Verify: Only those 3 employees receive SMS
- [ ] Verify: Wave 2 & 3 also go to same 3 employees only

### Test Case 2: Patient WITHOUT Staff Pool
- [ ] Create/edit patient with empty staff pool
- [ ] Leave job open for that patient
- [ ] Verify: No SMS sent
- [ ] Verify: Warning shown in patient management UI
- [ ] Verify: Logs show "no staff pool" message

### Test Case 3: Large Staff Pool
- [ ] Patient with 10+ employees in pool
- [ ] Leave job open
- [ ] Verify: All 10+ receive SMS (not limited)

### Test Case 4: Job Acceptance
- [ ] Employee in staff pool accepts via SMS
- [ ] Verify: Waves 2 & 3 cancelled
- [ ] Verify: No duplicate notifications

### Test Case 5: Mixed Scenarios
- [ ] Multiple jobs, different patients
- [ ] Some with pools, some without
- [ ] Verify: Correct filtering per patient

---

## 🎯 Implementation Order

1. ✅ **Phase 1: Investigation** - COMPLETE
2. **Phase 2: Warning UI** - Add to patients management
3. **Phase 3: Backend Changes** - Update types, filtering, waves
4. **Phase 4: Testing** - Comprehensive validation
5. **Phase 5: Deployment** - Railway + verification

---

## 📊 Impact Analysis

### Performance:
- ✅ **Positive:** Fewer SMS sent = lower Twilio costs
- ✅ **Positive:** Reduced SMS spam for employees
- ⚠️ **Neutral:** Additional filter logic (negligible overhead)

### User Experience:
- ✅ **Better:** Employees only get relevant notifications
- ✅ **Better:** Clear warning when no pool assigned
- ✅ **Better:** More targeted communication

### System Complexity:
- ⚠️ **Slight increase:** Additional filtering logic
- ✅ **Well contained:** Changes isolated to notification service
- ✅ **Backward compatible:** Empty pool = no notifications (safe)

---

## 🔗 Related Documentation

- `STAFF_POOL_FEATURE_PLAN.md` - Feature requirements
- `SMS_WAVE_IMPLEMENTATION_SUMMARY.md` - Current wave system
- `SMS_FIX_SUMMARY.md` - Previous SMS fixes
- Provider Portal: Patient management UI changes

---

**Investigation Complete** ✅  
**Ready for Phase 2: Implementation** 🚀

