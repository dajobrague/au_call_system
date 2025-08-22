# Safe Concatenation, Capitalization Rules

## Text Processing Rules
Standardized text handling for consistent user experience and data integrity.

## Concatenation Safety
- Always validate inputs before concatenation
- Escape special characters for Airtable fields
- Prevent injection attacks in generated text
- Limit total length to prevent field overflow

## Capitalization Rules
- **Names**: Title case (John Smith, María García)
- **Status Values**: Consistent casing per business rules
- **Job Numbers**: Preserve original casing
- **Notes**: Sentence case with proper punctuation

## Text Cleaning
- Remove extra whitespace and normalize spacing
- Handle special characters in speech-to-text output
- Standardize common abbreviations
- Filter profanity and inappropriate content

## Length Limits
- Client ID: 50 characters maximum
- Job Number: 20 characters maximum
- Notes addition: 500 characters maximum
- Single history line: 1000 characters maximum

## Encoding
- UTF-8 encoding for all text processing
- Handle accented characters properly (Spanish support)
- Preserve emoji and special characters where appropriate
- Normalize Unicode representation

## Validation Functions
- `sanitizeInput(text)` - Clean and validate user input
- `formatName(name)` - Standardize name capitalization
- `truncateWithEllipsis(text, maxLength)` - Safe truncation
- `escapeForAirtable(text)` - Prevent field injection

## TODO
- Implement comprehensive profanity filter
- Add support for multiple languages
- Optimize text processing performance
