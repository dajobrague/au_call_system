# Canonical History Line Format

## Standard Format Template
All history entries follow a consistent format for reliable parsing and display:

```
---- | YYYY-MM-DD HH:mm:ss | Event: [EVENT_TYPE] | Source: [SOURCE] | Details: [DETAILS]
```

## Format Components

### Separator Line
- **Pattern**: `----` (four dashes)
- **Purpose**: Visual separator between history entries
- **Required**: Yes, always present

### Timestamp
- **Format**: `YYYY-MM-DD HH:mm:ss` (ISO-like, 24-hour)
- **Timezone**: Always stored in UTC
- **Example**: `2024-03-15 14:30:22`

### Event Type
- **Status Update**: Status changes between valid states
- **Date Update**: Scheduled date modifications
- **Assignee Update**: Assignment changes
- **Note Added**: New notes appended to job
- **Recording**: Voice recording availability
- **System Event**: Automated system actions

### Source Identification
- **IVR**: Voice call system (this application)
- **WEB**: Web dashboard interface
- **API**: Direct API integration
- **SYSTEM**: Automated system processes

### Details Section
Variable content based on event type, following specific patterns:

## Event-Specific Detail Formats

### Status Updates
```
Details: Changed from {previous_status} to {new_status}
Details: Updated to {new_status}  // when no previous status
```

### Date Updates  
```
Details: Rescheduled from {old_date} to {new_date}
Details: Scheduled for {new_date}  // when no previous date
Details: Removed scheduled date (was {old_date})  // when clearing
```

### Assignee Updates
```
Details: Reassigned from {previous_assignee} to {new_assignee}
Details: Assigned to {new_assignee}  // when no previous assignee
Details: Unassigned (was {previous_assignee})  // when clearing
```

### Note Additions
```
Details: {note_content}
```

### Recording Events
```
URL: {signed_or_public_url}
```

## Formatting Rules

### Date Display
- **Job Dates**: Human-readable format ("March 15, 2024")
- **Timestamps**: Machine-readable format ("2024-03-15 14:30:22")
- **Relative Dates**: Not used in history (absolute dates only)

### Name Formatting
- **Proper Case**: "John Smith", "María García"
- **No Abbreviations**: Use full names when available
- **Consistent Spacing**: Single spaces between name parts

### Status Formatting
- **Display Names**: "In Progress", "On Hold", "Completed"
- **Consistent Casing**: Title case for multi-word statuses
- **No Abbreviations**: Always use full status names

## Length and Safety Limits

### Maximum Lengths
- **Single History Line**: 1000 characters maximum
- **Details Section**: 800 characters maximum (allows for fixed parts)
- **Event Type**: 50 characters maximum
- **Source**: 20 characters maximum

### Content Safety
- **Character Escaping**: Escape pipe characters (|) in content
- **Line Break Handling**: Replace newlines with spaces
- **Special Characters**: Preserve accented characters, remove control characters

## Append-Only Strategy
- **Never Modify**: Existing history lines are immutable
- **Always Append**: New entries go at the end
- **Chronological Order**: Maintain timestamp ordering
- **No Deletion**: History entries are permanent audit trail

## Example History Entries
```
---- | 2024-03-15 09:15:00 | Event: Status Update | Source: WEB | Details: Changed from Pending to In Progress
---- | 2024-03-15 11:30:45 | Event: Date Update | Source: IVR | Details: Rescheduled from March 20, 2024 to March 22, 2024
---- | 2024-03-15 14:20:12 | Event: Assignee Update | Source: IVR | Details: Reassigned from John Smith to María García
---- | 2024-03-15 14:22:33 | Event: Note Added | Source: IVR | Details: Customer requested priority handling
---- | 2024-03-15 14:25:18 | Event: Recording | Source: IVR | URL: https://s3.example.com/recordings/signed-url
---- | 2024-03-15 16:45:00 | Event: Status Update | Source: IVR | Details: Changed from In Progress to Completed
```

## TODO
- Define truncation strategy for extremely long details
- Add support for rich text formatting in details
- Implement history parsing utilities for analytics
