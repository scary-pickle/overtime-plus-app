import { MinutesCalculation } from '../types';

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(timeStr: string | 'N/A'): number {
  if (timeStr === 'N/A') {
    return 0; // Return 0 for N/A values
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate duration between two times in minutes
 * Handles midnight crossing by adding 24 hours to finish time if it's earlier than start time
 */
export function calculateDuration(startTime: string | 'N/A', finishTime: string | 'N/A'): number {
  // If either time is N/A, return 0 duration
  if (startTime === 'N/A' || finishTime === 'N/A') {
    return 0;
  }
  
  const startMinutes = timeToMinutes(startTime);
  let finishMinutes = timeToMinutes(finishTime);
  
  // If finish time is earlier than start time, assume it's the next day (crosses midnight)
  if (finishMinutes <= startMinutes) {
    finishMinutes += 24 * 60; // Add 24 hours
  }
  
  return finishMinutes - startMinutes;
}

/**
 * Round minutes to nearest 5
 */
export function roundToNearest5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

/**
 * Format minutes as "Xh Ym" string
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Calculate overtime minutes based on actual vs rostered times
 */
export function computeMinutes(
  actualStart: string | 'N/A',
  actualFinish: string | 'N/A',
  rosteredStart?: string | 'N/A',
  rosteredFinish?: string | 'N/A',
  mealBreakMinutes: number = 0
): MinutesCalculation {
  const actualDuration = calculateDuration(actualStart, actualFinish) - mealBreakMinutes;
  
  let rosteredDuration = 0;
  if (rosteredStart && rosteredFinish && rosteredStart !== 'N/A' && rosteredFinish !== 'N/A') {
    rosteredDuration = calculateDuration(rosteredStart, rosteredFinish) - mealBreakMinutes;
  }
  
  const overtimeMinutes = Math.max(0, actualDuration - rosteredDuration);
  const roundedOvertime = roundToNearest5(overtimeMinutes);
  
  return {
    minutesWorked: actualDuration,
    minutesRostered: rosteredDuration,
    minutesOvertime: overtimeMinutes,
    roundedOvertime
  };
}

/**
 * Get current time in HH:mm format
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a time is valid (HH:mm format)
 */
export function isValidTime(time: string): boolean {
  const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timePattern.test(time);
}

/**
 * Check if finish time is after start time
 * Handles midnight crossing by allowing finish time to be earlier than start time
 */
export function isFinishAfterStart(startTime: string | 'N/A', finishTime: string | 'N/A'): boolean {
  // If either time is N/A, return false
  if (startTime === 'N/A' || finishTime === 'N/A') {
    return false;
  }
  
  const startMinutes = timeToMinutes(startTime);
  let finishMinutes = timeToMinutes(finishTime);
  
  // If finish time is earlier than start time, assume it's the next day (crosses midnight)
  if (finishMinutes <= startMinutes) {
    finishMinutes += 24 * 60; // Add 24 hours
  }
  
  return finishMinutes > startMinutes;
}

/**
 * Get time difference in minutes between two times
 * Handles midnight crossing by adding 24 hours to finish time if it's earlier than start time
 */
export function getTimeDifference(startTime: string | 'N/A', finishTime: string | 'N/A'): number {
  // If either time is N/A, return 0
  if (startTime === 'N/A' || finishTime === 'N/A') {
    return 0;
  }
  
  const startMinutes = timeToMinutes(startTime);
  let finishMinutes = timeToMinutes(finishTime);
  
  // If finish time is earlier than start time, assume it's the next day (crosses midnight)
  if (finishMinutes <= startMinutes) {
    finishMinutes += 24 * 60; // Add 24 hours
  }
  
  return finishMinutes - startMinutes;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
}

/**
 * Get time in a specific timezone (for future use with dayjs)
 */
export function getTimeInTimezone(timezone: string = 'Australia/Brisbane'): string {
  // This will be enhanced with dayjs timezone plugin
  return getCurrentTime();
}

/**
 * Get the previous day's date in ISO format (YYYY-MM-DD)
 */
export function getPreviousISODate(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Determine the correct date for a shift based on start and finish times.
 * The date should always be the date when the shift started.
 * If finish time is earlier than start time (crosses midnight), 
 * the date should be the previous day.
 * 
 * @param endDate - The date when the shift is being logged/ended (YYYY-MM-DD)
 * @param startTime - The start time of the shift (HH:mm or 'N/A')
 * @param finishTime - The finish time of the shift (HH:mm or 'N/A')
 * @returns The date when the shift actually started (YYYY-MM-DD)
 */
export function getShiftStartDate(endDate: string, startTime: string | 'N/A', finishTime: string | 'N/A'): string {
  // If we don't have valid times, use the end date as fallback
  if (startTime === 'N/A' || finishTime === 'N/A') {
    return endDate;
  }
  
  const startMinutes = timeToMinutes(startTime);
  const finishMinutes = timeToMinutes(finishTime);
  
  // If finish time is earlier than or equal to start time, shift crossed midnight
  // The start date should be the previous day
  if (finishMinutes <= startMinutes) {
    return getPreviousISODate(endDate);
  }
  
  // Otherwise, shift started and ended on the same day
  return endDate;
}
