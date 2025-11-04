import { database } from '../db/sqlite';
import { OvertimeLog } from '../../types';
import * as SecureStore from 'expo-secure-store';

/**
 * Widget data provider for native widgets to access shift status
 * This service provides a simplified API for native code to query shift data
 */

const CURRENT_USER_ID_KEY = 'overtime_plus_current_user_id';

/**
 * Get the current user ID from SecureStore
 * This is stored by the auth store when a user signs in
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const userId = await SecureStore.getItemAsync(CURRENT_USER_ID_KEY);
    return userId;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

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

    // Get current user ID from SecureStore (stored by auth store)
    const userId = await getCurrentUserId();

    // Query for active shift (draft status with isActiveShift = true)
    // Pass userId to ensure we only get logs for the current user
    const logs = await database.getOvertimeLogs(userId);
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
    // Get current user ID from SecureStore (stored by auth store)
    const userId = await getCurrentUserId();
    
    // Pass userId to ensure we only get logs for the current user
    const logs = await database.getOvertimeLogs(userId);
    const activeShift = logs.find(
      log => log.status === 'draft' && log.isActiveShift === true
    );
    return activeShift || null;
  } catch (error) {
    console.error('Error getting active shift details:', error);
    return null;
  }
}

