# SMS Notification Issue - Root Cause Analysis

## Executive Summary

**Issue:** SMS notifications are not being sent when jobs are left open.

**Root Cause:** The code is querying employees using the wrong Airtable field name.

**Status:** ✗ BROKEN - Code needs to be fixed

---

## Detailed Analysis

### Test Job Details
- **Job ID:** `reclDXqGHA1A9o1Jn`
- **Status:** Open
- **Patient:** Carol Perry (`recKkIJDXnPbHrrd1`)
- **Provider:** A Plus Care (`recexHQJ13oafJkxZ`)

### What We Found

#### 1. Job Occurrence Structure
The job occurrence has the Provider ID, but in a **lookup field**:
```
job.fields["recordId (from Provider) (from Patient (Link))"] = ["recexHQJ13oafJkxZ"]
```

NOT in:
```
job.fields["Provider"] = undefined  // This field doesn't exist!
```

#### 2. Employee Query Problem
The current code in `src/services/airtable/client.ts` queries employees like this:

```typescript
// CURRENT (WRONG)
async findEmployeesByProvider(providerId: string): Promise<EmployeeRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({Provider}))`;
  // ...
}
```

But employees are linked via the field **`recordId (from Provider)`**, NOT `Provider`.

#### 3. Proof

**Wrong query** (current code):
```
FIND('recexHQJ13oafJkxZ', ARRAYJOIN({Provider}))
Result: 0 employees found ❌
```

**Correct query** (what it should be):
```
AND(FIND('recexHQJ13oafJkxZ', ARRAYJOIN({recordId (from Provider)})), {Active} = TRUE())
Result: 12 employees found ✓
```

### Employees Who Should Receive SMS

When fixed, these 12 employees will receive SMS notifications:

1. **Rabin Sunar** - +61450576979 (PIN: 2004)
2. **Pratik Acharya** - +61450514350 (PIN: 2009)
3. **Sapana Naharki** - +61402260252 (PIN: 2010)
4. **Prakriti Bastakoti** - +61405327367 (PIN: 2006)
5. **David Bracho** - +522281957913 (PIN: 2002)
6. **Manju Serpuja** - +61432587838 (PIN: 2005)
7. **Sajita Neupane** - +61415270026 (PIN: 2001)
8. **Sam Wagle** - +61450236063 (PIN: 2001)
9. **Yukriti Baral** - +61406924452 (PIN: 2008)
10. **Suchin KC** - +614408045507 (PIN: 2007)
11. **Rasmi Sunar** - +61424702001 (PIN: 2003)
12. **Saloni Gurung** - +61402605621 (PIN: 2002)

---

## Required Fixes

### Fix #1: Update Employee Query (CRITICAL)

**File:** `voice-agent/src/services/airtable/client.ts`

**Function:** `findEmployeesByProvider()`

**Current code (line ~742):**
```typescript
async findEmployeesByProvider(providerId: string): Promise<EmployeeRecord[]> {
  const filterFormula = `FIND('${providerId}', ARRAYJOIN({Provider}))`;
  
  return withRetry(async () => {
    const response = await makeAirtableRequest<EmployeeRecord['fields']>('Employees', {
      filterByFormula: filterFormula,
      maxRecords: 50,
      fields: ['Display Name', 'Employee PIN', 'Provider', 'Phone', 'Job Templates', 'Active', 'Notes']
    });
    
    return response.records as EmployeeRecord[];
  }, `findEmployeesByProvider(${providerId})`);
}
```

**Fixed code:**
```typescript
async findEmployeesByProvider(providerId: string): Promise<EmployeeRecord[]> {
  // Use correct field name and filter for active employees only
  const filterFormula = `AND(FIND('${providerId}', ARRAYJOIN({recordId (from Provider)})), {Active} = TRUE())`;
  
  return withRetry(async () => {
    const response = await makeAirtableRequest<EmployeeRecord['fields']>('Employees', {
      filterByFormula: filterFormula,
      maxRecords: 50,
      fields: ['Display Name', 'Employee PIN', 'recordId (from Provider)', 'Phone', 'Job Templates', 'Active', 'Notes']
    });
    
    return response.records as EmployeeRecord[];
  }, `findEmployeesByProvider(${providerId})`);
}
```

**Changes:**
1. Changed field from `{Provider}` to `{recordId (from Provider)}`
2. Added Active filter: `{Active} = TRUE()` 
3. Updated fields array to include `'recordId (from Provider)'` instead of `'Provider'`

### Fix #2: Update Provider ID Extraction

**File:** `voice-agent/src/services/sms/job-notification-service.ts`

**Function:** `processInstantJobRedistribution()`

The code currently assumes `jobOccurrence.providerId` exists, but for jobs without templates, the Provider ID is in a lookup field.

**Current issue:**
```typescript
const providerEmployees = await this.findProviderEmployees(
  jobOccurrence.providerId,  // This might be undefined!
  originalEmployee.id
);
```

**Needs update to extract from lookup fields:**
```typescript
// Extract provider ID from various possible fields
const providerId = jobOccurrence.providerId
  || jobOccurrence.fields?.['Provider']?.[0]
  || jobOccurrence.fields?.['recordId (from Provider) (from Job Template)']?.[0]
  || jobOccurrence.fields?.['recordId (from Provider) (from Patient (Link))']?.[0];

if (!providerId) {
  logger.error('No provider ID found for job occurrence', {
    occurrenceId: jobOccurrence.id,
    type: 'no_provider_for_sms'
  });
  return {
    success: false,
    employeesNotified: 0,
    error: 'No provider ID found for job'
  };
}

const providerEmployees = await this.findProviderEmployees(
  providerId,
  originalEmployee.id
);
```

---

## Testing After Fix

### Test Script
Use the provided test scripts to verify the fix:

```bash
cd voice-agent

# Run comprehensive diagnosis
npx ts-node --project tsconfig.server.json scripts/final-sms-diagnosis.js reclDXqGHA1A9o1Jn

# Run full SMS simulation (does not actually send SMS)
npx ts-node --project tsconfig.server.json scripts/test-sms-wave-simulation.js reclDXqGHA1A9o1Jn
```

### Expected Results After Fix

✓ Provider ID extracted: `recexHQJ13oafJkxZ`  
✓ Provider found: A Plus Care  
✓ 12 active employees found  
✓ All employees have valid phone numbers  
✓ Wave 1 would send 12 SMS messages immediately  
✓ Wave 2 would send 12 SMS messages after interval  
✓ Wave 3 would send 12 SMS messages after 2x interval  

**Total SMS across all waves:** 36 messages

---

## Additional Findings

### Patient Field
Jobs can have patient in two different fields:
- `Patient (Link)` - used in this job
- `Patient (Lookup)` - used in some other jobs

Code should check both fields.

### Job Template Field
Jobs without templates (direct patient jobs) don't have:
- `job.fields['Job Template']`

But they still need SMS notifications to work.

---

## Scripts Created

1. **`scripts/final-sms-diagnosis.js`** - Diagnoses SMS issues with correct field names
2. **`scripts/test-sms-wave-simulation.js`** - Simulates full 3-wave SMS system
3. **`scripts/comprehensive-sms-diagnosis.js`** - General SMS system diagnostics
4. **`scripts/check-employees-correct.js`** - Verifies employee query logic

---

## Priority

**CRITICAL** - This completely breaks SMS notifications for all jobs.

## Estimated Fix Time

- Code changes: 15 minutes
- Testing: 15 minutes  
- Deployment: 5 minutes

**Total: ~35 minutes**

---

## Deployment Checklist

- [ ] Update `findEmployeesByProvider()` in `client.ts`
- [ ] Update provider ID extraction in `job-notification-service.ts`
- [ ] Test with diagnostic scripts
- [ ] Deploy to Railway
- [ ] Monitor first SMS wave in production logs
- [ ] Verify SMS delivery to employees

---

**Document Created:** December 16, 2025  
**Issue Status:** Identified - Awaiting Fix  
**Impact:** HIGH - All SMS notifications currently broken

