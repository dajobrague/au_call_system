# Canonical Confirm Phrases (Keys Only)

## Confirmation Template Keys
Reference keys for voice prompts used in user confirmations during calls.

## Job Confirmation Templates

### Job Details Readback
- **Key**: `confirms.job.readback`
- **Usage**: Read complete job information for user verification
- **Variables**: `{{job_number}}`, `{{status}}`, `{{scheduled_date}}`, `{{assignee}}`
- **Fallbacks**: `{{scheduled_date|no date}}`, `{{assignee|unassigned}}`

### Job Found Confirmation
- **Key**: `confirms.job.found`
- **Usage**: Simple confirmation that job was located
- **Variables**: `{{job_number}}`, `{{client_name}}`

## Action Confirmation Templates

### Action Intent Confirmation
- **Key**: `confirms.action.intent`
- **Usage**: Confirm understood action before collecting details
- **Variables**: `{{action_type}}`, `{{job_number}}`

### Specific Action Confirmations
- **Key**: `confirms.action.update_status`
- **Variables**: `{{new_status}}`, `{{current_status}}`

- **Key**: `confirms.action.update_date`
- **Variables**: `{{new_date}}`, `{{current_date}}`

- **Key**: `confirms.action.update_assignee`
- **Variables**: `{{new_assignee}}`, `{{current_assignee}}`

- **Key**: `confirms.action.add_note`
- **Variables**: `{{note_content}}`

## Success Confirmation Templates

### Action Success Messages
- **Key**: `confirms.success.status_updated`
- **Variables**: `{{new_status}}`

- **Key**: `confirms.success.date_updated`
- **Variables**: `{{new_date}}`

- **Key**: `confirms.success.assignee_updated`
- **Variables**: `{{new_assignee}}`

- **Key**: `confirms.success.note_added`
- **Variables**: None (generic success message)

## Data Format Confirmation Templates

### Date Format Confirmations
- **Key**: `confirms.format.date`
- **Usage**: Confirm interpreted date is correct
- **Variables**: `{{interpreted_date}}`, `{{original_input}}`

### Name Format Confirmations
- **Key**: `confirms.format.assignee`
- **Usage**: Confirm interpreted name is correct
- **Variables**: `{{interpreted_name}}`, `{{original_input}}`

## Error Confirmation Templates

### Not Found Confirmations
- **Key**: `confirms.error.job_not_found`
- **Variables**: `{{job_number}}`, `{{client_id}}`

- **Key**: `confirms.error.assignee_not_found`
- **Variables**: `{{assignee_name}}`

### Validation Error Confirmations
- **Key**: `confirms.error.invalid_status_transition`
- **Variables**: `{{current_status}}`, `{{requested_status}}`

- **Key**: `confirms.error.invalid_date`
- **Variables**: `{{requested_date}}`, `{{reason}}`

## System Status Confirmations

### Processing Confirmations
- **Key**: `confirms.system.processing`
- **Usage**: Inform user that system is working
- **Variables**: `{{action_description}}`

### Recording Confirmations
- **Key**: `confirms.system.recording_available`
- **Usage**: Notify that call recording is ready
- **Variables**: None

## Variable Formatting Rules

### Date Variables
- **Format**: Human-readable dates ("March 15th", "tomorrow")
- **Fallback**: Provide default text for null dates
- **Timezone**: Display in user's timezone

### Status Variables
- **Format**: User-friendly status names ("In Progress", "Completed")
- **Consistency**: Always use same display format for each status

### Name Variables
- **Format**: Proper case names ("John Smith", "María García")
- **Handling**: Support Unicode characters for international names

### Job Number Variables
- **Format**: Preserve original format/casing
- **Display**: Include any prefixes as stored

## Multi-Language Support

### Language Keys
Confirmation keys support language variants:
- **Spanish**: Primary language (base keys)
- **English**: Fallback language (`.en` suffix if needed)

### Language Selection
- **Runtime**: Based on `LANG` environment variable
- **Fallback**: English if translation missing
- **Override**: Per-call language preference possible

## Interpolation Rules

### Variable Syntax
- **Simple**: `{{variable_name}}`
- **With Fallback**: `{{variable_name|fallback_text}}`
- **With Formatting**: `{{variable_name|filter}}`

### Available Filters
- **title**: Convert to title case
- **upper**: Convert to uppercase
- **lower**: Convert to lowercase
- **date**: Format date for display

## Usage Examples

### Job Readback Example
```
Template: "Job {{job_number}}; status {{status}}; scheduled date {{scheduled_date|no date}}; assigned to {{assignee|unassigned}}. Is this correct?"

Result: "Job 456; status In Progress; scheduled date March 15th; assigned to John Smith. Is this correct?"
```

### Action Confirmation Example
```
Template: "I will update the status to {{new_status}}. Is this correct?"

Result: "I will update the status to Completed. Is this correct?"
```

## TODO
- Define confirmation phrase variations for natural conversation
- Add support for conditional confirmations based on context
- Implement confirmation phrase testing and validation
