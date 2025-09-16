/**
 * Voice job code parsing service
 * Converts spoken job codes to alphanumeric format
 */

export interface JobCodeParsingResult {
  success: boolean;
  jobCode?: string;
  confidence?: number;
  originalInput?: string;
  error?: string;
  method?: string;
}

/**
 * Convert spoken job code to alphanumeric format
 */
export function parseVoiceJobCode(spokenText: string): JobCodeParsingResult {
  const text = spokenText.toLowerCase().trim();
  
  console.log(`Parsing voice job code: "${text}"`);

  // Remove common phrases and clean the input
  const cleanedText = text
    .replace(/my job code is/gi, '')
    .replace(/job code is/gi, '')
    .replace(/the job code is/gi, '')
    .replace(/code is/gi, '')
    .replace(/it's/gi, '')
    .replace(/it is/gi, '')
    .trim();

  // Try different parsing methods in order of confidence
  const methods = [
    { name: 'direct_alphanumeric', func: extractDirectAlphanumeric },
    { name: 'spoken_digits', func: extractSpokenDigits },
    { name: 'phonetic_spelling', func: extractPhoneticSpelling },
    { name: 'mixed_format', func: extractMixedFormat },
    { name: 'natural_language', func: extractFromNaturalLanguage },
  ];

  for (const method of methods) {
    const result = method.func(cleanedText);
    if (result.success) {
      return {
        ...result,
        originalInput: spokenText,
        method: method.name,
      };
    }
  }

  return {
    success: false,
    error: 'Could not extract job code from speech',
    originalInput: spokenText,
  };
}

/**
 * Extract direct alphanumeric codes (e.g., "AB12", "1234")
 */
function extractDirectAlphanumeric(text: string): JobCodeParsingResult {
  // Look for alphanumeric sequences
  const alphanumericMatch = text.match(/\b([A-Z0-9]{2,8})\b/i);
  
  if (alphanumericMatch) {
    return {
      success: true,
      jobCode: alphanumericMatch[1].toUpperCase(),
      confidence: 0.95,
    };
  }

  return { success: false };
}

/**
 * Extract spoken individual digits/letters
 */
function extractSpokenDigits(text: string): JobCodeParsingResult {
  // Replace spoken numbers and letters with their symbols
  let processedText = text
    // Numbers
    .replace(/\bzero\b/g, '0')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9')
    // Letters
    .replace(/\ba\b/g, 'A')
    .replace(/\bb\b/g, 'B')
    .replace(/\bc\b/g, 'C')
    .replace(/\bd\b/g, 'D')
    .replace(/\be\b/g, 'E')
    .replace(/\bf\b/g, 'F')
    .replace(/\bg\b/g, 'G')
    .replace(/\bh\b/g, 'H')
    .replace(/\bi\b/g, 'I')
    .replace(/\bj\b/g, 'J')
    .replace(/\bk\b/g, 'K')
    .replace(/\bl\b/g, 'L')
    .replace(/\bm\b/g, 'M')
    .replace(/\bn\b/g, 'N')
    .replace(/\bo\b/g, 'O')
    .replace(/\bp\b/g, 'P')
    .replace(/\bq\b/g, 'Q')
    .replace(/\br\b/g, 'R')
    .replace(/\bs\b/g, 'S')
    .replace(/\bt\b/g, 'T')
    .replace(/\bu\b/g, 'U')
    .replace(/\bv\b/g, 'V')
    .replace(/\bw\b/g, 'W')
    .replace(/\bx\b/g, 'X')
    .replace(/\by\b/g, 'Y')
    .replace(/\bz\b/g, 'Z');

  // Extract alphanumeric characters
  const extractedChars = processedText.match(/[A-Z0-9]/g);
  
  if (extractedChars && extractedChars.length >= 2 && extractedChars.length <= 8) {
    return {
      success: true,
      jobCode: extractedChars.join(''),
      confidence: 0.9,
    };
  }

  return { success: false };
}

/**
 * Extract phonetic alphabet spelling (e.g., "alpha bravo one two")
 */
function extractPhoneticSpelling(text: string): JobCodeParsingResult {
  const phoneticMap: Record<string, string> = {
    // NATO phonetic alphabet
    'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D', 'echo': 'E',
    'foxtrot': 'F', 'golf': 'G', 'hotel': 'H', 'india': 'I', 'juliet': 'J',
    'kilo': 'K', 'lima': 'L', 'mike': 'M', 'november': 'N', 'oscar': 'O',
    'papa': 'P', 'quebec': 'Q', 'romeo': 'R', 'sierra': 'S', 'tango': 'T',
    'uniform': 'U', 'victor': 'V', 'whiskey': 'W', 'x-ray': 'X', 'yankee': 'Y', 'zulu': 'Z',
    
    // Common alternatives
    'able': 'A', 'baker': 'B', 'cat': 'C', 'dog': 'D',
    
    // Numbers as words
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  };

  let result = text;
  
  // Replace phonetic words with their letters/numbers
  for (const [phonetic, char] of Object.entries(phoneticMap)) {
    const pattern = new RegExp(`\\b${phonetic}\\b`, 'gi');
    result = result.replace(pattern, char);
  }

  // Extract the resulting alphanumeric sequence
  const extractedChars = result.match(/[A-Z0-9]/g);
  
  if (extractedChars && extractedChars.length >= 2 && extractedChars.length <= 8) {
    return {
      success: true,
      jobCode: extractedChars.join(''),
      confidence: 0.85,
    };
  }

  return { success: false };
}

/**
 * Extract mixed format (e.g., "A B 1 2", "alpha one two three")
 */
function extractMixedFormat(text: string): JobCodeParsingResult {
  // Handle mixed spoken and direct input
  let processedText = text
    // Phonetic letters
    .replace(/\balpha\b/gi, 'A')
    .replace(/\bbravo\b/gi, 'B')
    .replace(/\bcharlie\b/gi, 'C')
    .replace(/\bdelta\b/gi, 'D')
    .replace(/\becho\b/gi, 'E')
    .replace(/\bfoxtrot\b/gi, 'F')
    // Numbers
    .replace(/\bzero\b/gi, '0')
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4')
    .replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6')
    .replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8')
    .replace(/\bnine\b/gi, '9');

  // Extract alphanumeric with optional separators
  const codePattern = /([A-Z0-9])\s*([A-Z0-9])\s*([A-Z0-9]*)\s*([A-Z0-9]*)\s*([A-Z0-9]*)\s*([A-Z0-9]*)/i;
  const match = processedText.match(codePattern);
  
  if (match) {
    const chars = [match[1], match[2], match[3], match[4], match[5], match[6]]
      .filter(char => char && char.trim())
      .map(char => char.toUpperCase());
    
    if (chars.length >= 2 && chars.length <= 8) {
      return {
        success: true,
        jobCode: chars.join(''),
        confidence: 0.8,
      };
    }
  }

  return { success: false };
}

/**
 * Extract from natural language patterns
 */
function extractFromNaturalLanguage(text: string): JobCodeParsingResult {
  // Handle phrases like "job code AB12", "it's 1234", "the code is XYZ"
  const patterns = [
    /job\s+code\s+([A-Z0-9]+)/i,
    /code\s+([A-Z0-9]+)/i,
    /it'?s\s+([A-Z0-9]+)/i,
    /is\s+([A-Z0-9]+)/i,
    /([A-Z0-9]+)/i, // Last resort - any alphanumeric sequence
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 2 && match[1].length <= 8) {
      return {
        success: true,
        jobCode: match[1].toUpperCase(),
        confidence: 0.7,
      };
    }
  }

  return { success: false };
}

/**
 * Validate job code format
 */
export function validateJobCodeFormat(jobCode: string): boolean {
  return /^[A-Z0-9]{2,8}$/i.test(jobCode);
}

/**
 * Generate natural confirmation for job code
 */
export function generateJobCodeConfirmation(jobCode: string): string {
  const chars = jobCode.split('');
  const spokenCode = chars.join(' ');
  return `I heard job code ${spokenCode}. Is that correct?`;
}

/**
 * Generate natural job code request prompt
 */
export function generateJobCodeRequest(isRetry: boolean = false): string {
  if (isRetry) {
    return 'I didn\'t get the job code clearly. Could you say your job code again? You can say the numbers and letters, or spell it out.';
  }
  
  return 'What\'s your job code? You can say the numbers and letters, or spell them out if needed.';
}

/**
 * Handle unclear job code input
 */
export function generateJobCodeClarification(attemptNumber: number): string {
  const clarifications = [
    'I didn\'t catch your job code clearly. Could you repeat it?',
    'I\'m having trouble hearing the job code. Please say each character clearly.',
    'Let me try a different approach. Could you spell out your job code letter by letter?',
  ];

  const index = Math.min(attemptNumber - 1, clarifications.length - 1);
  return clarifications[index];
}

/**
 * Test job code parsing with various formats
 */
export function testJobCodeParsing() {
  const testCases = [
    // Direct formats
    { input: 'AB12', expected: 'AB12', type: 'direct' },
    { input: '1234', expected: '1234', type: 'numeric' },
    
    // Spoken formats
    { input: 'A B 1 2', expected: 'AB12', type: 'spaced' },
    { input: 'one two three four', expected: '1234', type: 'spoken_numbers' },
    
    // Phonetic formats
    { input: 'alpha bravo one two', expected: 'AB12', type: 'phonetic' },
    { input: 'charlie delta three four', expected: 'CD34', type: 'phonetic' },
    
    // Natural language
    { input: 'my job code is XYZ123', expected: 'XYZ123', type: 'natural' },
    { input: 'the code is 5678', expected: '5678', type: 'natural' },
    { input: 'it\'s alpha one two three', expected: 'A123', type: 'mixed' },
    
    // Complex formats
    { input: 'alpha bravo charlie one two three', expected: 'ABC123', type: 'long_phonetic' },
    { input: 'job code is A B C D', expected: 'ABCD', type: 'spelled_letters' },
  ];

  console.log('Testing job code parsing:');
  console.log('========================');
  
  testCases.forEach(testCase => {
    const result = parseVoiceJobCode(testCase.input);
    const success = result.success && result.jobCode === testCase.expected;
    const confidence = result.confidence || 0;
    
    console.log(`"${testCase.input}" (${testCase.type})`);
    console.log(`  → ${result.jobCode || 'FAILED'} (expected: ${testCase.expected}) ${success ? '✅' : '❌'} (confidence: ${confidence})`);
    if (result.method) {
      console.log(`  Method: ${result.method}`);
    }
    console.log('');
  });
}

/**
 * Get suggestions for unclear job code input
 */
export function getJobCodeSuggestions(failedInput: string): string[] {
  const suggestions = [
    'Try saying each character separately, like "A B 1 2"',
    'You can use the phonetic alphabet, like "Alpha Bravo One Two"',
    'Say it naturally, like "My job code is AB12"',
    'Spell it out clearly, pausing between each character',
  ];

  // Return different suggestions based on what might have failed
  if (failedInput.includes(' ')) {
    return [suggestions[3], suggestions[1]]; // Already spaced, try clearer spelling
  } else if (failedInput.length > 10) {
    return [suggestions[0], suggestions[2]]; // Too long, try simpler format
  } else {
    return [suggestions[0], suggestions[1]]; // Standard suggestions
  }
}

/**
 * Determine if input might be a partial job code
 */
export function isPartialJobCode(input: string): boolean {
  const cleaned = input.replace(/[^A-Z0-9]/gi, '');
  return cleaned.length === 1 || (cleaned.length > 0 && cleaned.length < 2);
}

/**
 * Generate helpful prompt for partial job code
 */
export function generatePartialJobCodePrompt(partialCode: string): string {
  return `I heard "${partialCode}". Could you continue with the rest of your job code?`;
}

/**
 * Validate job code against common patterns
 */
export function validateJobCodePattern(jobCode: string): {
  isValid: boolean;
  pattern?: string;
  suggestion?: string;
} {
  const patterns = [
    { regex: /^[A-Z]{2}\d{2}$/, name: 'Two letters + two digits (AB12)' },
    { regex: /^\d{4}$/, name: 'Four digits (1234)' },
    { regex: /^[A-Z]{1}\d{3}$/, name: 'One letter + three digits (A123)' },
    { regex: /^[A-Z]{3}\d{3}$/, name: 'Three letters + three digits (ABC123)' },
    { regex: /^[A-Z0-9]{4,6}$/, name: 'Mixed alphanumeric (4-6 chars)' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(jobCode)) {
      return {
        isValid: true,
        pattern: pattern.name,
      };
    }
  }

  // Provide suggestion based on length
  let suggestion = 'Job codes are usually 2-8 characters with letters and numbers.';
  if (jobCode.length < 2) {
    suggestion = 'Job codes are usually at least 2 characters long.';
  } else if (jobCode.length > 8) {
    suggestion = 'Job codes are usually no more than 8 characters long.';
  }

  return {
    isValid: false,
    suggestion,
  };
}

/**
 * Create job code test interface
 */
export function createJobCodeTestSuite(): {
  testInput: (input: string) => JobCodeParsingResult;
  runAllTests: () => void;
  validateFormat: (code: string) => boolean;
} {
  return {
    testInput: parseVoiceJobCode,
    runAllTests: testJobCodeParsing,
    validateFormat: validateJobCodeFormat,
  };
}
