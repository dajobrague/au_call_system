// Wrapper interface for state (no impl)

// TODO: Define StateStore interface for persisting call state
// TODO: Methods: get(callSid), set(callSid, state), delete(callSid)
// TODO: State should include: current_stage, client_id, job_number, attempt_count, job_data
// TODO: Implementation will use Redis adapter from integrations/redis/

// Example interface:
// interface CallState {
//   stage: Stage;
//   clientId?: string;
//   jobNumber?: string;
//   attemptCount: number;
//   jobData?: JobRecord;
//   lastUpdated: Date;
// }
//
// interface StateStore {
//   getState(callSid: string): Promise<CallState | null>;
//   setState(callSid: string, state: CallState): Promise<void>;
//   deleteState(callSid: string): Promise<void>;
// }
