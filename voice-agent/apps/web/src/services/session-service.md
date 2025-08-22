# Session Service

## Orchestration Notes
Coordinates FSM state transitions and role interactions for each call session.

## Responsibilities
- Manages call state lifecycle (create, update, cleanup)
- Orchestrates role interactions: Receiver → Interpreter → Researcher → Responder
- Handles stage transitions based on FSM machine rules
- Manages retry logic and error recovery

## References FSM + Roles
- Uses `fsm/machine` for transition table lookups
- Calls `fsm/state-store` for state persistence
- Delegates to appropriate role based on current stage
- Applies business rules from `packages/playbooks/flow.default.yaml`

## Flow Example
1. Call starts → Receiver creates initial state
2. User input → Interpreter extracts slots
3. Valid slots → Researcher validates against Airtable
4. Valid job → Responder executes action
5. Action complete → Session updates state and continues or ends

## Error Scenarios
- Invalid input: retry current stage (up to configured limit)
- Network failures: attempt recovery, graceful degradation
- State corruption: rebuild from call context
- Timeout: progress to timeout handling stage

## TODO
- Implement session timeout management
- Add comprehensive error recovery strategies
- Define session metrics and telemetry points
