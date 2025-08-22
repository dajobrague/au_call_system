# Update Scheduled Date Action

## Business Rules
Defines validation and execution rules for job scheduling date changes.

## Date Validation Rules
Scheduled dates must meet business requirements:

1. **Future Date**: Must be in the future (not today or past)
2. **Business Days**: Typically Monday-Friday unless override specified
3. **Business Hours**: Default 8 AM - 6 PM window for scheduling
4. **Maximum Advance**: Cannot schedule more than 1 year ahead
5. **Holiday Exclusion**: Automatically avoid known holidays

## Time Zone Handling
- Store all dates in UTC for consistency
- Convert to user's timezone for display
- Infer timezone from phone number or explicit setting
- Default to system timezone if unavailable

## Required Information
- Job ID (target record)
- New scheduled date
- Current scheduled date (for history)
- Timezone context
- User permissions

## Validation Steps
1. **Date Format**: Parse and validate date input
2. **Business Rules**: Apply scheduling constraints
3. **Conflict Check**: Verify no resource conflicts (if applicable)
4. **Permission Check**: Ensure user can reschedule this job
5. **Job Status**: Verify job status allows rescheduling

## Execution Process
1. Validate new date meets all business rules
2. Check for scheduling conflicts
3. Update job record with new date
4. Generate formatted history entry
5. Send notifications if configured

## History Line Format
```
"---- | YYYY-MM-DD HH:mm:ss | Event: Date Update | Source: IVR | Details: Rescheduled from {old_date} to {new_date}"
```

## Special Cases
- **No Previous Date**: "Scheduled for {new_date}"
- **Clearing Date**: "Removed scheduled date (was {old_date})"
- **Same Date**: Validation error, no update needed

## Error Scenarios
- **Past Date**: Cannot schedule in the past
- **Holiday**: Selected date is a holiday
- **Weekend**: Business-day-only policy violation
- **Too Far Ahead**: Exceeds maximum scheduling window
- **Format Error**: Date cannot be parsed from user input

## Integration Points
- **Calendar System**: Check for conflicts if integrated
- **Resource Management**: Verify availability if applicable
- **Notification System**: Alert relevant parties of changes

## TODO
- Implement holiday calendar integration
- Add resource conflict checking
- Define timezone detection logic
