# Update Status Action

## Business Rules
Defines the rules and validation for status update operations on job records.

## Valid Status Transitions
Status changes must follow business logic to maintain data integrity:

- **From PENDING**: Can transition to IN_PROGRESS, ON_HOLD, or CANCELLED
- **From IN_PROGRESS**: Can transition to ON_HOLD, COMPLETED, or CANCELLED  
- **From ON_HOLD**: Can transition to IN_PROGRESS or CANCELLED
- **From COMPLETED**: No transitions allowed (final state)
- **From CANCELLED**: No transitions allowed (final state)

## Validation Rules
Before executing status update:

1. **Current Status Check**: Verify job's current status allows transition
2. **Business Logic**: Apply any job-type specific rules
3. **Permission Check**: Ensure user can modify this job
4. **Concurrent Modification**: Check for conflicts with other updates

## Required Information
- Job ID (target record)
- New status value
- Current status (for validation)
- User context (for permissions)
- Reason (optional but recommended)

## Execution Steps
1. Validate status transition is allowed
2. Apply business rule validations
3. Update job record in data store
4. Generate history line entry
5. Return success confirmation or error

## History Line Format
```
"---- | YYYY-MM-DD HH:mm:ss | Event: Status Update | Source: IVR | Details: Changed from {previous} to {new}"
```

## Error Scenarios
- **Invalid Transition**: Status change not allowed by business rules
- **Job Not Found**: Target job record doesn't exist
- **Permission Denied**: User lacks permission to update job
- **Concurrent Modification**: Job was modified by another process
- **System Error**: Database or external service failure

## Side Effects
- Job's `updatedDate` timestamp is refreshed
- History entry is appended to job record
- Assignee notifications may be triggered (if configured)
- Workflow automation may be initiated (if configured)

## TODO
- Define job-type specific status rules
- Implement notification triggers for status changes
- Add audit logging for status transitions
