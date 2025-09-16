/**
 * Conversation summarizer for reason collection
 * Intelligently summarizes long responses while preserving key information
 */

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  category: string;
  confidence: number;
  originalLength: number;
  summaryLength: number;
}

/**
 * Summarize long conversation responses
 */
export function summarizeConversation(input: string): SummaryResult {
  const text = input.trim();
  
  console.log(`Summarizing conversation: "${text.substring(0, 100)}..."`);

  // Extract key points
  const keyPoints = extractKeyPoints(text);
  
  // Categorize the main reason
  const category = categorizeMainReason(text);
  
  // Generate concise summary
  const summary = generateConciseSummary(text, keyPoints, category);
  
  // Calculate confidence
  const confidence = calculateSummaryConfidence(text, keyPoints);
  
  return {
    summary,
    keyPoints,
    category,
    confidence,
    originalLength: text.length,
    summaryLength: summary.length,
  };
}

/**
 * Extract key points from longer text
 */
function extractKeyPoints(text: string): string[] {
  const keyPoints: string[] = [];
  
  // Look for key reason indicators
  const reasonPatterns = [
    /because\s+([^.!?]+)/gi,
    /due to\s+([^.!?]+)/gi,
    /have to\s+([^.!?]+)/gi,
    /need to\s+([^.!?]+)/gi,
    /can't\s+([^.!?]+)/gi,
    /unable to\s+([^.!?]+)/gi,
  ];

  for (const pattern of reasonPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 3) {
        keyPoints.push(match[1].trim());
      }
    }
  }

  // Look for specific details
  const detailPatterns = [
    /\b(emergency|urgent|crisis)\b.*?(?:[.!?]|$)/gi,
    /\b(sick|ill|doctor|hospital|medical)\b.*?(?:[.!?]|$)/gi,
    /\b(work|job|meeting|conference)\b.*?(?:[.!?]|$)/gi,
    /\b(family|mother|father|child|kids)\b.*?(?:[.!?]|$)/gi,
    /\b(car|transport|travel|flight)\b.*?(?:[.!?]|$)/gi,
  ];

  for (const pattern of detailPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0] && match[0].trim().length > 10) {
        keyPoints.push(match[0].trim());
      }
    }
  }

  return keyPoints.slice(0, 3); // Keep top 3 key points
}

/**
 * Categorize the main reason from text
 */
function categorizeMainReason(text: string): string {
  const categoryPatterns = [
    { 
      name: 'illness', 
      weight: 3,
      patterns: [/\b(sick|ill|unwell|flu|cold|fever|doctor|medical)\b/gi] 
    },
    { 
      name: 'family_emergency', 
      weight: 4,
      patterns: [/\b(family.*emergency|emergency.*family|family.*crisis)\b/gi] 
    },
    { 
      name: 'work_conflict', 
      weight: 2,
      patterns: [/\b(work|job|meeting|conference|business)\b/gi] 
    },
    { 
      name: 'transportation', 
      weight: 3,
      patterns: [/\b(car|vehicle|transport|ride|travel)\b/gi] 
    },
    { 
      name: 'personal', 
      weight: 1,
      patterns: [/\b(personal|private)\b/gi] 
    },
  ];

  let bestCategory = 'other';
  let bestScore = 0;

  for (const category of categoryPatterns) {
    let score = 0;
    for (const pattern of category.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * category.weight;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category.name;
    }
  }

  return bestCategory;
}

/**
 * Generate concise summary
 */
function generateConciseSummary(text: string, keyPoints: string[], category: string): string {
  // If text is already short, return as-is
  if (text.length <= 50) {
    return text;
  }

  // Generate summary based on category and key points
  const categoryPrefixes: Record<string, string> = {
    illness: 'Health issue',
    family_emergency: 'Family emergency',
    work_conflict: 'Work conflict',
    transportation: 'Transportation problem',
    personal: 'Personal matter',
    scheduling_conflict: 'Scheduling conflict',
    other: 'Unable to attend',
  };

  const prefix = categoryPrefixes[category] || categoryPrefixes.other;
  
  if (keyPoints.length > 0) {
    // Use the most relevant key point
    const mainPoint = keyPoints[0];
    return `${prefix}: ${mainPoint}`;
  }
  
  // Fallback: truncate original text
  return text.length > 60 ? `${text.substring(0, 57)}...` : text;
}

/**
 * Calculate confidence in summary accuracy
 */
function calculateSummaryConfidence(text: string, keyPoints: string[]): number {
  let confidence = 0.7; // Base confidence
  
  // Higher confidence for longer, more detailed text
  if (text.length > 30) confidence += 0.1;
  if (text.length > 60) confidence += 0.1;
  
  // Higher confidence if we extracted key points
  confidence += keyPoints.length * 0.05;
  
  // Higher confidence for clear sentence structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length >= 2) confidence += 0.1;
  
  return Math.min(0.95, confidence);
}

/**
 * Generate natural reason collection prompt
 */
export function generateNaturalReasonPrompt(appointmentDate: string, attempt: number = 1): string {
  const prompts = [
    `I understand you can't make the appointment for ${appointmentDate}. Could you tell me why? This helps our team understand and assist better.`,
    `Could you give me a bit more detail about why you can't make the ${appointmentDate} appointment?`,
    `I'd like to understand the situation better. What's preventing you from making the appointment on ${appointmentDate}?`,
  ];

  const index = Math.min(attempt - 1, prompts.length - 1);
  return prompts[index];
}

/**
 * Generate empathetic response based on reason category
 */
export function generateEmpatheticResponse(
  category: string,
  summary: string,
  appointmentDate: string
): string {
  const responses: Record<string, string> = {
    illness: `I'm sorry you're not feeling well. I hope you feel better soon. I'll mark the ${appointmentDate} appointment as open for someone else.`,
    family_emergency: `I'm sorry to hear about the family emergency. Family comes first, and we completely understand. I'll take care of reassigning the appointment.`,
    work_conflict: `I understand work commitments can be challenging to manage. No worries at all. I'll mark this as available for another team member.`,
    transportation: `I see there's a transportation issue. These things happen and we completely understand. I'll reassign the appointment right away.`,
    personal: `I understand it's a personal matter. Thank you for letting us know. I'll take care of reassigning the appointment.`,
    scheduling_conflict: `I see there's a scheduling conflict. These things happen with busy schedules. I'll mark this as open for others.`,
    other: `I understand you can't make the appointment. Thank you for letting us know in advance. I'll reassign it to someone else.`,
  };

  return responses[category] || responses.other;
}

/**
 * Check if response indicates emotional distress
 */
export function detectEmotionalDistress(text: string): {
  hasDistress: boolean;
  supportiveResponse?: string;
} {
  const distressPatterns = [
    /\b(stressed|overwhelmed|anxious|worried|scared|upset|crying)\b/i,
    /\b(can't handle|too much|breaking down|falling apart)\b/i,
    /\b(emergency|crisis|disaster|terrible|awful)\b/i,
  ];

  const hasDistress = distressPatterns.some(pattern => pattern.test(text));
  
  if (hasDistress) {
    return {
      hasDistress: true,
      supportiveResponse: 'I can hear this is a difficult situation for you. Please don\'t worry about the appointment - we\'ll take care of everything. Is there anything else I can help you with?',
    };
  }

  return { hasDistress: false };
}

/**
 * Test reason processing and summarization
 */
export function testReasonSummarization() {
  const testCases = [
    'I have a family emergency and need to be out of town to take care of my mother who fell and broke her hip',
    'I\'m sick with the flu and have a high fever so I can\'t leave the house',
    'I have an important work meeting that got moved to the same time and I can\'t reschedule it',
    'My car broke down this morning and I have no other way to get there',
    'Can\'t make it',
    'Something personal came up',
    'I\'m really stressed and overwhelmed with everything going on and I just can\'t handle another appointment today',
  ];

  console.log('Testing reason summarization:');
  console.log('============================');
  
  testCases.forEach(testCase => {
    const result = summarizeConversation(testCase);
    console.log(`Original (${result.originalLength} chars): "${testCase}"`);
    console.log(`Summary (${result.summaryLength} chars): "${result.summary}"`);
    console.log(`Category: ${result.category}, Confidence: ${result.confidence}`);
    console.log(`Key Points: ${result.keyPoints.join('; ')}`);
    console.log('');
  });
}
