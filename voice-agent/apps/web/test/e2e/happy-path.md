# Happy Path E2E Test

## Scripted Conversation Outline (Stage by Stage)
Complete end-to-end conversation flow for successful job update scenario.

## Test Scenario
User calls to update the status of an existing job from "In Progress" to "Completed".

## Stage-by-Stage Flow

### 1. Call Initiation (COLLECT_CLIENT_ID)
- **System**: "Welcome to the job management system. Please provide your client identifier."
- **User**: "ABC123"
- **System**: "Thank you. Now please provide your job number."

### 2. Job Number Collection (COLLECT_JOB_NUMBER)
- **User**: "JOB456"
- **System**: Looks up job in Airtable

### 3. Job Confirmation (CONFIRM_JOB)
- **System**: "Job 456; status In Progress; scheduled date March 15th. Is this correct?"
- **User**: "Yes"
- **System**: "What would you like to do? You can update status, change scheduled date, change assignee, or add a note."

### 4. Action Selection (ASK_ACTION)
- **User**: "Update status"
- **System**: "What is the new status?"

### 5. Status Collection (COLLECT_ACTION_VALUE)
- **User**: "Completed"
- **System**: "I will update the status to Completed. Is this correct?"

### 6. Action Confirmation (CONFIRM_ACTION)
- **User**: "Yes"
- **System**: Updates Airtable record

### 7. Action Execution (EXECUTE_ACTION)
- **System**: "Status successfully updated to Completed. Is there anything else you need to do?"

### 8. Continue or End
- **User**: "No, that's all"
- **System**: "Thank you for calling. Have a great day. Goodbye."

## Expected Outcomes
- Job status updated from "In Progress" to "Completed" in Airtable
- History line appended: "---- | 2024-03-15 14:30:22 | Event: Status Update | Source: IVR | Details: Changed from In Progress to Completed"
- Call recording uploaded to S3
- Recording URL appended to job history
- Call state cleaned up from Redis

## Validation Points
- Twilio signature validation on all webhook calls
- Client ID exists and is active
- Job number exists for the client
- Status transition is valid (In Progress → Completed allowed)
- Airtable update succeeds
- History formatting is correct
- S3 upload completes successfully

## TODO
- Automate this test with Twilio Test Credentials
- Add assertions for database state changes
- Include performance benchmarks
