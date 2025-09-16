/**
 * Phonetic processing for job codes
 * Advanced phonetic alphabet and spelling recognition
 */

export interface PhoneticResult {
  success: boolean;
  result?: string;
  confidence?: number;
  method?: string;
  error?: string;
}

/**
 * Comprehensive phonetic alphabet mapping
 */
const PHONETIC_ALPHABET: Record<string, string> = {
  // NATO Standard
  'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D', 'echo': 'E',
  'foxtrot': 'F', 'golf': 'G', 'hotel': 'H', 'india': 'I', 'juliet': 'J',
  'kilo': 'K', 'lima': 'L', 'mike': 'M', 'november': 'N', 'oscar': 'O',
  'papa': 'P', 'quebec': 'Q', 'romeo': 'R', 'sierra': 'S', 'tango': 'T',
  'uniform': 'U', 'victor': 'V', 'whiskey': 'W', 'xray': 'X', 'x-ray': 'X',
  'yankee': 'Y', 'zulu': 'Z',

  // Alternative phonetics (common variations)
  'able': 'A', 'adam': 'A', 'apple': 'A',
  'baker': 'B', 'boy': 'B', 'ball': 'B',
  'cat': 'C', 'car': 'C',
  'dog': 'D', 'david': 'D', 'door': 'D',
  'easy': 'E', 'edward': 'E', 'egg': 'E',
  'frank': 'F', 'fox': 'F', 'fire': 'F',
  'george': 'G', 'girl': 'G', 'green': 'G',
  'henry': 'H', 'house': 'H', 'hat': 'H',
  'ice': 'I', 'item': 'I', 'ink': 'I',
  'john': 'J', 'jack': 'J', 'jump': 'J',
  'king': 'K', 'key': 'K', 'kite': 'K',
  'love': 'L', 'lady': 'L', 'light': 'L',
  'mary': 'M', 'man': 'M', 'mouse': 'M',
  'nancy': 'N', 'name': 'N', 'night': 'N',
  'ocean': 'O', 'open': 'O', 'orange': 'O',
  'peter': 'P', 'paul': 'P', 'phone': 'P',
  'queen': 'Q', 'quick': 'Q', 'quiet': 'Q',
  'robert': 'R', 'red': 'R', 'radio': 'R',
  'sam': 'S', 'sugar': 'S', 'sun': 'S',
  'tom': 'T', 'table': 'T', 'time': 'T',
  'uncle': 'U', 'under': 'U', 'up': 'U',
  'voice': 'V', 'very': 'V',
  'william': 'W', 'water': 'W', 'white': 'W',
  'xmas': 'X', 'xerox': 'X',
  'yellow': 'Y', 'young': 'Y',
  'zebra': 'Z',

  // Numbers as words
  'zero': '0', 'oh': '0',
  'one': '1', 'won': '1',
  'two': '2', 'to': '2', 'too': '2',
  'three': '3', 'tree': '3',
  'four': '4', 'for': '4', 'fore': '4',
  'five': '5',
  'six': '6', 'sicks': '6',
  'seven': '7',
  'eight': '8', 'ate': '8',
  'nine': '9', 'niner': '9',
};

/**
 * Process phonetic spelling
 */
export function processPhoneticSpelling(input: string): PhoneticResult {
  const text = input.toLowerCase().trim();
  
  console.log(`Processing phonetic spelling: "${text}"`);

  // Method 1: Direct phonetic replacement
  let processed = text;
  let foundMatches = 0;
  
  for (const [phonetic, char] of Object.entries(PHONETIC_ALPHABET)) {
    const pattern = new RegExp(`\\b${phonetic}\\b`, 'gi');
    if (pattern.test(processed)) {
      processed = processed.replace(pattern, char);
      foundMatches++;
    }
  }

  // Extract resulting characters
  const extractedChars = processed.match(/[A-Z0-9]/g);
  
  if (extractedChars && extractedChars.length >= 2 && foundMatches >= 1) {
    return {
      success: true,
      result: extractedChars.join(''),
      confidence: Math.min(0.9, 0.6 + (foundMatches * 0.1)),
      method: 'phonetic_direct',
    };
  }

  // Method 2: Word-by-word analysis
  const words = text.split(/\s+/);
  const convertedChars: string[] = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    if (PHONETIC_ALPHABET[cleanWord]) {
      convertedChars.push(PHONETIC_ALPHABET[cleanWord]);
    } else if (/^[a-z]$/.test(cleanWord)) {
      convertedChars.push(cleanWord.toUpperCase());
    } else if (/^\d$/.test(cleanWord)) {
      convertedChars.push(cleanWord);
    }
  }

  if (convertedChars.length >= 2 && convertedChars.length <= 8) {
    return {
      success: true,
      result: convertedChars.join(''),
      confidence: 0.8,
      method: 'phonetic_word_by_word',
    };
  }

  return {
    success: false,
    error: 'Could not parse phonetic spelling',
  };
}

/**
 * Handle common speech recognition errors
 */
export function correctCommonErrors(input: string): string {
  return input
    // Common STT errors
    .replace(/\bto\b/gi, 'two')
    .replace(/\btoo\b/gi, 'two')
    .replace(/\bfor\b/gi, 'four')
    .replace(/\bfore\b/gi, 'four')
    .replace(/\bate\b/gi, 'eight')
    .replace(/\bwon\b/gi, 'one')
    .replace(/\btree\b/gi, 'three')
    .replace(/\bsicks\b/gi, 'six')
    .replace(/\bniner\b/gi, 'nine')
    // Letter corrections
    .replace(/\bbee\b/gi, 'B')
    .replace(/\bcee\b/gi, 'C')
    .replace(/\bdee\b/gi, 'D')
    .replace(/\bgee\b/gi, 'G')
    .replace(/\bjay\b/gi, 'J')
    .replace(/\bkay\b/gi, 'K')
    .replace(/\bem\b/gi, 'M')
    .replace(/\ben\b/gi, 'N')
    .replace(/\bpee\b/gi, 'P')
    .replace(/\bqueue\b/gi, 'Q')
    .replace(/\bar\b/gi, 'R')
    .replace(/\bess\b/gi, 'S')
    .replace(/\btee\b/gi, 'T')
    .replace(/\byou\b/gi, 'U')
    .replace(/\bvee\b/gi, 'V')
    .replace(/\bdouble you\b/gi, 'W')
    .replace(/\bwhy\b/gi, 'Y')
    .replace(/\bzed\b/gi, 'Z')
    .replace(/\bzee\b/gi, 'Z');
}

/**
 * Smart job code extraction with error correction
 */
export function extractJobCodeSmart(input: string): PhoneticResult {
  // Step 1: Correct common errors
  const correctedInput = correctCommonErrors(input);
  
  // Step 2: Try phonetic processing
  const phoneticResult = processPhoneticSpelling(correctedInput);
  
  if (phoneticResult.success) {
    return phoneticResult;
  }

  // Step 3: Try direct extraction with error correction
  const directResult = extractDirectWithCorrection(correctedInput);
  
  return directResult;
}

/**
 * Direct extraction with error correction
 */
function extractDirectWithCorrection(input: string): PhoneticResult {
  // Remove all non-alphanumeric except spaces and common separators
  const cleaned = input.replace(/[^a-z0-9\s\-]/gi, ' ');
  
  // Split and process each potential character
  const parts = cleaned.split(/\s+/);
  const extractedChars: string[] = [];
  
  for (const part of parts) {
    if (/^[a-z]$/i.test(part)) {
      extractedChars.push(part.toUpperCase());
    } else if (/^\d$/.test(part)) {
      extractedChars.push(part);
    } else if (part.length === 2 && /^[a-z0-9]{2}$/i.test(part)) {
      // Handle cases like "AB" spoken as one word
      extractedChars.push(...part.toUpperCase().split(''));
    }
  }

  if (extractedChars.length >= 2 && extractedChars.length <= 8) {
    return {
      success: true,
      result: extractedChars.join(''),
      confidence: 0.7,
      method: 'direct_with_correction',
    };
  }

  return {
    success: false,
    error: 'Could not extract valid job code',
  };
}
