# Action Service

## How to Validate/Execute Actions on One Job
Orchestrates action validation and execution within the context of a single Job record.

## Validation Process
1. **Permission Check**: Verify user can modify this job
2. **Field Validation**: Ensure new values are valid for field type
3. **Business Rules**: Apply domain constraints (status transitions, date logic)
4. **Conflict Detection**: Check for concurrent modifications

## Supported Actions
- **Update Status**: Validate status transition is allowed
- **Update Scheduled Date**: Ensure date is future, valid format
- **Update Assignee**: Verify assignee exists in system
- **Add Note**: Append to notes field with timestamp

## Execution Flow
1. Lock job record (optimistic locking via Airtable record version)
2. Apply field updates atomically
3. Generate history line with action details
4. Append history to job_history field
5. Release lock and return confirmation

## Rollback Strategy
- If history append fails: attempt to revert field changes
- If revert fails: log error and alert for manual reconciliation
- Always return user-friendly error messages

## TODO
- Implement optimistic locking mechanism
- Define comprehensive business rule validation
- Add audit logging for all action attempts