import { MinutesCalculation } from '../types';

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
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
export function calculateDuration(startTime: string, finishTime: string): number {
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
  actualStart: string,
  actualFinish: string,
  rosteredStart?: string,
  rosteredFinish?: string,
  mealBreakMinutes: number = 0
): MinutesCalculation {
  const actualDuration = calculateDuration(actualStart, actualFinish) - mealBreakMinutes;
  
  let rosteredDuration = 0;
  if (rosteredStart && rosteredFinish) {
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
  return new Date().toISOString().split('T')[0];
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
export function isFinishAfterStart(startTime: string, finishTime: string): boolean {
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
export function getTimeDifference(startTime: string, finishTime: string): number {
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
