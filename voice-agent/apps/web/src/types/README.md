# Shared TS Types Index

## References Domain
This module serves as the central index for all TypeScript types used throughout the web application, with most core types defined in the `packages/domain/` package.

## Type Categories

### Domain Types (from packages/domain/)
- **Job Types**: JobRecord, JobStatus, JobAction
- **Client Types**: ClientRecord, ClientStatus
- **Action Types**: UpdateStatusAction, UpdateDateAction, AddNoteAction
- **Stage Types**: FSMStage, StageTransition

### Application-Specific Types
- **Call State**: CallState, SessionState, FSMContext
- **API Types**: TwilioWebhook, AirtableResponse, S3UploadResult
- **Configuration**: EnvironmentConfig, FieldMappings, Limits

### Integration Types
- **Twilio**: TwiMLResponse, GatherConfig, RecordingCallback
- **Airtable**: FieldMapping, RecordUpdate, QueryResult
- **Redis**: StateKey, StateValue, TTLConfig
- **S3**: ObjectKey, SignedURL, UploadMetadata

### Utility Types
- **Result Types**: Success<T>, Error<E>, AsyncResult<T, E>
- **Validation**: ValidationResult, FieldError, BusinessRuleError
- **Formatting**: HistoryLine, ConfirmationMessage, DisplayFormat

## Import Patterns
```typescript
// Domain types
import type { JobRecord, JobStatus } from '@voice-agent/domain';

// Application types
import type { CallState, SessionConfig } from './types';

// Integration types
import type { TwilioWebhook } from './integrations/twilio/types';
```

## Type Conventions
- **Interfaces**: PascalCase for data structures
- **Enums**: UPPER_SNAKE_CASE for values
- **Union Types**: Descriptive names with pipe separation
- **Generic Types**: Single uppercase letters (T, K, V)

## Validation Integration
- Types should align with runtime validation schemas
- Use branded types for validated data (e.g., `ValidatedJobNumber`)
- Leverage TypeScript strict mode for maximum type safety

## TODO
- Generate runtime validators from TypeScript types
- Add JSDoc documentation for all public types
- Create type compatibility testing between packages
