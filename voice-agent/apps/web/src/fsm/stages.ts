// Stage enum & doc-only comments

// TODO: Define StageEnum with all possible call flow stages
// collect_client_id - Ask user for their client identifier
// collect_job_number - Ask user for job number to work with
// confirm_job - Read back job details for user confirmation
// ask_action - Present menu of available actions (update status, date, assignee, add note)
// execute_action - Process the requested action and confirm completion
// goodbye - End call gracefully

// TODO: Each stage should map to prompts in packages/playbooks/phrases.es.yaml
// TODO: Each stage should define valid transitions in packages/playbooks/flow.default.yaml
