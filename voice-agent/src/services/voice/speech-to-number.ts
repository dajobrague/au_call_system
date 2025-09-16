/**
 * Speech-to-number conversion utilities
 * Converts spoken numbers and text to numeric values
 */

export interface NumberConversionResult {
  success: boolean;
  number?: string;
  confidence?: number;
  error?: string;
}

/**
 * Convert spoken text to numbers
 */
export function convertSpeechToNumber(spokenText: string): NumberConversionResult {
  const text = spokenText.toLowerCase().trim();
  
  console.log(`Converting speech to number: "${text}"`);

  // Try different conversion methods
  const methods = [
    extractDirectDigits,
    extractSpokenDigits,
    extractSpokenNumbers,
    extractJobCodeFormat,
  ];

  for (const method of methods) {
    const result = method(text);
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    error: 'Could not extract number from speech',
  };
}

/**
 * Extract direct digits from text
 */
function extractDirectDigits(text: string): NumberConversionResult {
  // Look for sequences of digits
  const digitMatches = text.match(/\d+/g);
  
  if (digitMatches && digitMatches.length === 1) {
    return {
      success: true,
      number: digitMatches[0],
      confidence: 0.95,
    };
  }

  return { success: false };
}

/**
 * Extract spoken individual digits
 */
function extractSpokenDigits(text: string): NumberConversionResult {
  // Replace spoken digits with numbers
  let processedText = text
    .replace(/\bzero\b/g, '0')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9');

  // Extract all digits
  const digits = processedText.match(/\d/g);
  
  if (digits && digits.length >= 1) {
    return {
      success: true,
      number: digits.join(''),
      confidence: 0.9,
    };
  }

  return { success: false };
}

/**
 * Extract spoken numbers (e.g., "twenty-one", "thirty-four")
 */
function extractSpokenNumbers(text: string): NumberConversionResult {
  const numberMappings = {
    // Single digits
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    
    // Teens
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13', 
    'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
    'eighteen': '18', 'nineteen': '19',
    
    // Tens
    'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50',
    'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
  };

  // Handle compound numbers like "twenty-one", "thirty-four"
  let result = text;
  
  // Replace compound numbers
  for (const [word, digit] of Object.entries(numberMappings)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(pattern, digit);
  }

  // Handle "twenty-one" -> "21" type patterns
  const compoundPattern = /(\d{1,2})\s*[-\s]+(\d)/g;
  result = result.replace(compoundPattern, (match, tens, ones) => {
    return (parseInt(tens) + parseInt(ones)).toString();
  });

  // Extract final numbers
  const numbers = result.match(/\d+/g);
  
  if (numbers && numbers.length === 1) {
    return {
      success: true,
      number: numbers[0],
      confidence: 0.8,
    };
  }

  return { success: false };
}

/**
 * Extract job code format (alphanumeric)
 */
function extractJobCodeFormat(text: string): NumberConversionResult {
  // Handle job codes like "A B 1 2" or "alpha bravo one two"
  let processedText = text
    .replace(/\balpha\b/gi, 'A')
    .replace(/\bbravo\b/gi, 'B')
    .replace(/\bcharlie\b/gi, 'C')
    .replace(/\bdelta\b/gi, 'D')
    .replace(/\becho\b/gi, 'E')
    .replace(/\bfoxtrot\b/gi, 'F')
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

  // Extract alphanumeric sequence
  const alphanumericMatch = processedText.match(/[A-Z0-9\s-]+/gi);
  
  if (alphanumericMatch) {
    const cleaned = alphanumericMatch[0].replace(/[\s-]/g, '');
    if (cleaned.length >= 2 && cleaned.length <= 8) {
      return {
        success: true,
        number: cleaned,
        confidence: 0.85,
      };
    }
  }

  return { success: false };
}

/**
 * Validate if a string could be a valid PIN (4 digits)
 */
export function isValidPin(input: string): boolean {
  return /^\d{4}$/.test(input);
}

/**
 * Validate if a string could be a valid job code (2-8 alphanumeric)
 */
export function isValidJobCode(input: string): boolean {
  return /^[A-Z0-9]{2,8}$/i.test(input);
}

/**
 * Generate natural language confirmation for numbers
 */
export function generateNumberConfirmation(number: string, type: 'pin' | 'jobcode' = 'pin'): string {
  if (type === 'pin' && isValidPin(number)) {
    const digits = number.split('');
    return `I heard your PIN as ${digits.join(' ')}. Is that correct?`;
  }
  
  if (type === 'jobcode' && isValidJobCode(number)) {
    const chars = number.split('');
    return `I heard job code ${chars.join(' ')}. Is that correct?`;
  }
  
  return `I heard ${number}. Is that correct?`;
}

/**
 * Test the number conversion with various inputs
 */
export function testNumberConversion() {
  const testCases = [
    // PIN tests
    { input: '1234', expected: '1234', type: 'direct' },
    { input: 'one two three four', expected: '1234', type: 'spoken' },
    { input: 'my pin is 5678', expected: '5678', type: 'phrase' },
    { input: 'zero nine eight seven', expected: '0987', type: 'spoken' },
    
    // Job code tests
    { input: 'A B 1 2', expected: 'AB12', type: 'jobcode' },
    { input: 'alpha bravo one two', expected: 'AB12', type: 'jobcode' },
    { input: 'charlie delta three four', expected: 'CD34', type: 'jobcode' },
  ];

  console.log('Testing number conversion:');
  testCases.forEach(testCase => {
    const result = convertSpeechToNumber(testCase.input);
    const success = result.success && result.number === testCase.expected;
    console.log(`"${testCase.input}" -> ${result.number || 'FAILED'} (expected: ${testCase.expected}) ${success ? '✅' : '❌'}`);
  });
}
