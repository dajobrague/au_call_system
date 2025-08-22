# Add Note Action

## Business Rules
Defines validation and execution rules for adding notes to job records.

## Note Content Validation
Notes must meet quality and safety requirements:

1. **Length Limits**: 10-500 characters per note addition
2. **Content Filtering**: Screen for inappropriate content
3. **Format Validation**: Remove/escape special characters
4. **Required Content**: Must contain meaningful information

## Note Categories
Classify notes for better organization:

- **GENERAL**: Standard job-related notes
- **TECHNICAL**: Technical details and specifications
- **CLIENT_COMMUNICATION**: Customer interaction records
- **INTERNAL**: Internal team communications only

## Required Information
- Job ID (target record)
- Note content (validated text)
- Note category (optional, defaults to GENERAL)
- User context (for attribution)
- Timestamp (for chronological ordering)

## Content Processing
1. **Text Sanitization**: Remove/escape harmful characters
2. **Length Validation**: Ensure within acceptable limits
3. **Content Screening**: Filter inappropriate content
4. **Format Standardization**: Apply consistent formatting

## Execution Process
1. Validate note content meets requirements
2. Apply content processing and sanitization
3. Append note to job's notes field or history
4. Generate history entry for audit trail
5. Return confirmation with processed content

## History Line Format
```
"---- | YYYY-MM-DD HH:mm:ss | Event: Note Added | Source: IVR | Details: {note_content}"
```

## Note Storage Strategy
Two approaches for note storage:

### Append to History
- Notes become part of job_history field
- Chronological ordering maintained automatically
- Cannot be modified once added
- Full audit trail preserved

### Separate Notes Field
- Dedicated notes field for structured storage
- Allows note editing/deletion if needed
- Requires separate history entry for changes
- More flexible but complex management

## Content Restrictions
- **PII Protection**: Avoid storing sensitive personal information
- **Profanity Filter**: Remove inappropriate language
- **Length Limits**: Prevent field overflow
- **Character Encoding**: Handle Unicode properly

## Error Scenarios
- **Empty Content**: Note has no meaningful content
- **Too Long**: Exceeds maximum length limit
- **Invalid Characters**: Contains forbidden characters
- **Duplicate Content**: Identical to recent note
- **Permission Denied**: User cannot add notes to this job

## Special Handling
- **Voice Input**: Speech-to-text may require cleanup
- **Multilingual**: Support non-English content
- **Rich Text**: Handle basic formatting if needed
- **Auto-Categorization**: Suggest category based on content

## Integration Points
- **Content Moderation**: External filtering service
- **Translation**: Multi-language support
- **Search Indexing**: Make notes searchable
- **Notification**: Alert relevant parties of important notes

## TODO
- Implement intelligent content categorization
- Add note editing capabilities with history tracking
- Define note visibility and access controls
