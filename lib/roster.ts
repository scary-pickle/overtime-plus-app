import { UsualShift, RosterForDate } from '../types';

/**
 * Get roster information for a specific date based on usual shifts
 */
export function getRosterForDate(date: string, usualShifts: UsualShift[]): RosterForDate | null {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate week index for biweekly shifts (1 or 2)
  const weekIndex = getWeekIndex(targetDate);
  
  // Find matching shifts for this date
  const matchingShifts = usualShifts.filter(shift => {
    // Check if shift is active on this date
    if (!isShiftActiveOnDate(shift, date)) return false;
    
    // Check day of week
    if (shift.dayOfWeek !== dayOfWeek) return false;
    
    // For biweekly shifts, check week index
    if (shift.type === 'biweekly' && shift.weekIndex && shift.weekIndex !== weekIndex) {
      return false;
    }
    
    return true;
  });
  
  if (matchingShifts.length === 0) {
    return null;
  }
  
  // Use the first matching shift (in practice, there should only be one)
  const shift = matchingShifts[0];
  
  return {
    date,
    rosteredStart: shift.rosteredStart,
    rosteredFinish: shift.rosteredFinish,
    mealBreakMinutes: shift.mealBreakMinutes || 0,
    source: shift
  };
}

/**
 * Check if a shift is active on a specific date
 */
export function isShiftActiveOnDate(shift: UsualShift, date: string): boolean {
  const targetDate = new Date(date);
  const activeFrom = new Date(shift.activeFrom);
  const activeTo = shift.activeTo ? new Date(shift.activeTo) : null;
  
  if (targetDate < activeFrom) return false;
  if (activeTo && targetDate > activeTo) return false;
  
  return true;
}

/**
 * Get week index (1 or 2) for biweekly shifts
 * Week 1 starts from the first Sunday of the year
 */
export function getWeekIndex(date: Date): 1 | 2 {
  const year = date.getFullYear();
  const firstSunday = new Date(year, 0, 1);
  
  // Find the first Sunday of the year
  while (firstSunday.getDay() !== 0) {
    firstSunday.setDate(firstSunday.getDate() + 1);
  }
  
  const daysSinceFirstSunday = Math.floor((date.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysSinceFirstSunday / 7) + 1;
  
  return (weekNumber % 2 === 1) ? 1 : 2;
}

/**
 * Get all active shifts for a specific day of week
 */
export function getShiftsForDayOfWeek(
  dayOfWeek: number, 
  usualShifts: UsualShift[], 
  weekIndex?: 1 | 2
): UsualShift[] {
  return usualShifts.filter(shift => {
    if (shift.dayOfWeek !== dayOfWeek) return false;
    
    // For biweekly shifts, check week index if provided
    if (shift.type === 'biweekly' && shift.weekIndex && weekIndex) {
      return shift.weekIndex === weekIndex;
    }
    
    return true;
  });
}

/**
 * Get shifts that are active on a specific date
 */
export function getActiveShiftsOnDate(date: string, usualShifts: UsualShift[]): UsualShift[] {
  return usualShifts.filter(shift => isShiftActiveOnDate(shift, date));
}

/**
 * Get the next occurrence of a shift pattern
 */
export function getNextShiftOccurrence(
  shift: UsualShift, 
  fromDate: string
): string | null {
  const from = new Date(fromDate);
  const dayOfWeek = shift.dayOfWeek;
  
  // Start from the next day
  let current = new Date(from);
  current.setDate(current.getDate() + 1);
  
  // Look ahead up to 14 days (2 weeks max for biweekly)
  for (let i = 0; i < 14; i++) {
    if (current.getDay() === dayOfWeek) {
      // For biweekly shifts, check week index
      if (shift.type === 'biweekly' && shift.weekIndex) {
        const weekIndex = getWeekIndex(current);
        if (weekIndex === shift.weekIndex && isShiftActiveOnDate(shift, current.toISOString().split('T')[0])) {
          return current.toISOString().split('T')[0];
        }
      } else if (shift.type === 'weekly' && isShiftActiveOnDate(shift, current.toISOString().split('T')[0])) {
        return current.toISOString().split('T')[0];
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return null;
}

/**
 * Get all shift occurrences in a date range
 */
export function getShiftOccurrencesInRange(
  shift: UsualShift,
  startDate: string,
  endDate: string
): string[] {
  const occurrences: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  
  while (current <= end) {
    if (current.getDay() === shift.dayOfWeek) {
      const dateStr = current.toISOString().split('T')[0];
      
      if (isShiftActiveOnDate(shift, dateStr)) {
        // For biweekly shifts, check week index
        if (shift.type === 'biweekly' && shift.weekIndex) {
          const weekIndex = getWeekIndex(current);
          if (weekIndex === shift.weekIndex) {
            occurrences.push(dateStr);
          }
        } else if (shift.type === 'weekly') {
          occurrences.push(dateStr);
        }
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return occurrences;
}

/**
 * Validate shift configuration
 */
export function validateShift(shift: UsualShift): string[] {
  const errors: string[] = [];
  
  // Check required fields
  if (!shift.label.trim()) {
    errors.push('Label is required');
  }
  
  if (!shift.rosteredStart || !shift.rosteredFinish) {
    errors.push('Start and finish times are required');
  }
  
  // Check time format and logic
  if (shift.rosteredStart && shift.rosteredFinish) {
    const startMinutes = timeToMinutes(shift.rosteredStart);
    const finishMinutes = timeToMinutes(shift.rosteredFinish);
    
    if (finishMinutes <= startMinutes) {
      errors.push('Finish time must be after start time');
    }
  }
  
  // Check date ranges
  if (shift.activeTo && shift.activeFrom > shift.activeTo) {
    errors.push('Active from date must be before active to date');
  }
  
  // Check biweekly configuration
  if (shift.type === 'biweekly' && !shift.weekIndex) {
    errors.push('Week index is required for biweekly shifts');
  }
  
  return errors;
}

// Helper function to convert time to minutes (reused from time.ts)
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
