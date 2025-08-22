# Redis Integration

## State Persistence Contract
Manages temporary call state during voice interactions.

## Operations
- `getCallState(callSid)` - Retrieve current call state
- `setCallState(callSid, state)` - Store/update call state
- `deleteCallState(callSid)` - Clean up completed calls
- `extendTTL(callSid, seconds)` - Extend state expiration

## State Schema
```typescript
interface CallState {
  stage: Stage;
  clientId?: string;
  jobNumber?: string;
  attemptCount: number;
  jobData?: JobRecord;
  lastUpdated: Date;
}
```

## Key Strategy
- Pattern: `call_state:{callSid}`
- TTL: 1 hour (calls shouldn't exceed this)
- Cleanup: Automatic expiration + manual cleanup on call end

## Error Handling
- Connection failures: graceful degradation, log warnings
- Serialization errors: validate state schema before storage
- Memory limits: monitor usage, alert if approaching limits

## TODO
- Implement state compression for large job data
- Add state migration support for schema changes
