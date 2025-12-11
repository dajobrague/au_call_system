/**
 * Occurrence Pagination Handler
 * Manages pagination for occurrence lists (max 9 per page)
 */

const ITEMS_PER_PAGE = 9;

export interface PaginationResult {
  currentPage: number;
  totalPages: number;
  pageItems: any[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginate occurrence list
 * @param occurrences - Full list of occurrences
 * @param pageNumber - Current page number (1-based)
 * @returns Paginated result with items for current page
 */
export function paginateOccurrences(
  occurrences: any[],
  pageNumber: number = 1
): PaginationResult {
  if (!occurrences || occurrences.length === 0) {
    return {
      currentPage: 1,
      totalPages: 0,
      pageItems: [],
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  const totalPages = Math.ceil(occurrences.length / ITEMS_PER_PAGE);
  const validPageNumber = Math.max(1, Math.min(pageNumber, totalPages));
  
  const startIndex = (validPageNumber - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, occurrences.length);
  
  const pageItems = occurrences.slice(startIndex, endIndex);
  
  return {
    currentPage: validPageNumber,
    totalPages,
    pageItems,
    hasNextPage: validPageNumber < totalPages,
    hasPreviousPage: validPageNumber > 1
  };
}

/**
 * Generate voice prompt for occurrence list with pagination
 * @param occurrences - Occurrences for current page
 * @param pageNumber - Current page number
 * @param hasNextPage - Whether there are more pages
 * @returns Voice prompt string
 */
export function generateOccurrenceListPrompt(
  occurrences: any[],
  pageNumber: number,
  hasNextPage: boolean
): string {
  if (occurrences.length === 0) {
    return 'You have no upcoming shifts scheduled.';
  }

  let prompt = '';
  
  // Add page indicator if not first page
  if (pageNumber > 1) {
    prompt = `Page ${pageNumber}. `;
  }
  
  // Add count on first page only
  if (pageNumber === 1) {
    const count = occurrences.length;
    const shiftWord = count === 1 ? 'shift' : 'shifts';
    prompt += `You have ${count} upcoming ${shiftWord}. `;
  }
  
  // List occurrences with details
  occurrences.forEach((occurrence, index) => {
    const optionNumber = index + 1;
    const { patient, displayDateTime, jobTemplate } = occurrence;
    
    prompt += `Press ${optionNumber} for your shift with ${patient.firstName} starting at ${displayDateTime}. `;
  });
  
  // Add "more" option if there's a next page
  // Only show if we're showing exactly 8 items (option 9 is reserved for "more")
  if (hasNextPage && occurrences.length === 8) {
    prompt += `Press 9 to see more shifts. `;
  } else if (hasNextPage && occurrences.length < 9) {
    // Edge case: less than 9 items but there's more pages
    prompt += `Press ${occurrences.length + 1} to see more shifts. `;
  }
  
  return prompt.trim();
}

/**
 * Check if a digit selection is for "next page"
 * @param digit - DTMF digit pressed
 * @param pageItemsCount - Number of items on current page
 * @param hasNextPage - Whether there's a next page
 * @returns True if digit is the "more" option
 */
export function isNextPageSelection(
  digit: string,
  pageItemsCount: number,
  hasNextPage: boolean
): boolean {
  if (!hasNextPage) return false;
  
  const digitNum = parseInt(digit, 10);
  
  // If we have exactly 8 items, digit 9 is "more"
  if (pageItemsCount === 8 && digitNum === 9) {
    return true;
  }
  
  // If we have less than 9 items, next number after items is "more"
  if (pageItemsCount < 9 && digitNum === pageItemsCount + 1) {
    return true;
  }
  
  return false;
}

/**
 * Validate occurrence selection
 * @param digit - DTMF digit pressed
 * @param pageItemsCount - Number of items on current page
 * @param hasNextPage - Whether there's a next page
 * @returns Selected index (0-based) or -1 for "more", null for invalid
 */
export function validateOccurrenceSelection(
  digit: string,
  pageItemsCount: number,
  hasNextPage: boolean
): number | null {
  const digitNum = parseInt(digit, 10);
  
  if (isNaN(digitNum) || digitNum < 1) {
    return null; // Invalid
  }
  
  // Check if it's "next page"
  if (isNextPageSelection(digit, pageItemsCount, hasNextPage)) {
    return -1; // Special value for "more"
  }
  
  // Check if it's a valid item selection
  if (digitNum <= pageItemsCount) {
    return digitNum - 1; // Convert to 0-based index
  }
  
  return null; // Invalid selection
}

