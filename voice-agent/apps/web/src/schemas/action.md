# Action DTO Shapes

## Action Types
Define the structure for all possible actions that can be performed on Job records.

### Base Action Interface
```typescript
interface BaseAction {
  type: ActionType;
  jobId: string;
  timestamp: Date;
  source: 'IVR' | 'WEB' | 'API';
}
```

### Update Status Action
```typescript
interface UpdateStatusAction extends BaseAction {
  type: 'UPDATE_STATUS';
  newStatus: JobStatus;
  previousStatus: JobStatus;
  reason?: string;
}
```

### Update Scheduled Date Action
```typescript
interface UpdateScheduledDateAction extends BaseAction {
  type: 'UPDATE_SCHEDULED_DATE';
  newDate: Date;
  previousDate?: Date;
  timezone: string;
}
```

### Update Assignee Action
```typescript
interface UpdateAssigneeAction extends BaseAction {
  type: 'UPDATE_ASSIGNEE';
  newAssignee: string;
  previousAssignee?: string;
  notifyAssignee: boolean;
}
```

### Add Note Action
```typescript
interface AddNoteAction extends BaseAction {
  type: 'ADD_NOTE';
  noteContent: string;
  category?: 'GENERAL' | 'TECHNICAL' | 'CLIENT_COMMUNICATION';
}
```

## Action Results
Structure for action execution results.

### Success Result
```typescript
interface ActionSuccess {
  success: true;
  action: Action;
  historyLine: string;
  confirmationMessage: string;
}
```

### Error Result
```typescript
interface ActionError {
  success: false;
  error: string;
  errorCode: 'VALIDATION_FAILED' | 'PERMISSION_DENIED' | 'NETWORK_ERROR';
  retryable: boolean;
}
```

## TODO
- Link to domain types in packages/domain/
- Add validation schemas for each action type
- Define action serialization for audit logs
