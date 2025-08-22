# Update Assignee Action

## Business Rules
Defines validation and execution rules for job assignee changes.

## Assignee Validation Requirements
Assignees must meet eligibility criteria:

1. **Exists in System**: Must be valid user/employee in directory
2. **Active Status**: Cannot assign to terminated or inactive users
3. **Appropriate Skills**: Must have required skills for job type
4. **Workload Limits**: Respect maximum concurrent job assignments
5. **Permission Level**: Must have access to job's client/project

## Required Information
- Job ID (target record)
- New assignee name/identifier
- Current assignee (for history and notifications)
- User permissions (who is making the change)
- Job requirements (for skill validation)

## Validation Steps
1. **Assignee Lookup**: Verify assignee exists in system
2. **Status Check**: Confirm assignee is active/available
3. **Skill Validation**: Check required skills match job needs
4. **Workload Check**: Ensure not exceeding assignment limits
5. **Permission Check**: Verify user can reassign this job

## Name Format Handling
- **Input Normalization**: Handle various name formats
- **Case Sensitivity**: Convert to standard capitalization
- **Partial Matching**: Support "John" → "John Smith" resolution
- **Disambiguation**: Handle multiple matches gracefully

## Execution Process
1. Validate new assignee meets all criteria
2. Check current assignee for notification
3. Update job record with new assignee
4. Generate history entry with details
5. Trigger notifications to relevant parties

## History Line Format
```
"---- | YYYY-MM-DD HH:mm:ss | Event: Assignee Update | Source: IVR | Details: Reassigned from {previous} to {new}"
```

## Special Cases
- **Initial Assignment**: "Assigned to {assignee}" (no previous)
- **Unassigning**: "Unassigned (was {previous})"
- **Self Assignment**: May be restricted by business rules
- **Manager Override**: Special permissions for management reassignment

## Notification Triggers
- **Previous Assignee**: Notify of reassignment
- **New Assignee**: Notify of new assignment
- **Manager/Supervisor**: Notify of assignment changes
- **Client**: Notify if customer-facing change

## Error Scenarios
- **Assignee Not Found**: Invalid name/identifier
- **Inactive Assignee**: Person no longer active
- **Skill Mismatch**: Lacks required capabilities
- **Workload Exceeded**: Too many concurrent assignments
- **Permission Denied**: User cannot reassign this job

## Integration Points
- **HR System**: Validate employee status and skills
- **Project Management**: Check role assignments
- **Notification System**: Send assignment alerts
- **Calendar System**: Update assignee schedules

## TODO
- Define skill requirement matching logic
- Implement workload balancing algorithms
- Add manager approval workflow for sensitive reassignments
