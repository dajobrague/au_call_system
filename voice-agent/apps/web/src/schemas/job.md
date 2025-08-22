# Job DTO Shapes

## Job Record Structure
Define the structure for Job records as they flow through the system.

### Core Job Fields
```typescript
interface JobRecord {
  id: string;                    // Airtable record ID
  jobNumber: string;             // User-visible job identifier
  clientId: string;              // Client unique identifier
  status: JobStatus;             // Current job status
  scheduledDate?: Date;          // When job is scheduled
  assignee?: string;             // Who is assigned to the job
  jobHistory: string;            // Formatted history log
  createdDate: Date;             // When job was created
  updatedDate: Date;             // Last modification time
}
```

### Extended Job Fields
```typescript
interface ExtendedJobRecord extends JobRecord {
  clientName?: string;           // Resolved from client lookup
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  location?: string;             // Job site location
  notes?: string;                // Additional job notes
  estimatedDuration?: number;    // Estimated hours
}
```

### Job Status Enum
```typescript
type JobStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';
```

## Job Lookup DTOs
Structures for job search and validation.

### Job Lookup Request
```typescript
interface JobLookupRequest {
  clientId: string;
  jobNumber: string;
}
```

### Job Lookup Result
```typescript
interface JobLookupResult {
  found: boolean;
  job?: JobRecord;
  error?: string;
}
```

## Job Confirmation DTO
Structure for user confirmation display.

### Job Confirmation Data
```typescript
interface JobConfirmation {
  jobNumber: string;
  status: string;
  scheduledDate?: string;        // Formatted for display
  assignee?: string;
  clientName?: string;
}
```

## TODO
- Link to domain models in packages/domain/models/
- Add field validation schemas
- Define job state change tracking
