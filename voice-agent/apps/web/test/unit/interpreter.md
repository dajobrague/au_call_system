# Interpreter Unit Tests

## Cases for Slot/Intent Rules
Comprehensive test cases for user input interpretation and slot extraction.

## Client ID Extraction Tests

### Valid Formats
- **Input**: "ABC123" → **Output**: {clientId: "ABC123", confidence: 1.0}
- **Input**: "my client id is XYZ789" → **Output**: {clientId: "XYZ789", confidence: 0.9}
- **Input**: "it's CORP2024" → **Output**: {clientId: "CORP2024", confidence: 0.8}

### Edge Cases
- **Input**: "abc123" (lowercase) → **Output**: {clientId: "ABC123", confidence: 1.0}
- **Input**: "A B C 1 2 3" (spelled out) → **Output**: {clientId: "ABC123", confidence: 0.7}
- **Input**: "A-B-C-1-2-3" (with dashes) → **Output**: {clientId: "ABC123", confidence: 0.8}

### Invalid Inputs
- **Input**: "AB" (too short) → **Output**: {error: "TOO_SHORT", retryable: true}
- **Input**: "123" (numbers only) → **Output**: {error: "INVALID_FORMAT", retryable: true}
- **Input**: "ABC@123" (special chars) → **Output**: {error: "INVALID_CHARS", retryable: true}

## Job Number Extraction Tests

### Valid Formats
- **Input**: "456" → **Output**: {jobNumber: "456", confidence: 1.0}
- **Input**: "job number 789" → **Output**: {jobNumber: "789", confidence: 0.9}
- **Input**: "it's job 1001" → **Output**: {jobNumber: "1001", confidence: 0.8}

### Edge Cases
- **Input**: "four five six" (spelled out) → **Output**: {jobNumber: "456", confidence: 0.6}
- **Input**: "JOB456" (with prefix) → **Output**: {jobNumber: "456", confidence: 0.9}
- **Input**: "#789" (with hash) → **Output**: {jobNumber: "789", confidence: 0.8}

### Invalid Inputs
- **Input**: "job" (no number) → **Output**: {error: "NO_NUMBER", retryable: true}
- **Input**: "12345678901234567890" (too long) → **Output**: {error: "TOO_LONG", retryable: true}

## Action Intent Classification

### Status Update Intents
- **Input**: "update status" → **Output**: {intent: "UPDATE_STATUS", confidence: 1.0}
- **Input**: "change the status" → **Output**: {intent: "UPDATE_STATUS", confidence: 0.9}
- **Input**: "mark it as completed" → **Output**: {intent: "UPDATE_STATUS", value: "COMPLETED", confidence: 0.8}

### Date Update Intents
- **Input**: "change date" → **Output**: {intent: "UPDATE_DATE", confidence: 1.0}
- **Input**: "reschedule" → **Output**: {intent: "UPDATE_DATE", confidence: 0.9}
- **Input**: "move it to tomorrow" → **Output**: {intent: "UPDATE_DATE", value: "tomorrow", confidence: 0.8}

### Assignee Update Intents
- **Input**: "change assignee" → **Output**: {intent: "UPDATE_ASSIGNEE", confidence: 1.0}
- **Input**: "assign to john" → **Output**: {intent: "UPDATE_ASSIGNEE", value: "john", confidence: 0.9}

### Note Addition Intents
- **Input**: "add note" → **Output**: {intent: "ADD_NOTE", confidence: 1.0}
- **Input**: "leave a comment" → **Output**: {intent: "ADD_NOTE", confidence: 0.8}

## Confirmation Recognition

### Affirmative Responses
- **Input**: "yes" → **Output**: {confirmation: true, confidence: 1.0}
- **Input**: "correct" → **Output**: {confirmation: true, confidence: 0.9}
- **Input**: "that's right" → **Output**: {confirmation: true, confidence: 0.8}
- **Input**: "yep" → **Output**: {confirmation: true, confidence: 0.9}

### Negative Responses
- **Input**: "no" → **Output**: {confirmation: false, confidence: 1.0}
- **Input**: "incorrect" → **Output**: {confirmation: false, confidence: 0.9}
- **Input**: "that's wrong" → **Output**: {confirmation: false, confidence: 0.8}

### Ambiguous Responses
- **Input**: "maybe" → **Output**: {error: "AMBIGUOUS", retryable: true}
- **Input**: "I think so" → **Output**: {confirmation: true, confidence: 0.5}

## Value Extraction Tests

### Status Values
- **Input**: "completed" → **Output**: {value: "COMPLETED", confidence: 1.0}
- **Input**: "in progress" → **Output**: {value: "IN_PROGRESS", confidence: 1.0}
- **Input**: "on hold" → **Output**: {value: "ON_HOLD", confidence: 1.0}

### Date Values
- **Input**: "march 15th" → **Output**: {value: "2024-03-15", confidence: 0.9}
- **Input**: "tomorrow" → **Output**: {value: "2024-03-16", confidence: 0.8}
- **Input**: "next friday" → **Output**: {value: "2024-03-22", confidence: 0.7}

### Name Values
- **Input**: "john smith" → **Output**: {value: "John Smith", confidence: 0.9}
- **Input**: "maría garcía" → **Output**: {value: "María García", confidence: 0.9}

## Multi-Language Support

### Spanish Inputs
- **Input**: "sí" → **Output**: {confirmation: true, confidence: 1.0}
- **Input**: "cambiar estado" → **Output**: {intent: "UPDATE_STATUS", confidence: 0.9}
- **Input**: "completado" → **Output**: {value: "COMPLETED", confidence: 1.0}

## Error Handling
- **Null Input**: Return appropriate error for empty input
- **Gibberish**: Low confidence score triggers retry
- **Multiple Intents**: Disambiguate or ask for clarification
- **Confidence Thresholds**: Define minimum confidence for acceptance

## TODO
- Add fuzzy matching for similar-sounding words
- Implement context-aware interpretation
- Add support for corrections ("no, I meant...")
