# Date Format/Parse Rules

## Standard Formats
- **Display Format**: "YYYY-MM-DD" (2024-03-15)
- **Storage Format**: ISO 8601 with timezone (2024-03-15T14:30:00Z)
- **User Input**: Flexible parsing ("March 15", "15/03", "next Friday")
- **History Timestamp**: "YYYY-MM-DD HH:mm:ss" (2024-03-15 14:30:22)

## Parsing Rules
- Accept multiple input formats from speech
- Convert relative dates ("tomorrow", "next week", "in 3 days")
- Validate dates are in the future for scheduling
- Handle timezone conversion (assume user timezone from call metadata)

## Validation
- Scheduled dates must be future dates
- Business days only (Monday-Friday) unless specified
- Exclude holidays (configurable holiday calendar)
- Maximum scheduling window: 1 year in advance

## Formatting Functions
- `formatDisplayDate(date)` - User-friendly display
- `parseUserDate(speechText)` - Extract date from natural language
- `validateScheduleDate(date)` - Business rule validation
- `formatHistoryTimestamp(date)` - Consistent history format

## Timezone Handling
- Store all dates in UTC
- Convert to user timezone for display
- Infer timezone from Twilio call metadata (From number)
- Default to system timezone if unavailable

## TODO
- Implement natural language date parsing
- Add support for recurring dates
- Handle multiple timezone scenarios
