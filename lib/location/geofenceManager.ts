/**
 * Geofence Manager
 *
 * Registers and manages a geofence around the user's hospital.
 * When the user enters or exits the geofence near their shift times,
 * a draft OvertimeLog is automatically created (source: 'geofence-proposed')
 * for them to review and confirm.
 *
 * The background task handler is defined at module scope (required by expo-task-manager).
 * Import this file once during app initialisation to register the task.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { database } from '../db/sqlite';
import { getCoordinatesForHospital } from '../data/hospitalCoordinates';
import { getCurrentDate, getCurrentTime } from '../time';
import { createScopedLogger } from '../utils/logger';
import { OvertimeLog } from '../../types';

const debug = createScopedLogger('geofenceManager');

export const GEOFENCE_TASK = 'OVERTIME_GEOFENCE_TASK';
const LOCAL_USER_ID_KEY = 'overtime_plus_local_user_id';
const GEOFENCE_ACTIVE_LOG_KEY = 'geofence_active_log_id';
// Brief-exit window: if user re-enters within this many minutes, re-activate existing log
const REENTRY_WINDOW_MINUTES = 15;

// --------------------------------------------------------------------------
// Background task — must be defined at module level (TaskManager requirement)
// --------------------------------------------------------------------------
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: { data: any; error: any }) => {
  if (error) {
    debug.error('Geofence task error:', error);
    return;
  }

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  debug.debug('Geofence event received', { eventType, regionId: region.identifier });

  try {
    // Ensure DB is ready (app may be in background)
    await database.init();

    const userId = await SecureStore.getItemAsync(LOCAL_USER_ID_KEY);
    const now = new Date();
    const today = getCurrentDate();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (eventType === Location.GeofencingEventType.Enter) {
      await handleGeofenceEnter({ userId, today, currentTime });
    } else if (eventType === Location.GeofencingEventType.Exit) {
      await handleGeofenceExit({ userId, today, currentTime });
    }
  } catch (err) {
    debug.error('Error handling geofence event:', err);
  }
});

// --------------------------------------------------------------------------
// Event handlers
// --------------------------------------------------------------------------

async function handleGeofenceEnter({
  userId,
  today,
  currentTime,
}: {
  userId: string | null;
  today: string;
  currentTime: string;
}) {
  debug.debug('Handling geofence ENTER', { userId: userId?.substring(0, 8), today, currentTime });

  // Check if there's already an active geofence log in progress
  const storedActiveLogId = await SecureStore.getItemAsync(GEOFENCE_ACTIVE_LOG_KEY);
  if (storedActiveLogId) {
    // Already tracking a shift — ignore double-entry events
    debug.debug('Already tracking a shift, ignoring ENTER event', { storedActiveLogId });
    return;
  }

  // Check if there's a recently-exited geofence-proposed log for today that can be re-activated
  // (handles the "coffee run" case — user briefly left within REENTRY_WINDOW_MINUTES)
  const todayLogs = await database.getOvertimeLogs(userId);
  const recentGeofenceLog = todayLogs.find(log => {
    if (log.date !== today) return false;
    if (log.source !== 'geofence-proposed') return false;
    if (log.status !== 'draft') return false;
    if (log.isActiveShift) return false; // already active — shouldn't happen
    if (!log.actualFinish || log.actualFinish === 'N/A') return false;

    // Check if the exit was recent enough to re-activate
    const [exitHours, exitMinutes] = log.actualFinish.split(':').map(Number);
    const now = new Date();
    const exitTimeToday = new Date(now);
    exitTimeToday.setHours(exitHours, exitMinutes, 0, 0);
    const minutesSinceExit = (now.getTime() - exitTimeToday.getTime()) / (1000 * 60);
    return minutesSinceExit >= 0 && minutesSinceExit <= REENTRY_WINDOW_MINUTES;
  });

  if (recentGeofenceLog) {
    // Re-activate the existing log — user came back quickly
    debug.debug('Re-activating recent geofence log after brief exit', { id: recentGeofenceLog.id });
    const reactivated: OvertimeLog = {
      ...recentGeofenceLog,
      actualFinish: 'N/A',
      isActiveShift: true,
      updatedAt: new Date().toISOString(),
    };
    await database.updateOvertimeLog(reactivated, userId ?? null);
    await SecureStore.setItemAsync(GEOFENCE_ACTIVE_LOG_KEY, reactivated.id);
    await sendGeofenceEntryNotification(reactivated.id);
    return;
  }

  // Create a new draft log
  const newLog: OvertimeLog = {
    id: `geofence_${Date.now()}`,
    date: today,
    actualStart: currentTime,
    actualFinish: 'N/A',
    minutesOvertime: 0,
    category: 'Overtime',
    initials: await getInitials(userId),
    status: 'draft',
    source: 'geofence-proposed',
    isActiveShift: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await database.createOvertimeLog(newLog, userId ?? null);
  await SecureStore.setItemAsync(GEOFENCE_ACTIVE_LOG_KEY, newLog.id);

  debug.debug('Created geofence draft log on ENTER', { id: newLog.id, actualStart: newLog.actualStart });
  await sendGeofenceEntryNotification(newLog.id);
}

async function handleGeofenceExit({
  userId,
  today,
  currentTime,
}: {
  userId: string | null;
  today: string;
  currentTime: string;
}) {
  debug.debug('Handling geofence EXIT', { userId: userId?.substring(0, 8), today, currentTime });

  const storedActiveLogId = await SecureStore.getItemAsync(GEOFENCE_ACTIVE_LOG_KEY);
  if (!storedActiveLogId) {
    debug.debug('No active geofence log found on EXIT, ignoring');
    return;
  }

  // Find the active log in the database
  const allLogs = await database.getOvertimeLogs(userId);
  const activeLog = allLogs.find(l => l.id === storedActiveLogId);
  if (!activeLog) {
    debug.debug('Active geofence log not found in DB, clearing stored ID');
    await SecureStore.deleteItemAsync(GEOFENCE_ACTIVE_LOG_KEY);
    return;
  }

  // Update the log with the exit time
  const updatedLog: OvertimeLog = {
    ...activeLog,
    actualFinish: currentTime,
    isActiveShift: false,
    updatedAt: new Date().toISOString(),
  };

  await database.updateOvertimeLog(updatedLog, userId ?? null);
  await SecureStore.deleteItemAsync(GEOFENCE_ACTIVE_LOG_KEY);

  debug.debug('Updated geofence draft log on EXIT', { id: updatedLog.id, actualFinish: currentTime });
  await sendGeofenceExitNotification(updatedLog.id);
}

// --------------------------------------------------------------------------
// Notification helpers
// --------------------------------------------------------------------------

async function sendGeofenceEntryNotification(logId: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `geofence_entry_${Date.now()}`,
      content: {
        title: 'Arrived at work',
        body: 'Overtime+ is tracking your shift. Tap to view the draft log.',
        data: { type: 'geofence_entry', logId },
        sound: true,
      },
      trigger: null, // fire immediately
    });
  } catch (error) {
    debug.error('Failed to send geofence entry notification:', error);
  }
}

async function sendGeofenceExitNotification(logId: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `geofence_exit_${Date.now()}`,
      content: {
        title: 'Left work',
        body: 'A draft shift log has been created. Tap to review and confirm.',
        data: { type: 'geofence_exit', logId },
        sound: true,
      },
      trigger: null, // fire immediately
    });
  } catch (error) {
    debug.error('Failed to send geofence exit notification:', error);
  }
}

// --------------------------------------------------------------------------
// Profile helper — read initials from SecureStore / profile storage
// --------------------------------------------------------------------------

async function getInitials(userId: string | null): Promise<string> {
  try {
    // Profile is stored in a namespaced SecureStore key — try reading it
    const key = userId ? `profile_${userId}` : 'profile';
    const profileStr = await SecureStore.getItemAsync(key);
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      return profile.employeeInitial || '';
    }
  } catch {
    // ignore
  }
  return '';
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export const geofenceManager = {
  /**
   * Request the minimum location permissions needed for geofencing.
   * On iOS, "always" permission is required for background geofencing.
   * Returns true if sufficient permission was granted.
   */
  async requestPermissions(): Promise<{ granted: boolean; canAskAlways: boolean }> {
    // First request foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      return { granted: false, canAskAlways: false };
    }

    // Then request background ("always") permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return {
      granted: bgStatus === 'granted',
      canAskAlways: true,
    };
  },

  /**
   * Check current permission status without prompting.
   */
  async getPermissionStatus(): Promise<{
    foreground: Location.PermissionStatus;
    background: Location.PermissionStatus;
  }> {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return { foreground: fg.status, background: bg.status };
  },

  /**
   * Start monitoring the hospital geofence.
   * @param hospitalName - must match a key in hospitalCoordinates
   * @param radiusMeters - geofence radius
   */
  async startMonitoring(
    hospitalName: string,
    radiusMeters: number,
    customCoordinates?: { latitude: number; longitude: number },
  ): Promise<boolean> {
    try {
      const coords = customCoordinates ?? getCoordinatesForHospital(hospitalName);
      if (!coords) {
        debug.warn('No coordinates found for hospital:', hospitalName);
        return false;
      }

      // Ensure we have background permission before attempting to start
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        debug.warn('Background location permission not granted, cannot start geofencing');
        return false;
      }

      // Stop any existing monitoring first (clean state)
      await geofenceManager.stopMonitoring();

      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: 'hospital',
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius: radiusMeters,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      debug.debug('Geofencing started', { hospitalName, radiusMeters, coords });
      return true;
    } catch (error) {
      debug.error('Failed to start geofencing:', error);
      return false;
    }
  },

  /**
   * Stop monitoring the hospital geofence.
   */
  async stopMonitoring(): Promise<void> {
    try {
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
        debug.debug('Geofencing stopped');
      }
    } catch (error) {
      debug.error('Failed to stop geofencing:', error);
    }
  },

  /**
   * Returns true if geofencing is currently active.
   */
  async isMonitoring(): Promise<boolean> {
    try {
      return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    } catch {
      return false;
    }
  },
};
