/**
 * Enhanced conversational reason collection
 * Processes natural language reasons with empathy and understanding
 */

export interface ReasonProcessingResult {
  success: boolean;
  reason?: string;
  summary?: string;
  category?: string;
  confidence?: number;
  originalInput?: string;
  error?: string;
  needsMoreDetail?: boolean;
  suggestedFollowUp?: string;
}

/**
 * Process and categorize spoken reason
 */
export function processSpokenReason(spokenText: string): ReasonProcessingResult {
  const text = spokenText.toLowerCase().trim();
  
  console.log(`Processing spoken reason: "${text}"`);

  // Remove common filler words and phrases
  const cleanedText = text
    .replace(/\bum\b/gi, '')
    .replace(/\buh\b/gi, '')
    .replace(/\byou know\b/gi, '')
    .replace(/\blike\b/gi, '')
    .replace(/\bwell\b/gi, '')
    .replace(/\bso\b/gi, '')
    .trim();

  // Check if the reason is too short or vague
  if (cleanedText.length < 5) {
    return {
      success: false,
      error: 'Reason too short',
      needsMoreDetail: true,
      suggestedFollowUp: 'Could you give me a bit more detail about why you can\'t make the appointment?',
      originalInput: spokenText,
    };
  }

  // Categorize the reason
  const category = categorizeReason(cleanedText);
  
  // Generate summary
  const summary = summarizeReason(cleanedText, category);
  
  // Check if we need more detail
  const needsDetail = isReasonTooVague(cleanedText);
  
  return {
    success: true,
    reason: cleanedText,
    summary,
    category,
    confidence: calculateReasonConfidence(cleanedText),
    originalInput: spokenText,
    needsMoreDetail: needsDetail,
    suggestedFollowUp: needsDetail ? generateFollowUpQuestion(category) : undefined,
  };
}

/**
 * Categorize reason into common types
 */
function categorizeReason(reason: string): string {
  const categories = [
    { 
      name: 'illness', 
      patterns: [
        /\b(sick|ill|unwell|not feeling well|under the weather|flu|cold|fever)\b/i,
        /\bhave.*\b(cold|flu|fever|headache|stomach)\b/i,
        /\bdon't feel\b/i,
      ]
    },
    { 
      name: 'family_emergency', 
      patterns: [
        /\b(family|emergency|urgent|crisis)\b/i,
        /\bfamily.*\b(emergency|crisis|issue|problem)\b/i,
        /\bemergency.*\bfamily\b/i,
      ]
    },
    { 
      name: 'work_conflict', 
      patterns: [
        /\b(work|job|meeting|conference|appointment)\b.*\b(conflict|clash|overlap)\b/i,
        /\bhave.*\b(work|meeting|appointment)\b/i,
        /\bwork.*\b(emergency|issue|problem)\b/i,
        /\bcan't.*\b(leave|get away from)\b.*\bwork\b/i,
      ]
    },
    { 
      name: 'transportation', 
      patterns: [
        /\b(car|vehicle|transport|ride|bus|train)\b.*\b(broke|broken|problem|issue)\b/i,
        /\bno.*\b(car|ride|transport|way to get)\b/i,
        /\bcar.*\b(won't start|broken down|in shop)\b/i,
      ]
    },
    { 
      name: 'personal', 
      patterns: [
        /\b(personal|private|can't say|rather not say)\b/i,
        /\bpersonal.*\b(matter|issue|reason)\b/i,
      ]
    },
    { 
      name: 'scheduling_conflict', 
      patterns: [
        /\b(double|triple)\b.*\bbooked\b/i,
        /\b(conflict|clash)\b.*\b(schedule|calendar)\b/i,
        /\balready.*\b(scheduled|booked|committed)\b/i,
      ]
    },
  ];

  for (const category of categories) {
    for (const pattern of category.patterns) {
      if (pattern.test(reason)) {
        return category.name;
      }
    }
  }

  return 'other';
}

/**
 * Summarize reason for record-keeping
 */
function summarizeReason(reason: string, category: string): string {
  // Create concise summary based on category
  const summaryTemplates: Record<string, string> = {
    illness: 'Employee is ill',
    family_emergency: 'Family emergency',
    work_conflict: 'Work scheduling conflict',
    transportation: 'Transportation issue',
    personal: 'Personal matter',
    scheduling_conflict: 'Scheduling conflict',
    other: 'Unable to attend',
  };

  const baseTemplate = summaryTemplates[category] || summaryTemplates.other;
  
  // Add specific details if available
  if (reason.length > 20) {
    return `${baseTemplate}: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`;
  }
  
  return `${baseTemplate}: ${reason}`;
}

/**
 * Check if reason is too vague and needs more detail
 */
function isReasonTooVague(reason: string): boolean {
  const vaguePatterns = [
    /^(can't make it|something came up|i can't|not available|busy)$/i,
    /^(personal|private|can't say)$/i,
    /^(sorry|apologize)$/i,
  ];

  return vaguePatterns.some(pattern => pattern.test(reason.trim()));
}

/**
 * Calculate confidence score for reason
 */
function calculateReasonConfidence(reason: string): number {
  let confidence = 0.7; // Base confidence
  
  // Increase confidence for longer, more detailed reasons
  if (reason.length > 20) confidence += 0.1;
  if (reason.length > 40) confidence += 0.1;
  
  // Increase confidence for specific keywords
  const specificKeywords = ['because', 'due to', 'have to', 'need to', 'emergency', 'sick', 'work'];
  const keywordMatches = specificKeywords.filter(keyword => reason.includes(keyword)).length;
  confidence += keywordMatches * 0.05;
  
  // Decrease confidence for very short or vague responses
  if (reason.length < 10) confidence -= 0.2;
  if (isReasonTooVague(reason)) confidence -= 0.3;
  
  return Math.max(0.3, Math.min(0.95, confidence));
}

/**
 * Generate follow-up question based on category
 */
function generateFollowUpQuestion(category: string): string {
  const followUpQuestions: Record<string, string> = {
    illness: 'I understand you\'re not feeling well. Is it something that might affect future appointments too?',
    family_emergency: 'I\'m sorry to hear about the family situation. Is everything okay?',
    work_conflict: 'I understand work can be unpredictable. Is this a one-time conflict or ongoing?',
    transportation: 'I see there\'s a transportation issue. Do you need help finding alternative arrangements?',
    personal: 'I understand it\'s personal. That\'s completely fine.',
    scheduling_conflict: 'I see there\'s a scheduling overlap. Would you like help finding a better time?',
    other: 'Could you give me a bit more detail so I can better help the team understand?',
  };

  return followUpQuestions[category] || followUpQuestions.other;
}

/**
 * Generate natural reason request
 */
export function generateNaturalReasonPrompt(appointmentDate: string, isRetry: boolean = false): string {
  if (isRetry) {
    return `I'd like to understand a bit better. Could you tell me more about why you can't make the appointment for ${appointmentDate}?`;
  }
  
  return `I understand you can't make the appointment for ${appointmentDate}. Could you tell me why? This helps us better assist the team.`;
}

/**
 * Generate empathetic confirmation
 */
export function generateEmpatheticConfirmation(
  reason: string,
  category: string,
  appointmentDate: string
): string {
  const empatheticResponses: Record<string, string> = {
    illness: `I'm sorry you're not feeling well. I understand you can't make the appointment for ${appointmentDate}.`,
    family_emergency: `I'm sorry to hear about the family emergency. I completely understand you need to take care of that.`,
    work_conflict: `I understand work commitments can be challenging to manage. No problem at all.`,
    transportation: `I see there's a transportation issue. These things happen and we completely understand.`,
    personal: `I understand it's a personal matter. Thank you for letting us know.`,
    scheduling_conflict: `I see there's a scheduling conflict. These things happen with busy schedules.`,
    other: `I understand you can't make the appointment. Thank you for letting us know.`,
  };

  const empathetic = empatheticResponses[category] || empatheticResponses.other;
  
  return `${empathetic} I'll mark this appointment as open for other team members and record your reason. Is that okay?`;
}

/**
 * Handle very short responses
 */
export function handleShortResponse(response: string): {
  needsMoreDetail: boolean;
  followUpQuestion: string;
} {
  const shortResponses = [
    'can\'t make it',
    'something came up', 
    'busy',
    'not available',
    'personal',
    'sick',
    'work',
  ];

  if (shortResponses.some(short => response.toLowerCase().includes(short))) {
    const followUpQuestions: Record<string, string> = {
      'sick': 'I\'m sorry you\'re not feeling well. Is it something that might affect other appointments?',
      'work': 'I understand work can be demanding. Is this a one-time conflict?',
      'personal': 'I understand it\'s personal. That\'s completely fine.',
      'busy': 'I understand you\'re busy. Is there anything specific that came up?',
    };

    const matchedKey = Object.keys(followUpQuestions).find(key => response.toLowerCase().includes(key));
    const followUp = matchedKey ? followUpQuestions[matchedKey] : 'Could you give me just a little more detail?';

    return {
      needsMoreDetail: true,
      followUpQuestion: followUp,
    };
  }

  return {
    needsMoreDetail: false,
    followUpQuestion: '',
  };
}

/**
 * Test reason processing with various inputs
 */
export function testReasonProcessing() {
  const testCases = [
    'I have a family emergency and need to be out of town',
    'I\'m sick today with the flu',
    'I have a work meeting that I can\'t reschedule',
    'My car broke down and I have no way to get there',
    'Something personal came up',
    'I\'m double booked with another appointment',
    'Can\'t make it',
    'Sick',
    'Personal reasons',
    'I have to take my mother to the doctor because she fell and hurt her ankle',
  ];

  console.log('Testing reason processing:');
  console.log('========================');
  
  testCases.forEach(testCase => {
    const result = processSpokenReason(testCase);
    console.log(`"${testCase}"`);
    console.log(`  ${result.success ? '✅' : '❌'} Category: ${result.category || 'N/A'}`);
    console.log(`  Summary: ${result.summary || 'N/A'}`);
    console.log(`  Confidence: ${result.confidence || 0}`);
    if (result.needsMoreDetail) {
      console.log(`  ⚠️ Needs more detail: ${result.suggestedFollowUp}`);
    }
    console.log('');
  });
}
