# ADR-0001: Layered Architecture

## Status
Accepted

## Context
We need to build a voice-driven call agent system that integrates with Airtable, Twilio, S3, and Redis. The system must be maintainable, testable, and allow for easy modification of business rules and external integrations.

## Decision
We will implement a layered architecture with clear separation of concerns:

### Layer Structure
```
apps/web/          - Next.js API-only application (Presentation/API Layer)
packages/domain/   - Pure business logic (Domain Layer)
packages/adapters/ - External service integrations (Infrastructure Layer)
packages/playbooks/- Configuration data (Configuration Layer)
```

### Role-Based Organization
Within `apps/web/src/roles/`, we organize business logic into four distinct roles:

- **Receiver**: Handles initial call setup and TwiML generation
- **Interpreter**: Extracts meaning from user speech input
- **Researcher**: Validates input against Airtable data
- **Responder**: Executes actions and updates records

## Rationale

### Benefits of Layered Architecture

#### 1. Separation of Concerns
- **Domain Logic**: Pure business rules independent of external services
- **Infrastructure**: External service details isolated from business logic
- **Configuration**: Voice prompts and flow rules separated from code
- **API Layer**: Twilio webhook handling separate from domain operations

#### 2. Testability
- **Domain**: Can be tested without external dependencies
- **Adapters**: Can be mocked for domain testing
- **Integration**: Each layer can be tested independently
- **End-to-End**: Full system tests possible with real external services

#### 3. Maintainability
- **Field Changes**: Update only adapter mappings for Airtable field renames
- **Prompt Changes**: Modify only YAML files for voice prompt updates
- **Business Rules**: Change only domain layer for rule modifications
- **External Services**: Swap adapters without touching business logic

#### 4. Scalability
- **Package Boundaries**: Clear interfaces between packages
- **Independent Deployment**: Packages can be deployed separately if needed
- **Team Organization**: Different teams can own different layers
- **Performance**: Can optimize individual layers independently

### Role-Based Benefits

#### 1. Single Responsibility
Each role has one clear purpose:
- **Receiver**: "How do I start a conversation?"
- **Interpreter**: "What does the user want?"
- **Researcher**: "Is this request valid?"
- **Responder**: "How do I make this change?"

#### 2. Logical Flow
Natural progression through conversation:
```
Call → Receiver → Interpreter → Researcher → Responder → End
```

#### 3. Error Boundaries
Each role can handle its own error scenarios:
- **Receiver**: TwiML generation errors
- **Interpreter**: Speech recognition errors  
- **Researcher**: Data validation errors
- **Responder**: Update execution errors

#### 4. Independent Evolution
Roles can evolve independently:
- Improve speech recognition without touching data access
- Enhance data validation without changing voice responses
- Optimize database queries without affecting conversation flow

## Alternatives Considered

### Monolithic Approach
**Rejected**: Would mix business logic with infrastructure concerns, making testing and maintenance difficult.

### Service-Oriented Architecture (SOA)
**Rejected**: Adds unnecessary complexity for a single-application system. Network overhead and service discovery not needed.

### Hexagonal Architecture
**Considered**: Very similar to our chosen approach. Our layered architecture achieves the same goals with simpler terminology.

### Feature-Based Organization
**Rejected**: Would spread related functionality across multiple directories, making it harder to understand the conversation flow.

## Implementation Guidelines

### Dependency Rules
- **Domain**: Never imports from adapters or apps
- **Adapters**: Can import from domain, never from apps
- **Apps**: Can import from domain and adapters
- **Playbooks**: Pure data, no code dependencies

### Interface Design
- **Adapters**: Expose domain-friendly interfaces
- **Domain**: Accept and return domain types only
- **Configuration**: Use environment variables for field mappings
- **Roles**: Accept standardized input/output types

### Error Handling
- **Domain**: Returns domain-specific error types
- **Adapters**: Translate external errors to domain errors
- **Apps**: Handle presentation of errors to users
- **Roles**: Focus on role-specific error scenarios

### Testing Strategy
- **Unit Tests**: Focus on individual roles and domain logic
- **Integration Tests**: Test adapter implementations
- **Contract Tests**: Verify external service compatibility
- **E2E Tests**: Test complete conversation flows

## Monitoring and Metrics

### Success Metrics
- **Code Reuse**: How often domain logic is reused across roles
- **Test Coverage**: Percentage coverage in each layer
- **Change Impact**: How many layers need changes for new features
- **Bug Isolation**: How quickly bugs can be isolated to specific layers

### Warning Signs
- **Circular Dependencies**: Domain importing from adapters
- **Large Interfaces**: Adapters exposing too many external details
- **Role Confusion**: Roles handling concerns outside their responsibility
- **Configuration Drift**: Business logic creeping into configuration files

## Future Considerations

### Package Extraction
If the system grows, packages could become separate repositories:
- `@voice-agent/domain` - Shared business logic
- `@voice-agent/airtable-adapter` - Airtable integration
- `@voice-agent/twilio-adapter` - Twilio integration

### Multi-Application Support
Architecture supports multiple applications:
- Web dashboard using same domain and adapters
- Mobile app using same business logic
- Batch processing using same data adapters

### Technology Changes
Layer boundaries make technology changes easier:
- Replace Airtable with different database (change adapters only)
- Switch from Next.js to different web framework (change apps only)
- Add new external services (add new adapters)

## Decision Record
- **Date**: 2024-03-15
- **Participants**: Architecture Team
- **Next Review**: 2024-06-15 (3 months)
