# Job Not Found E2E Test

## Test Scenario
User provides valid client ID but non-existent job number, tests error handling and recovery flow.

## Stage-by-Stage Flow

### 1. Call Initiation (COLLECT_CLIENT_ID)
- **System**: "Welcome to the job management system. Please provide your client identifier."
- **User**: "ABC123" (valid client)
- **System**: "Thank you. Now please provide your job number."

### 2. Job Number Collection (COLLECT_JOB_NUMBER)
- **User**: "JOB999" (non-existent job)
- **System**: Attempts lookup in Airtable, job not found

### 3. Error Handling (ERROR_RECOVERY)
- **System**: "I couldn't find job number 999 for your account. Please check the number and try again."
- **User**: "JOB888" (still non-existent)
- **System**: "I still can't find that job number. Please verify the job number and try again."

### 4. Second Retry Attempt
- **User**: "JOB456" (valid job)
- **System**: "Job 456; status In Progress; scheduled date March 15th. Is this correct?"

### 5. Continue with Normal Flow
- Flow continues as in happy-path.md from job confirmation stage

## Alternative: Maximum Retries Exceeded
If user continues providing invalid job numbers:
- **System**: "I've been unable to find the job number you're looking for. Please contact support for assistance. Goodbye."
- **Action**: Call ends gracefully

## Expected Behaviors
- Invalid job lookups return appropriate error messages
- System allows retry attempts (up to configured limit)
- Clear guidance provided for user correction
- Graceful degradation when max retries exceeded
- No partial data corruption in case of failures

## Error Scenarios to Test
- **Non-existent Job**: Job number doesn't exist
- **Wrong Client**: Job exists but belongs to different client
- **Inactive Client**: Client account is deactivated
- **System Error**: Airtable API temporarily unavailable

## Validation Points
- Error messages are user-friendly and actionable
- Retry counter tracks attempts correctly
- State persistence works across retries
- No sensitive information leaked in error messages
- Call state cleaned up properly on termination

## Recovery Patterns
- Allow user to correct input after each error
- Provide hints about valid format when appropriate
- Escalate to human support after multiple failures
- Log errors for operational monitoring

## TODO
- Test all error scenarios systematically
- Validate error message clarity with user testing
- Add retry limit configuration testing
