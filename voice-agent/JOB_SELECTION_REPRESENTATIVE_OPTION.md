# Job Selection Representative Option Feature

## Overview
This document describes the implementation of a new feature where "Speak to a Representative" is always presented as Option 1 in the job selection menu, with actual jobs numbered starting from Option 2 onwards.

## Client Request
When jobs are found in the system and read out to the caller, the system should:
1. Present "Press 1 to speak to a representative" as the very first option
2. Read all jobs starting from Option 2 onwards (jobs that were previously Option 1, 2, 3... are now Option 2, 3, 4...)

## Implementation Details

### Files Modified

#### 1. **voice-agent/src/fsm/phases/job-selection-phase.ts**
- **Line 56**: Changed job index assignment from `index + 1` to `index + 2`
- **Lines 107-144**: Added handling for Option 1 (transfer to representative)
- **Line 147**: Updated validation range to account for the new Option 1
- **Function `generateJobListMessage` (lines 295-320)**: Updated to include "Press 1 to speak to a representative" as first option

#### 2. **voice-agent/src/handlers/provider-handler.ts**
- **Function `generateSingleProviderGreeting` (lines 37-50)**: Updated job list message generation
  - Single job: "Press 1 to speak to a representative, or Press 2 for [job]"
  - Multiple jobs: "Press 1 to speak to a representative. You have X jobs. Press 2 for... Press 3 for..."
- **Function `generateProviderSelectionGreeting` (lines 88-101)**: Same updates for multi-provider scenario

#### 3. **voice-agent/src/websocket/dtmf-router.ts**
- **Line 316**: Updated job index assignment in `handleProviderSelection` from `index + 1` to `index + 2`
- **Function `handleJobSelection` (lines 327-369)**: Added Option 1 handling
  - Checks if selection is 1
  - Validates transfer number exists
  - Updates state to 'representative_transfer' phase
  - Generates transfer message
- **Function `handleBackToJobSelection` (lines 733-757)**: Updated for returning to job selection
  - Job index assignment: `index + 2`
  - Message generation includes Option 1 for representative

#### 4. **voice-agent/src/handlers/job-handler.ts**
- **Function `selectJob` (lines 24-55)**: Updated validation logic
  - Changed minimum valid selection from 1 to 2
  - Changed maximum from `employeeJobs.length` to `employeeJobs.length + 1`
  - Updated error messages to reflect new numbering

#### 5. **voice-agent/src/websocket/server.ts** (OLD FLOW - commented out)
- **Line 496**: Updated commented-out code for consistency: `index + 2`
- Note: This is in a commented section but updated for future reference

### Behavior Changes

#### Before:
```
Greeting: "You have 3 jobs. Press 1 for Home Care for Smith. Press 2 for Nursing for Jones. Press 3 for Therapy for Brown."
- Option 1: First job
- Option 2: Second job  
- Option 3: Third job
```

#### After:
```
Greeting: "Press 1 to speak to a representative. You have 3 jobs. Press 2 for Home Care for Smith. Press 3 for Nursing for Jones. Press 4 for Therapy for Brown."
- Option 1: Transfer to representative
- Option 2: First job
- Option 3: Second job
- Option 4: Third job
```

### Call Flow for Option 1

When a caller presses 1:
1. System logs "Option 1 selected - Transfer to representative"
2. Validates that `state.provider.transferNumber` exists
3. Updates call state to `representative_transfer` phase
4. Announces "Transferring you to a representative now."
5. Initiates transfer to the configured representative number

If no transfer number is configured, the system responds with:
"Unable to transfer. Please contact your supervisor."

### Edge Cases Handled

1. **Single Job Scenario**
   - Before: "You have one job. Press 1 to select this job."
   - After: "Press 1 to speak to a representative, or Press 2 for [job]."

2. **No Transfer Number**
   - System gracefully handles missing transfer number
   - Provides helpful error message to caller

3. **Invalid Selection**
   - Validates selections are within range [1 to numberOfJobs + 1]
   - Jobs start at index 2, so a system with 3 jobs accepts 1, 2, 3, or 4

4. **Back to Job Selection**
   - When returning to job menu from other phases, Option 1 is maintained

## Testing Recommendations

### Manual Testing
1. **Single Job**: Call in, authenticate, verify "Press 1 for representative or Press 2 for [job]"
2. **Multiple Jobs**: Verify "Press 1 for representative" comes first, jobs numbered from 2
3. **Press 1**: Verify transfer to representative works
4. **Press 2+**: Verify job selection still works correctly
5. **Invalid Options**: Test pressing numbers outside valid range

### Affected User Flows
- ✅ PIN Authentication → Job Selection
- ✅ Provider Selection → Job Selection  
- ✅ Job Options → Back to Job Selection (Option 4)
- ✅ WebSocket DTMF handling
- ✅ FSM phase processing

## Deployment Notes

- No database changes required
- No new environment variables needed
- Backward compatible (uses existing transfer number configuration)
- No breaking changes to external APIs

## Related Files (Not Modified)
- `voice-agent/src/fsm/types.ts` - Type definitions remain compatible
- `voice-agent/src/fsm/constants.ts` - Phase constants unchanged
- Provider transfer number configuration already exists in Airtable

## Date Implemented
December 21, 2025

