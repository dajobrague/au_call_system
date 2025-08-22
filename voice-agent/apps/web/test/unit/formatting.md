# Formatting Unit Tests

## Cases for History & Confirmation Line Rules
Test cases for consistent formatting of history entries and user confirmations.

## History Line Formatting Tests

### Standard History Format
**Template**: `---- | YYYY-MM-DD HH:mm:ss | Event: [EVENT] | Source: IVR | Details: [DETAILS]`

### Status Update History Lines
```
Input: {event: "STATUS_UPDATE", from: "IN_PROGRESS", to: "COMPLETED", timestamp: "2024-03-15T14:30:22Z"}
Expected: "---- | 2024-03-15 14:30:22 | Event: Status Update | Source: IVR | Details: Changed from In Progress to Completed"
```

### Scheduled Date History Lines
```
Input: {event: "DATE_UPDATE", from: "2024-03-15", to: "2024-03-20", timestamp: "2024-03-15T14:30:22Z"}
Expected: "---- | 2024-03-15 14:30:22 | Event: Date Update | Source: IVR | Details: Rescheduled from March 15, 2024 to March 20, 2024"
```

### Assignee Change History Lines
```
Input: {event: "ASSIGNEE_UPDATE", from: "John Smith", to: "María García", timestamp: "2024-03-15T14:30:22Z"}
Expected: "---- | 2024-03-15 14:30:22 | Event: Assignee Update | Source: IVR | Details: Reassigned from John Smith to María García"
```

### Note Addition History Lines
```
Input: {event: "NOTE_ADD", content: "Customer requested priority handling", timestamp: "2024-03-15T14:30:22Z"}
Expected: "---- | 2024-03-15 14:30:22 | Event: Note Added | Source: IVR | Details: Customer requested priority handling"
```

### Recording Available History Lines
```
Input: {event: "RECORDING", url: "https://s3.example.com/signed-url", timestamp: "2024-03-15T14:30:22Z"}
Expected: "---- | 2024-03-15 14:30:22 | Event: Recording | Source: IVR | URL: https://s3.example.com/signed-url"
```

## Edge Cases for History Formatting

### Null/Empty Previous Values
```
Input: {event: "DATE_UPDATE", from: null, to: "2024-03-20"}
Expected: "Details: Scheduled for March 20, 2024"
```

### Special Characters in Content
```
Input: {event: "NOTE_ADD", content: "Client said: \"Please rush this!\""}
Expected: "Details: Client said: \"Please rush this!\""
```

### Long Content Truncation
```
Input: {event: "NOTE_ADD", content: "Very long note content that exceeds maximum length..."}
Expected: "Details: Very long note content that exceeds maximum len... [truncated]"
```

## Confirmation Message Formatting

### Job Confirmation Template
```
Input: {jobNumber: "456", status: "IN_PROGRESS", scheduledDate: "2024-03-20", assignee: "John Smith"}
Expected: "Job 456; status In Progress; scheduled date March 20th; assigned to John Smith. Is this correct?"
```

### Job Confirmation with Missing Fields
```
Input: {jobNumber: "456", status: "PENDING", scheduledDate: null, assignee: null}
Expected: "Job 456; status Pending; no scheduled date; no assignee. Is this correct?"
```

### Action Confirmation Messages
```
Input: {action: "UPDATE_STATUS", value: "COMPLETED"}
Expected: "I will update the status to Completed. Is this correct?"

Input: {action: "UPDATE_DATE", value: "2024-03-25"}
Expected: "I will reschedule this job for March 25th. Is this correct?"

Input: {action: "UPDATE_ASSIGNEE", value: "María García"}
Expected: "I will assign this job to María García. Is this correct?"
```

### Success Confirmation Messages
```
Input: {action: "UPDATE_STATUS", newValue: "COMPLETED"}
Expected: "Status successfully updated to Completed."

Input: {action: "UPDATE_DATE", newValue: "2024-03-25"}
Expected: "Job successfully rescheduled for March 25th."
```

## Date Formatting Tests

### Display Date Formatting
```
Input: "2024-03-15"
Expected: "March 15th"

Input: "2024-12-01"
Expected: "December 1st"

Input: "2024-03-22"
Expected: "March 22nd"
```

### Relative Date Formatting
```
Input: Date one day from now
Expected: "tomorrow"

Input: Date in same week
Expected: "this Friday"

Input: Date next week
Expected: "next Tuesday"
```

## Name Formatting Tests

### Name Capitalization
```
Input: "john smith"
Expected: "John Smith"

Input: "MARÍA GARCÍA"
Expected: "María García"

Input: "jean-claude van damme"
Expected: "Jean-Claude Van Damme"
```

## Status Value Formatting

### Status Display Names
```
Input: "IN_PROGRESS"
Expected: "In Progress"

Input: "ON_HOLD"
Expected: "On Hold"

Input: "COMPLETED"
Expected: "Completed"
```

## Multi-Language Formatting

### Spanish Formatting
```
Input: {status: "IN_PROGRESS", lang: "es"}
Expected: "En Progreso"

Input: {date: "2024-03-15", lang: "es"}
Expected: "15 de marzo"
```

## Length and Safety Tests

### Maximum Line Length
- Test that history lines don't exceed 1000 characters
- Test truncation behavior for long content
- Ensure truncation preserves meaning

### Character Escaping
- Test special characters in job numbers, names, notes
- Ensure proper escaping for Airtable storage
- Prevent injection through formatted content

## TODO
- Add timezone-aware date formatting
- Implement rich text formatting for complex confirmations
- Add support for custom formatting templates
