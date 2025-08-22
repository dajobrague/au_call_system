# Adapter Unit Tests

## Mapping Sanity Checks
Test cases to ensure adapters correctly transform data between domain models and external services.

## Airtable Adapter Tests

### Job Record Mapping (Domain → Airtable)
```
Input Domain Job:
{
  id: "rec123abc",
  jobNumber: "456",
  clientId: "ABC123",
  status: "IN_PROGRESS",
  scheduledDate: new Date("2024-03-15"),
  assignee: "John Smith",
  jobHistory: "Previous history...",
  createdDate: new Date("2024-03-01"),
  updatedDate: new Date("2024-03-10")
}

Expected Airtable Fields:
{
  "job_number": "456",
  "client_unique_id": "ABC123",
  "status": "In Progress",
  "scheduled_date": "2024-03-15",
  "assignee": "John Smith",
  "job_history": "Previous history...",
  "created_date": "2024-03-01T00:00:00.000Z",
  "updated_date": "2024-03-10T00:00:00.000Z"
}
```

### Job Record Mapping (Airtable → Domain)
```
Input Airtable Record:
{
  id: "rec123abc",
  fields: {
    "job_number": "789",
    "client_unique_id": "XYZ789",
    "status": "Completed",
    "scheduled_date": "2024-03-20",
    "assignee": "María García",
    "job_history": "History content...",
    "created_date": "2024-03-01T00:00:00.000Z"
  }
}

Expected Domain Job:
{
  id: "rec123abc",
  jobNumber: "789",
  clientId: "XYZ789",
  status: "COMPLETED",
  scheduledDate: new Date("2024-03-20"),
  assignee: "María García",
  jobHistory: "History content...",
  createdDate: new Date("2024-03-01"),
  updatedDate: undefined
}
```

### Field Name Mapping Tests
```
Test field constant resolution:
- JOBS_TABLE → "Jobs" (from env or default)
- JOB_NUMBER_FIELD → "job_number" (from env or default)
- STATUS_FIELD → "status" (from env or default)

Test custom field names:
- env.AIRTABLE_JOB_NUMBER_FIELD = "custom_job_id"
- Mapping should use "custom_job_id" instead of "job_number"
```

### Status Value Mapping
```
Domain → Airtable:
"IN_PROGRESS" → "In Progress"
"ON_HOLD" → "On Hold"
"COMPLETED" → "Completed"
"CANCELLED" → "Cancelled"
"PENDING" → "Pending"

Airtable → Domain:
"In Progress" → "IN_PROGRESS"
"On Hold" → "ON_HOLD"
"Completed" → "COMPLETED"
```

## Redis State Adapter Tests

### Call State Serialization
```
Input Call State:
{
  callSid: "CA123abc",
  stage: "CONFIRM_JOB",
  attemptCount: 2,
  clientId: "ABC123",
  jobNumber: "456",
  jobData: { /* job object */ },
  lastUpdated: new Date("2024-03-15T14:30:22Z")
}

Expected Redis Value:
{
  "callSid": "CA123abc",
  "stage": "CONFIRM_JOB",
  "attemptCount": 2,
  "clientId": "ABC123",
  "jobNumber": "456",
  "jobData": { /* serialized job */ },
  "lastUpdated": "2024-03-15T14:30:22.000Z"
}
```

### State Key Generation
```
Input: callSid = "CA123abc456def"
Expected Key: "call_state:CA123abc456def"

Input: callSid = "CAshortid"
Expected Key: "call_state:CAshortid"
```

### TTL Management
```
Test default TTL: 3600 seconds (1 hour)
Test custom TTL: configurable via environment
Test TTL extension: when call is active
```

## Twilio TwiML Adapter Tests

### Gather TwiML Generation
```
Input: {
  prompt: "Please say your client ID",
  action: "/api/twilio/handle-gather",
  timeout: 5,
  input: ["speech", "dtmf"]
}

Expected TwiML:
<Response>
  <Gather action="/api/twilio/handle-gather" timeout="5" input="speech dtmf">
    <Say voice="alice" language="es-MX">Please say your client ID</Say>
  </Gather>
</Response>
```

### Say-Only TwiML Generation
```
Input: {
  message: "Thank you for calling",
  voice: "alice",
  language: "es-MX"
}

Expected TwiML:
<Response>
  <Say voice="alice" language="es-MX">Thank you for calling</Say>
  <Hangup/>
</Response>
```

### Redirect TwiML Generation
```
Input: {
  url: "/api/twilio/handle-gather?stage=collect_job_number"
}

Expected TwiML:
<Response>
  <Redirect>/api/twilio/handle-gather?stage=collect_job_number</Redirect>
</Response>
```

## S3 Adapter Tests

### Recording Key Generation
```
Input: {
  callSid: "CA123abc456def",
  jobNumber: "789",
  timestamp: new Date("2024-03-15T14:30:22Z")
}

Expected Key: "recordings/2024/03/15/CA123abc456def-789.mp3"
```

### Signed URL Generation
```
Input: {
  key: "recordings/2024/03/15/CA123abc456def-789.mp3",
  expirationMinutes: 15
}

Expected: Valid signed URL with 15-minute expiration
Test: URL should be accessible before expiration
Test: URL should be inaccessible after expiration
```

## Error Handling Tests

### Invalid Field Names
```
Test: Airtable field doesn't exist
Expected: Graceful error with clear message
Action: Don't crash, return error result
```

### Data Type Mismatches
```
Test: Date field receives string that can't be parsed
Expected: Validation error with specific field name
Action: Return error, don't attempt update
```

### Network Failures
```
Test: Airtable API returns 500 error
Expected: Retry logic with exponential backoff
Action: Return error after max retries exceeded
```

### Missing Required Fields
```
Test: Job record missing required job_number
Expected: Validation error before API call
Action: Fast fail with clear error message
```

## Data Validation Tests

### Required Field Validation
```
Test: Creating job without jobNumber
Expected: Validation error before Airtable call

Test: Updating with empty status
Expected: Validation error with field name
```

### Format Validation
```
Test: Invalid date format in scheduledDate
Expected: Parse error with correction guidance

Test: Invalid status value
Expected: Enum validation error with allowed values
```

## TODO
- Add performance tests for large data sets
- Test concurrent access patterns
- Add comprehensive error scenario coverage
