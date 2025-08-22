# Retries and Errors E2E Test

## Test Scenarios
Comprehensive testing of retry logic, error handling, and system resilience.

## Input Validation Retries

### Invalid Client ID Format
- **User**: "ABC" (too short)
- **System**: "Client identifier should be at least 3 characters. Please try again."
- **User**: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123456789" (too long)
- **System**: "Client identifier is too long. Please provide a shorter identifier."
- **User**: "ABC123" (valid)
- **Flow**: Continues normally

### Invalid Job Number Format
- **User**: "JOB" (no number)
- **System**: "Please provide a job number with digits."
- **User**: "12345678901234567890123" (too long)
- **System**: "Job number is too long. Please try again."
- **User**: "456" (valid)
- **Flow**: Continues normally

## Speech Recognition Errors

### Unclear Speech Input
- **User**: [mumbled/unclear speech]
- **System**: "I didn't understand that. Please speak clearly and try again."
- **User**: [still unclear]
- **System**: "I'm having trouble understanding. Please speak slowly and clearly."
- **User**: "ABC123" (clear speech)
- **Flow**: Continues normally

### Timeout Scenarios
- **System**: "Please provide your client identifier."
- **User**: [silence for 5+ seconds]
- **System**: "I didn't hear anything. Please provide your client identifier."
- **User**: [continues silence]
- **System**: "I'm not receiving any input. Please try calling back. Goodbye."

## System Error Recovery

### Airtable API Temporary Failure
- **User**: Provides valid client ID and job number
- **System**: [Airtable returns 500 error]
- **System**: "I'm experiencing a temporary issue. Let me try that again."
- **System**: [Retry succeeds]
- **Flow**: Continues with job confirmation

### Redis State Loss
- **Scenario**: Redis connection lost mid-call
- **System**: Attempts to rebuild state from call context
- **Recovery**: Ask user to repeat last input if state cannot be recovered
- **Fallback**: Graceful degradation with apology and callback offer

### S3 Upload Failure
- **Scenario**: Recording upload to S3 fails
- **System**: Records action successfully in Airtable
- **System**: Adds history note: "Recording pending upload"
- **Recovery**: Background retry mechanism attempts upload
- **Monitoring**: Alerts operations team of upload failures

## Network and Timeout Errors

### Slow API Responses
- **Scenario**: Airtable API responds slowly (>30s)
- **System**: Provides interim feedback: "Please hold while I look that up"
- **Recovery**: Extends call timeout during API operations
- **Fallback**: If timeout exceeded, offer callback

### Complete Network Failure
- **Scenario**: All external APIs unavailable
- **System**: "I'm experiencing technical difficulties and cannot process your request right now. Please try calling back in a few minutes."
- **Action**: Logs incident for immediate investigation

## Validation and Business Rule Errors

### Invalid Status Transition
- **User**: Wants to change status from "Completed" to "In Progress"
- **System**: "That status change is not allowed. Completed jobs cannot be reopened through this system. Please contact support."
- **Recovery**: Offer alternative actions or end call

### Invalid Scheduled Date
- **User**: Wants to schedule job for "yesterday"
- **System**: "The scheduled date must be in the future. Please provide a future date."
- **Recovery**: Allow user to provide corrected date

## Maximum Retry Scenarios

### Persistent Invalid Input
- Track retry attempts across all input types
- After 3 failed attempts for any single field, provide additional guidance
- After 5 total failed attempts in call, escalate to human support
- Maintain user patience with empathetic responses

### System Error Accumulation
- Multiple system errors in single call trigger special handling
- Offer callback when system issues persist
- Log high-priority incidents for immediate response

## Expected Behaviors
- **Graceful Degradation**: System never crashes, always provides feedback
- **Clear Communication**: Error messages guide user toward successful completion
- **Appropriate Escalation**: Complex issues routed to human support
- **State Preservation**: No data loss during error conditions
- **Monitoring Integration**: All errors logged for operational visibility

## TODO
- Implement chaos engineering tests for resilience validation
- Add performance testing under error conditions
- Create error pattern analysis for system improvement
