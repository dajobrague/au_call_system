/**
 * Intent parser for natural language commands
 * Converts conversational speech to FSM-compatible inputs
 */

export interface IntentResult {
  success: boolean;
  intent?: string;
  confidence?: number;
  originalText?: string;
  error?: string;
  context?: string;
}

export interface IntentPattern {
  patterns: RegExp[];
  intent: string;
  confidence: number;
  context?: string;
}

/**
 * Intent patterns for different conversation contexts
 */
const INTENT_PATTERNS: Record<string, IntentPattern[]> = {
  // Job options context
  job_options: [
    {
      patterns: [
        /\b(reschedule|change|move|shift)\b.*\b(appointment|time|date)\b/i,
        /\b(reschedule|change|move|shift)\b/i,
        /\b(different|new|another)\b.*\b(time|date)\b/i,
        /\bwant.*\b(reschedule|change|move)\b/i,
        /\bneed.*\b(reschedule|change|move)\b/i,
      ],
      intent: '1',
      confidence: 0.9,
      context: 'User wants to reschedule appointment',
    },
    {
      patterns: [
        /\b(can't|cannot|unable)\b.*\b(make|take|do)\b/i,
        /\b(leave|mark).*\b(open|available)\b/i,
        /\bsomeone else\b/i,
        /\bother.*\b(person|employee|worker)\b/i,
        /\bpass.*\b(along|on)\b/i,
        /\bgive.*\b(someone else|another)\b/i,
      ],
      intent: '2',
      confidence: 0.85,
      context: 'User wants to leave job open for others',
    },
    {
      patterns: [
        /\b(talk|speak).*\b(person|human|representative|someone)\b/i,
        /\b(representative|agent|operator)\b/i,
        /\b(human|person)\b/i,
        /\bhelp.*\b(person|human)\b/i,
        /\btransfer.*\b(person|human|representative)\b/i,
      ],
      intent: '3',
      confidence: 0.95,
      context: 'User wants to talk to representative',
    },
    {
      patterns: [
        /\b(different|wrong|other|another)\b.*\b(job|code|number)\b/i,
        /\bwrong.*\bjob\b/i,
        /\bnot.*\b(right|correct)\b.*\bjob\b/i,
        /\benter.*\b(different|new|another)\b.*\bcode\b/i,
      ],
      intent: '4',
      confidence: 0.9,
      context: 'User wants to enter different job code',
    },
  ],

  // Confirmation context
  confirmation: [
    {
      patterns: [
        /\b(yes|yeah|yep|correct|right|that's right|exactly|perfect)\b/i,
        /\bthat's.*\b(correct|right|good|perfect)\b/i,
        /\bconfirm\b/i,
        /\bgo ahead\b/i,
      ],
      intent: '1',
      confidence: 0.95,
      context: 'User confirms/agrees',
    },
    {
      patterns: [
        /\b(no|nope|wrong|incorrect|not right)\b/i,
        /\bthat's.*\b(wrong|incorrect|not right)\b/i,
        /\btry again\b/i,
        /\bstart over\b/i,
      ],
      intent: '2',
      confidence: 0.95,
      context: 'User rejects/disagrees',
    },
  ],

  // Provider selection context
  provider_selection: [
    {
      patterns: [
        /\b(first|one|1)\b/i,
        /\bchoose.*\b(first|one)\b/i,
        /\bselect.*\b(first|one)\b/i,
      ],
      intent: '1',
      confidence: 0.9,
      context: 'Select first provider',
    },
    {
      patterns: [
        /\b(second|two|2)\b/i,
        /\bchoose.*\b(second|two)\b/i,
        /\bselect.*\b(second|two)\b/i,
      ],
      intent: '2',
      confidence: 0.9,
      context: 'Select second provider',
    },
    {
      patterns: [
        /\b(third|three|3)\b/i,
        /\bchoose.*\b(third|three)\b/i,
        /\bselect.*\b(third|three)\b/i,
      ],
      intent: '3',
      confidence: 0.9,
      context: 'Select third provider',
    },
  ],

  // Occurrence selection context
  occurrence_selection: [
    {
      patterns: [
        /\b(first|one|1)\b.*\b(appointment|visit|session)\b/i,
        /\bfirst\b/i,
        /\bone\b/i,
      ],
      intent: '1',
      confidence: 0.85,
      context: 'Select first appointment',
    },
    {
      patterns: [
        /\b(second|two|2)\b.*\b(appointment|visit|session)\b/i,
        /\bsecond\b/i,
        /\btwo\b/i,
      ],
      intent: '2',
      confidence: 0.85,
      context: 'Select second appointment',
    },
    {
      patterns: [
        /\b(third|three|3)\b.*\b(appointment|visit|session)\b/i,
        /\bthird\b/i,
        /\bthree\b/i,
      ],
      intent: '3',
      confidence: 0.85,
      context: 'Select third appointment',
    },
  ],
};

/**
 * Parse intent from natural language input
 */
export function parseIntent(
  input: string, 
  context: string = 'general'
): IntentResult {
  const text = input.toLowerCase().trim();
  
  console.log(`Parsing intent: "${text}" in context: ${context}`);

  if (!text) {
    return {
      success: false,
      error: 'No input provided',
      originalText: input,
    };
  }

  // Get patterns for the current context
  const contextPatterns = INTENT_PATTERNS[context] || [];
  
  // Try context-specific patterns first
  for (const pattern of contextPatterns) {
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        console.log(`Intent matched: "${text}" → ${pattern.intent} (confidence: ${pattern.confidence})`);
        
        return {
          success: true,
          intent: pattern.intent,
          confidence: pattern.confidence,
          originalText: input,
          context: pattern.context,
        };
      }
    }
  }

  // Try general patterns if no context match
  if (context !== 'general') {
    return parseIntent(input, 'general');
  }

  // No pattern matched
  return {
    success: false,
    error: 'No intent pattern matched',
    originalText: input,
    confidence: 0,
  };
}

/**
 * Generate clarification prompt when intent is unclear
 */
export function generateClarificationPrompt(
  context: string,
  originalInput?: string
): string {
  const clarifications: Record<string, string> = {
    job_options: 'I didn\'t catch that. Would you like to reschedule your appointment, leave it open for someone else, or talk to a representative?',
    confirmation: 'I didn\'t understand. Please say yes to confirm or no to try again.',
    provider_selection: 'I didn\'t catch which provider you chose. Please say the number of your provider.',
    occurrence_selection: 'I didn\'t understand which appointment you want. Please say the number of the appointment.',
    general: 'I didn\'t understand that. Could you please repeat what you\'d like to do?',
  };

  return clarifications[context] || clarifications.general;
}

/**
 * Get confidence threshold for context
 */
export function getConfidenceThreshold(context: string): number {
  const thresholds: Record<string, number> = {
    job_options: 0.8,        // High confidence needed for job actions
    confirmation: 0.85,      // Very high confidence for confirmations
    provider_selection: 0.8, // High confidence for provider selection
    occurrence_selection: 0.8, // High confidence for appointment selection
    general: 0.7,           // Lower threshold for general conversation
  };

  return thresholds[context] || 0.7;
}

/**
 * Enhanced intent parsing with context awareness
 */
export function parseIntentWithContext(
  input: string,
  context: string,
  previousContext?: string
): IntentResult {
  const result = parseIntent(input, context);
  
  // If confidence is too low, try previous context
  if (!result.success || (result.confidence || 0) < getConfidenceThreshold(context)) {
    if (previousContext && previousContext !== context) {
      const fallbackResult = parseIntent(input, previousContext);
      if (fallbackResult.success && (fallbackResult.confidence || 0) >= getConfidenceThreshold(previousContext)) {
        return {
          ...fallbackResult,
          context: `Fallback to ${previousContext}`,
        };
      }
    }
  }

  return result;
}

/**
 * Test intent parsing with various inputs
 */
export function testIntentParsing() {
  const testCases = [
    // Job options tests
    { input: 'I want to reschedule', context: 'job_options', expected: '1' },
    { input: 'I need to change the time', context: 'job_options', expected: '1' },
    { input: 'I can\'t make it', context: 'job_options', expected: '2' },
    { input: 'leave it open for someone else', context: 'job_options', expected: '2' },
    { input: 'talk to a person', context: 'job_options', expected: '3' },
    { input: 'wrong job code', context: 'job_options', expected: '4' },
    
    // Confirmation tests
    { input: 'yes that\'s correct', context: 'confirmation', expected: '1' },
    { input: 'no that\'s wrong', context: 'confirmation', expected: '2' },
    
    // Provider selection tests
    { input: 'first one', context: 'provider_selection', expected: '1' },
    { input: 'second provider', context: 'provider_selection', expected: '2' },
  ];

  console.log('Testing intent parsing:');
  console.log('=====================');
  
  testCases.forEach(testCase => {
    const result = parseIntent(testCase.input, testCase.context);
    const success = result.success && result.intent === testCase.expected;
    const confidence = result.confidence || 0;
    
    console.log(`"${testCase.input}" (${testCase.context})`);
    console.log(`  → ${result.intent || 'FAILED'} (expected: ${testCase.expected}) ${success ? '✅' : '❌'} (confidence: ${confidence})`);
    console.log('');
  });
}
