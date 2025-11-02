import { database } from '../db/sqlite';
import { OvertimeLog } from '../../types';

/**
 * Widget data provider for native widgets to access shift status
 * This service provides a simplified API for native code to query shift data
 */

export interface WidgetShiftStatus {
  hasActiveShift: boolean;
  isActive: boolean;
  activeShiftId?: string;
  activeShiftStartTime?: string;
  activeShiftDate?: string;
}

/**
 * Get current shift status for widget display
 * Returns whether there's an active shift and basic info
 * Note: This is primarily for native widget code. For React Native code, use the stores directly.
 */
export async function getWidgetShiftStatus(): Promise<WidgetShiftStatus> {
  try {
    // Ensure database is initialized
    await database.init();

    // Query for active shift (draft status with isActiveShift = true)
    const logs = await database.getOvertimeLogs();
    const activeShift = logs.find(
      log => log.status === 'draft' && log.isActiveShift === true
    );

    if (!activeShift) {
      return {
        hasActiveShift: false,
        isActive: false,
      };
    }

    return {
      hasActiveShift: true,
      isActive: true,
      activeShiftId: activeShift.id,
      activeShiftStartTime: activeShift.actualStart !== 'N/A' ? activeShift.actualStart : undefined,
      activeShiftDate: activeShift.date,
    };
  } catch (error) {
    console.error('Error getting widget shift status:', error);
    return {
      hasActiveShift: false,
      isActive: false,
    };
  }
}

/**
 * Get active shift details (for confirmation screen)
 */
export async function getActiveShiftDetails(): Promise<OvertimeLog | null> {
  try {
    const logs = await database.getOvertimeLogs();
    const activeShift = logs.find(
      log => log.status === 'draft' && log.isActiveShift === true
    );
    return activeShift || null;
  } catch (error) {
    console.error('Error getting active shift details:', error);
    return null;
  }
}

