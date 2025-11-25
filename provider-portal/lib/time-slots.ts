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
 * Format time slot for display (24h -> 12h with AM/PM)
 */
export function formatTimeSlot(time: string): string {
  const [hourStr, minute] = time.split(':');
  const hour = parseInt(hourStr, 10);
  
  if (hour === 0) {
    return `12:${minute} AM`;
  } else if (hour < 12) {
    return `${hour}:${minute} AM`;
  } else if (hour === 12) {
    return `12:${minute} PM`;
  } else {
    return `${hour - 12}:${minute} PM`;
  }
}

