// Transition table (data-only) – placeholder

// TODO: Define state transition matrix
// TODO: Map current_stage + user_input -> next_stage
// TODO: Include retry logic for failed validations
// TODO: Reference flow configuration from packages/playbooks/flow.default.yaml

// Example structure:
// {
//   collect_client_id: {
//     valid_input: 'collect_job_number',
//     invalid_input: 'collect_client_id', // retry
//     timeout: 'goodbye'
//   },
//   collect_job_number: {
//     valid_input: 'confirm_job',
//     invalid_input: 'collect_job_number', // retry
//     timeout: 'goodbye'
//   }
// }
