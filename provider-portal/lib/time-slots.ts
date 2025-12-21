/**
 * Time Slots Utility
 * Generates time slots in 30-minute intervals
 */

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hourStr = String(hour).padStart(2, '0');
      const minuteStr = String(minute).padStart(2, '0');
      slots.push(`${hourStr}:${minuteStr}`);
    }
  }
  
  return slots;
}

/**
 * Format time slot for display (24-hour format)
 */
export function formatTimeSlot(time: string): string {
  // Return as-is in 24-hour format
  return time;
}

