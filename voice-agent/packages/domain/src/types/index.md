# Type Aliases Overview

## Purpose
Central collection of type aliases and utility types used throughout the domain package.

## Core Domain Type Aliases

### Job-Related Types
```typescript
// Primary job identifier used across the system
type JobId = string;

// User-visible job number (may contain prefixes/formatting)
type JobNumber = string;

// Client identifier used for job association
type ClientId = string;

// Formatted history content for jobs
type JobHistory = string;
```

### Action-Related Types
```typescript
// Discriminated union of all possible actions
type AnyAction = UpdateStatusAction | UpdateScheduledDateAction | UpdateAssigneeAction | AddNoteAction;

// Result of action validation
type ActionValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

// Result of action execution
type ActionExecutionResult = {
  success: boolean;
  action?: AnyAction;
  historyLine?: string;
  error?: string;
};
```

### Stage-Related Types
```typescript
// Current position in conversation flow
type CurrentStage = Stage;

// Collection of user input during conversation
type CollectedData = Record<string, any>;

// Context for stage transitions
type StageTransitionContext = {
  currentStage: Stage;
  previousStage?: Stage;
  trigger: TransitionTrigger;
  userData: CollectedData;
};
```

## Utility Types

### Result Types
Generic result patterns for operation outcomes:

```typescript
// Success result with data
type Success<T> = {
  success: true;
  data: T;
};

// Error result with details
type Error = {
  success: false;
  error: string;
  code?: string;
  retryable?: boolean;
};

// Combined result type
type Result<T> = Success<T> | Error;

// Async operation result
type AsyncResult<T> = Promise<Result<T>>;
```

### Validation Types
Standard validation result patterns:

```typescript
// Field-level validation error
type FieldError = {
  field: string;
  message: string;
  code: string;
};

// Validation result for forms/inputs
type ValidationResult = {
  isValid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
};

// Business rule validation
type BusinessRuleResult = {
  allowed: boolean;
  reason?: string;
  alternative?: string;
};
```

### Data Projection Types
Types for selecting and formatting data:

```typescript
// Job data for user confirmation
type JobConfirmationData = Pick<JobRecord, 'jobNumber' | 'status' | 'scheduledDate' | 'assignee'>;

// Job summary for display
type JobSummary = Pick<JobRecord, 'id' | 'jobNumber' | 'status' | 'clientId'>;

// Action summary for history
type ActionSummary = Pick<BaseAction, 'type' | 'timestamp' | 'source'>;
```

## Domain Value Objects

### Validated Types
Branded types for validated data:

```typescript
// Job number that has passed validation
type ValidatedJobNumber = JobNumber & { __validated: 'job_number' };

// Client ID that has been verified to exist
type ValidatedClientId = ClientId & { __validated: 'client_id' };

// Status value that passes business rules
type ValidatedStatus = JobStatus & { __validated: 'status' };

// Date that meets scheduling requirements
type ValidatedScheduleDate = Date & { __validated: 'schedule_date' };
```

### Formatted Display Types
Types for user-facing data:

```typescript
// Date formatted for display
type DisplayDate = string & { __formatted: 'date' };

// Status formatted for user display
type DisplayStatus = string & { __formatted: 'status' };

// Name formatted with proper capitalization
type DisplayName = string & { __formatted: 'name' };

// History line formatted for display
type FormattedHistoryLine = string & { __formatted: 'history' };
```

## Event Types
Types for domain events and notifications:

```typescript
// Domain event base type
type DomainEvent = {
  type: string;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
};

// Job-related events
type JobEvent = DomainEvent & {
  jobId: JobId;
  jobNumber: JobNumber;
};

// Action execution events
type ActionEvent = JobEvent & {
  action: AnyAction;
  result: ActionExecutionResult;
};
```

## Configuration Types
Types for domain configuration:

```typescript
// Business rule configuration
type BusinessRules = {
  statusTransitions: Record<JobStatus, JobStatus[]>;
  maxScheduleDays: number;
  requireAssigneeForStatus: JobStatus[];
  mandatoryFields: Record<JobStatus, string[]>;
};

// Validation configuration
type ValidationConfig = {
  maxJobNumberLength: number;
  maxNoteLength: number;
  allowWeekendScheduling: boolean;
  businessHours: { start: number; end: number };
};
```

## Integration Types
Types for external system integration:

```typescript
// External system identifiers
type ExternalSystemId = string;

// Data mapping for external systems
type FieldMapping = Record<string, string>;

// External system response
type ExternalResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  systemId: ExternalSystemId;
};
```

## TODO
- Add generic types for common patterns
- Define type guards for runtime validation
- Create type utilities for data transformation
