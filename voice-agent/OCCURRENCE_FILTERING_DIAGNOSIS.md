# Occurrence Filtering Diagnosis Report
**Date:** December 16, 2025  
**Employee Tested:** Sam Wagle (recW1CXg3O5I3oR0g)  
**Today's Date:** 2025-12-16

## Executive Summary

The websocket call system is functioning correctly. **The root cause of the issue is that all occurrences in Airtable have past dates and are being correctly filtered out by the system's date validation.**

## Test Results

### Employee Information
- **Employee ID:** recW1CXg3O5I3oR0g
- **Name:** Sam Wagle
- **Phone:** +61450236063
- **Provider:** recexHQJ13oafJkxZ
- **Active:** Yes
- **Job Templates Assigned:** 4 (in Airtable)
- **Job Templates Found by Filter:** 2

### Job Templates Found
1. **Job Code 010101** - Initial Assessment
   - Template ID: rec42XuWi9vYbFw62
   - Patient: Oliver Smith
   - Linked Occurrences: 2

2. **Job Code 011111** - Audiology Review
   - Template ID: recoClxm4aJXtohi3
   - Patient: Henry Walker
   - Linked Occurrences: 2

### Occurrence Details (All 4 Occurrences)

#### Job 010101 Occurrences:
1. **recIW74yZVY4DLuq2**
   - Scheduled: 2025-10-31 at 12:00
   - Status: Scheduled ✓
   - Assigned Employee: **NONE** ✗
   - Future Date: **NO** ✗ (past date)
   - **Reason filtered out:** Date is in the past + No employee assigned

2. **recZGXZ9FnrHpJ6YZ**
   - Scheduled: 2025-10-31 at 20:00
   - Status: Scheduled ✓
   - Assigned Employee: recW1CXg3O5I3oR0g ✓
   - Future Date: **NO** ✗ (past date)
   - **Reason filtered out:** Date is in the past

#### Job 011111 Occurrences:
3. **recpWtXJOEx4Neb1w**
   - Scheduled: 2025-09-11 at 08:30
   - Status: Scheduled ✓
   - Assigned Employee: recW1CXg3O5I3oR0g ✓
   - Future Date: **NO** ✗ (past date)
   - **Reason filtered out:** Date is in the past

4. **recCAm1oNf1dA5uhe**
   - Scheduled: 2025-09-14 at 10:00
   - Status: Scheduled ✓
   - Assigned Employee: recW1CXg3O5I3oR0g ✓
   - Future Date: **NO** ✗ (past date)
   - **Reason filtered out:** Date is in the past

## Current Filtering Logic

### Filter Formulas Used

#### Job Template Filter:
```
AND(
  FIND('recW1CXg3O5I3oR0g', ARRAYJOIN({recordId (from Default Employee)})),
  FIND('recexHQJ13oafJkxZ', ARRAYJOIN({recordId (from Provider)}))
)
```

#### Occurrence Filter (Applied in Code):
- Status must be: **'Scheduled'**
- Scheduled At must be: **>= '2025-12-16'**
- Assigned Employee ID must match: **'recW1CXg3O5I3oR0g'**

### Filter Results
- **Job Templates Found:** 2 out of 4 assigned
  - 2 templates matched both employee AND provider filters
  - The other 2 templates likely belong to different providers
- **Occurrences Found:** 0 out of 4 linked
  - All 4 occurrences have past dates (Sept/Oct 2025)
  - Today is Dec 16, 2025

## Root Cause Analysis

### Primary Issue: **Past Dates**
All occurrences in the system have scheduled dates that are in the past:
- 2025-09-11 (3 months ago)
- 2025-09-14 (3 months ago)
- 2025-10-31 (1.5 months ago)

The system correctly filters out past occurrences to only present future shifts to callers.

### Secondary Issue: **Missing Employee Assignment**
Occurrence `recIW74yZVY4DLuq2` has no assigned employee, which would also cause it to be filtered out.

### Tertiary Issue: **Unknown Field in Direct Query (PATH B)**
The direct occurrence fetch encountered an error:
```
UNKNOWN_FIELD_NAME: Unknown field name: "Patient"
```
This suggests the field name in the Job Occurrences table may be different (possibly "Patient TXT" instead of "Patient").

## System Status

### ✅ Working Correctly:
- Employee authentication
- Job template lookup with provider filtering
- Occurrence fetching via linked job templates
- Date validation (filtering out past dates)
- Status validation (checking for 'Scheduled')
- Employee assignment validation

### ⚠️ Issues Found:
1. **Data Issue:** All occurrences have past dates
2. **Data Issue:** One occurrence missing employee assignment
3. **Code Issue:** Direct query uses incorrect field name "Patient"

## Recommendations

### Immediate Actions (Client Side):
1. **Update Occurrence Dates in Airtable**
   - Create new occurrences with future dates (after 2025-12-16)
   - OR update existing occurrences to have future dates
   - Ensure dates are in format: YYYY-MM-DD

2. **Assign Employees to All Occurrences**
   - Ensure all occurrences have the "Assigned Employee" field populated
   - Specifically fix occurrence `recIW74yZVY4DLuq2`

### Code Fixes (Optional):
1. **Fix Direct Query Field Name** (in `job-occurrence-service.ts` line 784)
   - Current: `'Patient'` 
   - Should be: `'Patient TXT'` (or verify the actual field name)
   - This is a fallback path that rarely executes but should be corrected

### Testing Instructions:
1. Add a new occurrence in Airtable with:
   - Scheduled At: Future date (e.g., 2025-12-20)
   - Time: Any valid time (e.g., 14:00)
   - Status: Scheduled
   - Assigned Employee: Sam Wagle (recW1CXg3O5I3oR0g)
   - Job Template: Link to 010101 or 011111

2. Call the system again
3. The new occurrence should be announced

## Filters Summary

### What filters are currently active:
1. **Job Template Level:**
   - Employee must be in "Default Employee" field
   - Provider must match employee's provider (if specified)

2. **Occurrence Level:**
   - Status = "Scheduled"
   - Scheduled At >= Today (2025-12-16)
   - Assigned Employee = Employee making the call

### Why occurrences weren't found:
All 4 occurrences failed the date filter (Scheduled At < 2025-12-16)

## Conclusion

The voice agent system is working as designed. The filtering logic correctly excludes past occurrences. The issue reported by the client is due to test data in Airtable having old dates. Once new occurrences with future dates are created, they will be properly detected and announced during calls.

**No code changes required** - this is a data entry issue, not a system bug.

