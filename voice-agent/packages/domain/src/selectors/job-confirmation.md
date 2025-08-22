# Which Fields to Read Back to User

## Job Confirmation Field Selection
Defines which job fields should be included in user confirmation prompts for optimal user experience.

## Primary Confirmation Fields
Essential fields that users need to verify job identity:

### Always Include
- **Job Number**: Primary identifier user provided
- **Client Name**: Confirms correct client context (if available)
- **Current Status**: Critical for understanding job state

### Conditionally Include
- **Scheduled Date**: Only if date is set (not null/empty)
- **Assignee**: Only if assigned to someone
- **Priority**: Only if set to HIGH or URGENT
- **Location**: Only if job has specific location requirement

## Field Display Priority
Order fields by importance for user confirmation:

1. **Job Number** - Primary identifier
2. **Status** - Current state
3. **Scheduled Date** - When work is planned
4. **Assignee** - Who is responsible
5. **Client Name** - Context confirmation
6. **Priority** - If elevated priority
7. **Location** - If location-specific

## Field Formatting Rules

### Job Number Display
- **Format**: Preserve original format and casing
- **Prefix**: Include any standard prefixes ("JOB-456", "#789")
- **Always Present**: Required for confirmation

### Status Display
- **Format**: User-friendly names ("In Progress", "On Hold")
- **Color Coding**: Not applicable for voice interface
- **Always Present**: Critical state information

### Date Display
- **Format**: Natural language ("March 15th", "tomorrow")
- **Relative Dates**: Use when appropriate ("next Friday")
- **Null Handling**: "no scheduled date" for empty fields

### Assignee Display
- **Format**: Full name in proper case
- **Null Handling**: "unassigned" for empty fields
- **Title**: Include job title if relevant ("John Smith, Senior Tech")

## Confirmation Context Rules

### Job Found Confirmation
When job is successfully located:
```
"Job {number}; status {status}; scheduled date {date}; assigned to {assignee}. Is this correct?"
```

### Minimal Confirmation
For jobs with few populated fields:
```
"Job {number}; status {status}; no scheduled date; unassigned. Is this correct?"
```

### Detailed Confirmation
For jobs with many populated fields:
```
"Job {number}; status {status}; priority {priority}; scheduled for {date}; assigned to {assignee}; location {location}. Is this correct?"
```

## Field Selection Logic

### Include Field If:
- Field has a non-null, non-empty value
- Field is relevant to current action context
- Field helps user verify job identity
- Field affects action availability

### Exclude Field If:
- Field is null or empty
- Field contains sensitive information
- Field is internal/system-generated
- Field would make confirmation too verbose

## Action-Specific Field Selection

### For Status Updates
Always include current status for transition validation:
- Current status is essential
- Previous status changes may be relevant
- Status-dependent fields (like completion date)

### For Date Updates
Focus on scheduling-related fields:
- Current scheduled date (if any)
- Assignee (who will be affected)
- Priority (for scheduling conflicts)

### For Assignee Updates
Include workload-related information:
- Current assignee (if any)
- Scheduled date (for workload planning)
- Job complexity indicators

## Maximum Confirmation Length
Keep confirmations concise but complete:

- **Target Length**: 10-15 seconds spoken
- **Maximum Fields**: 6 fields per confirmation
- **Word Limit**: 40-60 words total
- **Clarity**: Prioritize understanding over completeness

## Error State Confirmations

### Job Not Found
```
"I couldn't find job {number} for client {client_id}. Please verify the job number."
```

### Multiple Matches
```
"I found multiple jobs with that number. Job {number} for {client_name}, status {status}. Is this the correct job?"
```

### Access Restricted
```
"Job {number} exists but you don't have permission to modify it."
```

## Localization Considerations

### Spanish Confirmations
- Maintain natural Spanish sentence structure
- Use appropriate gender agreement for adjectives
- Include cultural context for date/time references

### English Fallback
- Provide clear English alternatives
- Maintain consistent terminology
- Handle American vs. British date formats

## TODO
- Implement dynamic field selection based on user preferences
- Add confirmation brevity controls for experienced users
- Define field selection rules for complex job types
