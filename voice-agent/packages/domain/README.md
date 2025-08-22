# Domain Package

Pure business logic and domain models for the voice agent system.

## Purpose
Contains the core business rules, data models, and domain operations that are independent of external services and infrastructure concerns.

## Structure
- `models/` - Core data structures (Job, Client, Action, Stage)
- `actions/` - Business operations for job management
- `formatting/` - Domain-specific formatting rules
- `selectors/` - Data projection and confirmation logic
- `types/` - Shared type definitions and aliases

## Design Principles
- **Pure Functions**: No side effects, testable in isolation
- **Framework Agnostic**: No dependencies on external libraries
- **Business Focused**: Models real-world job management concepts
- **Immutable**: Data structures prefer immutability where possible

## Key Concepts
- **Job**: Central entity representing work to be performed
- **Client**: Entity that owns jobs
- **Action**: Operations that can be performed on jobs
- **Stage**: Current state in the conversation flow

## Dependencies
This package has no external dependencies and should not import from adapters or integrations.

## Usage
Other packages import domain types and functions:
```typescript
import { JobRecord, JobStatus } from '@voice-agent/domain';
import { updateJobStatus } from '@voice-agent/domain/actions';
```
