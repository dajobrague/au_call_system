# Domain <-> Airtable Field Map

## Field Mapping Strategy
Bidirectional mapping between domain JobRecord models and Airtable record fields.

## Domain to Airtable Mapping

### Core Job Fields
```typescript
Domain Field          → Airtable Field
─────────────────────   ──────────────────────
id                    → (record ID, not a field)
jobNumber            → job_number
clientId             → client_unique_id  
status               → status
scheduledDate        → scheduled_date
assignee             → assignee
jobHistory           → job_history
createdDate          → created_date
updatedDate          → updated_date
```

### Status Value Mapping
```typescript
Domain Status         → Airtable Display Value
─────────────────────   ────────────────────────
PENDING              → "Pending"
IN_PROGRESS          → "In Progress"  
ON_HOLD              → "On Hold"
COMPLETED            → "Completed"
CANCELLED            → "Cancelled"
```

### Date Field Handling
```typescript
Domain: Date object (JavaScript Date)
Airtable: ISO 8601 string ("2024-03-15T14:30:00.000Z")

Conversion:
- Domain → Airtable: date.toISOString()
- Airtable → Domain: new Date(isoString)
```

## Field Name Configuration
Field names are configurable via environment variables:

```typescript
const FIELD_MAPPING = {
  jobNumber: process.env.AIRTABLE_JOB_NUMBER_FIELD || 'job_number',
  clientId: process.env.AIRTABLE_CLIENT_ID_FIELD || 'client_unique_id',
  status: process.env.AIRTABLE_STATUS_FIELD || 'status',
  scheduledDate: process.env.AIRTABLE_SCHEDULED_DATE_FIELD || 'scheduled_date',
  assignee: process.env.AIRTABLE_ASSIGNEE_FIELD || 'assignee',
  jobHistory: process.env.AIRTABLE_JOB_HISTORY_FIELD || 'job_history'
};
```

## Airtable to Domain Mapping

### Record Structure Transformation
```typescript
// Airtable Record Input
{
  id: "rec123abc456def",
  fields: {
    "job_number": "456",
    "client_unique_id": "ABC123", 
    "status": "In Progress",
    "scheduled_date": "2024-03-15T14:30:00.000Z",
    "assignee": "John Smith",
    "job_history": "Previous history...",
    "created_date": "2024-03-01T00:00:00.000Z",
    "updated_date": "2024-03-10T12:15:30.000Z"
  }
}

// Domain JobRecord Output
{
  id: "rec123abc456def",
  jobNumber: "456",
  clientId: "ABC123",
  status: "IN_PROGRESS",
  scheduledDate: new Date("2024-03-15T14:30:00.000Z"),
  assignee: "John Smith", 
  jobHistory: "Previous history...",
  createdDate: new Date("2024-03-01T00:00:00.000Z"),
  updatedDate: new Date("2024-03-10T12:15:30.000Z")
}
```

### Status Value Reverse Mapping
```typescript
Airtable Display Value → Domain Status
────────────────────────  ─────────────────
"Pending"               → PENDING
"In Progress"           → IN_PROGRESS
"On Hold"               → ON_HOLD
"Completed"             → COMPLETED
"Cancelled"             → CANCELLED
```

## Null/Empty Value Handling

### From Domain to Airtable
```typescript
Domain null/undefined → Airtable null (field omitted)
Domain empty string   → Airtable null (field omitted)
Domain 0              → Airtable 0 (preserved)
Domain false          → Airtable false (preserved)
```

### From Airtable to Domain
```typescript
Airtable null/missing → Domain undefined
Airtable empty string → Domain undefined
Airtable 0            → Domain 0
Airtable false        → Domain false
```

## Update Operations

### Partial Updates
Only include changed fields in Airtable PATCH requests:

```typescript
// Domain partial update
{
  id: "rec123abc",
  status: "COMPLETED",
  updatedDate: new Date()
}

// Airtable PATCH payload
{
  fields: {
    "status": "Completed",
    "updated_date": "2024-03-15T14:30:22.000Z"
  }
}
```

### History Appends
Special handling for job_history field to ensure append-only behavior:

```typescript
// Get current history
const currentHistory = await getJobRecord(id);

// Append new line
const newHistory = currentHistory.jobHistory + '\n' + newHistoryLine;

// Update with complete history
await updateJob(id, { jobHistory: newHistory });
```

## Error Handling

### Field Validation Errors
```typescript
// Missing required field
"Field 'job_number' is required"

// Invalid field name
"Field 'invalid_field' does not exist in table"

// Invalid field value
"Field 'status' must be one of: Pending, In Progress, On Hold, Completed, Cancelled"
```

### Data Type Errors
```typescript
// Date parsing errors
"Invalid date format for 'scheduled_date': expected ISO 8601 string"

// Status enum errors  
"Invalid status value 'INVALID': must be one of PENDING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED"
```

## Performance Optimizations

### Batch Operations
Group multiple updates into single API call when possible:

```typescript
// Multiple individual updates (slow)
await updateJob(id1, update1);
await updateJob(id2, update2);

// Batch update (faster)
await batchUpdateJobs([
  { id: id1, fields: update1 },
  { id: id2, fields: update2 }
]);
```

### Field Selection
Only request needed fields to reduce payload size:

```typescript
// Get only essential fields for job lookup
const fields = ['job_number', 'client_unique_id', 'status'];
const job = await findJob(criteria, { fields });
```

## TODO
- Implement field mapping validation on startup
- Add support for custom field types (attachments, formulas)
- Create mapping configuration UI for non-technical users
