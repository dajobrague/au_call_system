/**
 * Text Extractor Utility
 * Extracts readable text from TwiML responses
 */

/**
 * Extract text from TwiML response
 * @param result - Processing result with TwiML
 * @returns Extracted text or empty string
 */
export function extractResponseText(result: any): string {
  if (!result || !result.twiml) {
    return '';
  }
  
  const twiml = result.twiml;
  
  // Extract text from <Say> tags
  const sayMatches = twiml.match(/<Say[^>]*>(.*?)<\/Say>/gi);
  if (sayMatches && sayMatches.length > 0) {
    // Filter out the "We didn't receive your input" fallback message
    const texts = sayMatches
      .map((match: string) => {
        const textMatch = match.match(/<Say[^>]*>(.*?)<\/Say>/i);
        return textMatch ? textMatch[1].trim() : '';
      })
      .filter((text: string) => {
        // Exclude fallback messages
        return text.length > 0 && 
               !text.includes("We didn't receive your input") &&
               !text.includes("We did not receive");
      });
    
    return texts.join(' ');
  }
  
  return '';
}
