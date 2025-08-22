# Status/Date/Assignee Validation Rules

## Status Validation
Define allowed status values and transition rules for job records.

### Valid Status Values
- "Pending" - Initial state for new jobs
- "In Progress" - Active work being performed
- "On Hold" - Temporarily paused
- "Completed" - Successfully finished
- "Cancelled" - Terminated without completion

### Status Transition Rules
- **From Pending**: Can go to In Progress, On Hold, or Cancelled
- **From In Progress**: Can go to On Hold, Completed, or Cancelled
- **From On Hold**: Can go to In Progress or Cancelled
- **From Completed**: Cannot transition (final state)
- **From Cancelled**: Cannot transition (final state)

## Date Validation
Rules for scheduled date updates and validation.

### Date Rules
- Must be future date (not today or past)
- Business days only (Monday-Friday) unless override specified
- Cannot be more than 1 year in advance
- Respect business hours (8 AM - 6 PM default)

### Holiday Handling
- Exclude known holidays from scheduling
- Configurable holiday calendar per region
- Automatic adjustment to next business day

## Assignee Validation
Rules for validating assignee updates.

### Assignee Rules
- Must exist in company directory/Airtable
- Must be active (not terminated or on leave)
- Must have appropriate permissions for job type
- Name format validation (First Last, no special chars)

### Assignment Constraints
- Cannot assign to self (via voice system)
- Check workload limits per assignee
- Validate skill requirements match job needs

## Validation Functions
- `validateStatusTransition(current, requested)` - Check if transition allowed
- `validateScheduleDate(date, jobType)` - Comprehensive date validation
- `validateAssignee(name, jobRequirements)` - Assignee eligibility check
- `getValidationErrors(field, value, context)` - Unified validation

## TODO
- Implement configurable validation rules
- Add support for custom business rules
- Create validation rule testing framework
