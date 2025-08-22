# FSM State <-> Redis Storage

## State Serialization Strategy
Manages the conversion between in-memory call state objects and Redis storage format.

## Call State Structure
```typescript
// In-Memory Call State
interface CallState {
  callSid: string;               // Twilio call identifier
  stage: Stage;                  // Current FSM stage
  attemptCount: number;          // Retry attempts for current stage
  clientId?: string;             // Collected client identifier
  jobNumber?: string;            // Collected job number  
  actionType?: ActionType;       // Requested action type
  actionValue?: string;          // Action-specific value
  jobData?: JobRecord;           // Retrieved job information
  lastUpdated: Date;             // State modification timestamp
  language: 'es' | 'en';         // User's language preference
}
```

## Redis Storage Format
```typescript
// Redis Value (JSON string)
{
  "callSid": "CA123abc456def",
  "stage": "CONFIRM_JOB", 
  "attemptCount": 2,
  "clientId": "ABC123",
  "jobNumber": "456",
  "actionType": "UPDATE_STATUS",
  "actionValue": "COMPLETED",
  "jobData": {
    "id": "rec123abc",
    "jobNumber": "456", 
    "status": "IN_PROGRESS",
    // ... serialized job record
  },
  "lastUpdated": "2024-03-15T14:30:22.000Z",
  "language": "es"
}
```

## Key Generation Strategy
```typescript
// Redis Key Pattern
const generateStateKey = (callSid: string): string => {
  return `call_state:${callSid}`;
};

// Examples
generateStateKey("CA123abc456def") → "call_state:CA123abc456def"
generateStateKey("CAshortid")      → "call_state:CAshortid"
```

## Serialization Methods

### State to Redis
```typescript
const serializeCallState = (state: CallState): string => {
  const serialized = {
    ...state,
    lastUpdated: state.lastUpdated.toISOString(),
    jobData: state.jobData ? {
      ...state.jobData,
      createdDate: state.jobData.createdDate.toISOString(),
      updatedDate: state.jobData.updatedDate.toISOString(),
      scheduledDate: state.jobData.scheduledDate?.toISOString()
    } : undefined
  };
  return JSON.stringify(serialized);
};
```

### Redis to State
```typescript
const deserializeCallState = (data: string): CallState => {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    lastUpdated: new Date(parsed.lastUpdated),
    jobData: parsed.jobData ? {
      ...parsed.jobData,
      createdDate: new Date(parsed.jobData.createdDate),
      updatedDate: new Date(parsed.jobData.updatedDate),
      scheduledDate: parsed.jobData.scheduledDate ? 
        new Date(parsed.jobData.scheduledDate) : undefined
    } : undefined
  };
};
```

## TTL Management
```typescript
// Default TTL Configuration
const DEFAULT_TTL = 3600; // 1 hour in seconds

// TTL Extension for Active Calls
const ACTIVE_CALL_TTL = 7200; // 2 hours for long calls

// TTL Based on Stage
const getStageTTL = (stage: Stage): number => {
  switch (stage) {
    case 'COLLECT_CLIENT_ID':
    case 'COLLECT_JOB_NUMBER':
      return 300; // 5 minutes for quick inputs
    case 'CONFIRM_JOB':
    case 'ASK_ACTION':
      return 600; // 10 minutes for decision making
    case 'EXECUTE_ACTION':
      return 1800; // 30 minutes for complex operations
    default:
      return DEFAULT_TTL;
  }
};
```

## State Operations

### Save State
```typescript
const saveCallState = async (callSid: string, state: CallState): Promise<void> => {
  const key = generateStateKey(callSid);
  const serialized = serializeCallState(state);
  const ttl = getStageTTL(state.stage);
  
  await redis.setex(key, ttl, serialized);
};
```

### Get State
```typescript
const getCallState = async (callSid: string): Promise<CallState | null> => {
  const key = generateStateKey(callSid);
  const data = await redis.get(key);
  
  if (!data) {
    return null;
  }
  
  return deserializeCallState(data);
};
```

### Delete State
```typescript
const deleteCallState = async (callSid: string): Promise<void> => {
  const key = generateStateKey(callSid);
  await redis.del(key);
};
```

### Extend TTL
```typescript
const extendCallStateTTL = async (callSid: string, additionalSeconds: number): Promise<void> => {
  const key = generateStateKey(callSid);
  const currentTTL = await redis.ttl(key);
  
  if (currentTTL > 0) {
    await redis.expire(key, currentTTL + additionalSeconds);
  }
};
```

## Data Compression
```typescript
// For large job data, consider compression
const compressJobData = (jobData: JobRecord): string => {
  // Implement compression for large job records
  // Remove unnecessary fields, compress history, etc.
  return JSON.stringify({
    id: jobData.id,
    jobNumber: jobData.jobNumber,
    status: jobData.status,
    // Include only essential fields
  });
};
```

## Error Handling

### Serialization Errors
```typescript
const safeSerialize = (state: CallState): string | null => {
  try {
    return serializeCallState(state);
  } catch (error) {
    console.error('State serialization failed:', error);
    return null;
  }
};
```

### Deserialization Errors
```typescript
const safeDeserialize = (data: string): CallState | null => {
  try {
    return deserializeCallState(data);
  } catch (error) {
    console.error('State deserialization failed:', error);
    return null;
  }
};
```

### Redis Connection Errors
```typescript
const handleRedisError = (error: Error, operation: string): void => {
  console.error(`Redis ${operation} failed:`, error);
  
  // Implement fallback strategies
  if (operation === 'get') {
    // Return null state, force fresh start
    return null;
  } else if (operation === 'set') {
    // Log warning, continue without state persistence
    console.warn('Call state not persisted, may lose progress on reconnection');
  }
};
```

## State Migration
```typescript
// Handle state schema changes
const migrateCallState = (data: any, version: string): CallState => {
  switch (version) {
    case 'v1':
      // Migrate from version 1 to current
      return {
        ...data,
        language: data.language || 'es', // Add missing language field
      };
    case 'v2':
      // Migrate from version 2 to current  
      return {
        ...data,
        actionType: mapOldActionType(data.action), // Rename action field
      };
    default:
      return data;
  }
};
```

## Monitoring and Metrics
```typescript
// Track state operations for monitoring
const recordStateMetric = (operation: string, success: boolean, duration: number): void => {
  // Send metrics to monitoring system
  console.log(`State ${operation}: ${success ? 'SUCCESS' : 'FAILURE'} in ${duration}ms`);
};
```

## TODO
- Implement state compression for large datasets
- Add state versioning for schema evolution
- Create state backup and recovery mechanisms
