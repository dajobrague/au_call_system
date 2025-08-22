# State DTO Shapes

## Call State Structure
Define the structure for managing call state throughout the conversation.

### Core Call State
```typescript
interface CallState {
  callSid: string;               // Twilio call identifier
  stage: Stage;                  // Current FSM stage
  attemptCount: number;          // Retry attempts for current stage
  lastUpdated: Date;             // State modification timestamp
  language: 'es' | 'en';         // User's language preference
}
```

### Collected Data State
```typescript
interface CollectedDataState extends CallState {
  clientId?: string;             // Collected client identifier
  jobNumber?: string;            // Collected job number
  actionType?: ActionType;       // Requested action type
  actionValue?: string;          // Action-specific value
  confirmationPending?: boolean; // Waiting for user confirmation
}
```

### Job Context State
```typescript
interface JobContextState extends CollectedDataState {
  jobData?: JobRecord;           // Retrieved job information
  validationErrors?: string[];   // Current validation issues
  lastAction?: Action;           // Most recent action performed
}
```

## FSM Stage Enum
```typescript
type Stage = 
  | 'COLLECT_CLIENT_ID'
  | 'COLLECT_JOB_NUMBER'
  | 'CONFIRM_JOB'
  | 'ASK_ACTION'
  | 'COLLECT_ACTION_VALUE'
  | 'CONFIRM_ACTION'
  | 'EXECUTE_ACTION'
  | 'GOODBYE'
  | 'ERROR_RECOVERY';
```

## State Transitions
Structure for managing stage transitions.

### Transition Request
```typescript
interface StateTransition {
  fromStage: Stage;
  toStage: Stage;
  trigger: TransitionTrigger;
  timestamp: Date;
}
```

### Transition Trigger
```typescript
type TransitionTrigger = 
  | 'USER_INPUT_VALID'
  | 'USER_INPUT_INVALID'
  | 'USER_CONFIRMATION_YES'
  | 'USER_CONFIRMATION_NO'
  | 'ACTION_SUCCESS'
  | 'ACTION_FAILED'
  | 'TIMEOUT'
  | 'ERROR';
```

## State Persistence
Redis storage format and TTL management.

### Redis State Key
Pattern: `call_state:{callSid}`

### State TTL
Default: 3600 seconds (1 hour)

## TODO
- Define state serialization format
- Add state migration support for schema changes
- Implement state compression for large contexts
