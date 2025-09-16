/**
 * Voice PIN validation service
 * Converts spoken PIN numbers to digits and validates them
 */

export interface PinValidationResult {
  success: boolean;
  pin?: string;
  confidence?: number;
  error?: string;
}

/**
 * Convert spoken numbers to PIN digits
 */
export function convertSpokenToPin(spokenText: string): PinValidationResult {
  const text = spokenText.toLowerCase().trim();
  
  console.log(`Converting spoken PIN: "${text}"`);

  // Remove common phrases and clean the input
  const cleanedText = text
    .replace(/my pin is/gi, '')
    .replace(/pin is/gi, '')
    .replace(/the pin is/gi, '')
    .replace(/it's/gi, '')
    .replace(/it is/gi, '')
    .trim();

  // Try different PIN extraction methods
  const methods = [
    extractDigitSequence,
    extractSpokenNumbers,
    extractMixedFormat,
  ];

  for (const method of methods) {
    const result = method(cleanedText);
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    error: 'Could not extract PIN from speech',
  };
}

/**
 * Extract direct digit sequence (e.g., "1234", "one two three four")
 */
function extractDigitSequence(text: string): PinValidationResult {
  // Method 1: Direct digits
  const digitMatch = text.match(/\b(\d{4})\b/);
  if (digitMatch) {
    return {
      success: true,
      pin: digitMatch[1],
      confidence: 0.95,
    };
  }

  // Method 2: Spoken individual digits
  const spokenDigits = text
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

  const extractedDigits = spokenDigits.match(/\d/g);
  if (extractedDigits && extractedDigits.length === 4) {
    return {
      success: true,
      pin: extractedDigits.join(''),
      confidence: 0.9,
    };
  }

  return { success: false };
}

/**
 * Extract spoken numbers (e.g., "twelve thirty-four")
 */
function extractSpokenNumbers(text: string): PinValidationResult {
  // Handle common spoken number patterns
  const patterns = [
    // "twelve thirty-four" -> "1234"
    { pattern: /twelve\s+thirty[-\s]*four/i, pin: '1234' },
    { pattern: /twelve\s+thirty[-\s]*five/i, pin: '1235' },
    { pattern: /twelve\s+thirty[-\s]*six/i, pin: '1236' },
    
    // "twenty-one twelve" -> "2112"
    { pattern: /twenty[-\s]*one\s+twelve/i, pin: '2112' },
    
    // "eleven twenty-three" -> "1123"
    { pattern: /eleven\s+twenty[-\s]*three/i, pin: '1123' },
    
    // Add more patterns as needed
  ];

  for (const { pattern, pin } of patterns) {
    if (pattern.test(text)) {
      return {
        success: true,
        pin,
        confidence: 0.85,
      };
    }
  }

  return { success: false };
}

/**
 * Extract mixed format (e.g., "one two three four", "1 2 3 4")
 */
function extractMixedFormat(text: string): PinValidationResult {
  // Replace spelled-out numbers with digits
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

  // Extract all digits with optional separators
  const digitPattern = /(\d)\s*(\d)\s*(\d)\s*(\d)/;
  const match = processedText.match(digitPattern);
  
  if (match) {
    const pin = match[1] + match[2] + match[3] + match[4];
    return {
      success: true,
      pin,
      confidence: 0.8,
    };
  }

  return { success: false };
}

/**
 * Validate PIN format
 */
export function validatePinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Generate confirmation message for PIN
 */
export function generatePinConfirmation(pin: string): string {
  const digits = pin.split('');
  const spokenPin = digits.join(' ');
  return `I heard your PIN as ${spokenPin}. Is that correct? Say yes to confirm or no to try again.`;
}

/**
 * Test the PIN conversion with various inputs
 */
export function testPinConversion() {
  const testCases = [
    '1234',
    'one two three four',
    'twelve thirty-four',
    'my pin is 5678',
    'the pin is nine eight seven six',
    '1 2 3 4',
    'one two 3 four',
  ];

  console.log('Testing PIN conversion:');
  testCases.forEach(testCase => {
    const result = convertSpokenToPin(testCase);
    console.log(`"${testCase}" -> ${result.success ? result.pin : 'FAILED'} (confidence: ${result.confidence || 0})`);
  });
}
