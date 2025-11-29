import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UsualShift } from '../types';
import { getRosterForDate } from './roster';
import { formatDateToISO } from './time';
import { createScopedLogger } from './utils/logger';

const debug = createScopedLogger('notifications');

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  reminderMinutes: number; // minutes before rostered finish
  snoozeMinutes: number;   // default snooze duration
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderMinutes: 0, // at rostered finish time
  snoozeMinutes: 10
};

class NotificationManager {
  private settings: NotificationSettings = DEFAULT_SETTINGS;

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        debug.warn('Notification permissions not granted');
        return false;
      }
      
      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('overtime-reminders', {
          name: 'Overtime Reminders',
          description: 'Notifications for shift end times',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      
      return true;
    } catch (error) {
      debug.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Schedule rolling 7-day notifications for rostered finish times
   */
  async scheduleRolling7Days(usualShifts: UsualShift[]): Promise<void> {
    try {
      // Cancel existing notifications first
      await this.cancelAllNotifications();
      
      if (!this.settings.enabled) return;
      
      const today = new Date();
      const notifications: Notifications.NotificationRequestInput[] = [];
      
      // Schedule for next 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = formatDateToISO(date);
        
        const roster = getRosterForDate(dateStr, usualShifts);
        if (roster && roster.rosteredFinish) {
          const notificationTime = this.calculateNotificationTime(
            roster.rosteredFinish,
            this.settings.reminderMinutes
          );
          
          const notificationId = `overtime_${dateStr}`;
          
          notifications.push({
            identifier: notificationId,
            content: {
              title: 'Shift Ending Soon',
              body: `Your rostered shift ends at ${roster.rosteredFinish}. Tap to end shift now.`,
              data: {
                date: dateStr,
                rosteredFinish: roster.rosteredFinish,
                type: 'shift_end_reminder'
              },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              date: notificationTime,
              channelId: 'overtime-reminders'
            }
          });
        }
      }
      
      // Schedule all notifications
      for (const notification of notifications) {
        await Notifications.scheduleNotificationAsync(notification);
      }
      
      debug.debug(`Scheduled ${notifications.length} overtime notifications`);
    } catch (error) {
      debug.error('Failed to schedule notifications:', error);
    }
  }

  /**
   * Schedule a snooze notification
   */
  async scheduleSnooze(
    originalDate: string,
    snoozeMinutes: number = this.settings.snoozeMinutes
  ): Promise<void> {
    try {
      const snoozeTime = new Date();
      snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
      
      const notificationId = `overtime_snooze_${Date.now()}`;
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: 'Shift Ending Soon (Snoozed)',
          body: `Your shift reminder (snoozed for ${snoozeMinutes} min). Tap to end shift now.`,
          data: {
            date: originalDate,
            type: 'shift_end_snooze'
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          date: snoozeTime,
          channelId: 'overtime-reminders'
        }
      });
      
      debug.debug(`Scheduled snooze notification for ${snoozeMinutes} minutes`);
    } catch (error) {
      debug.error('Failed to schedule snooze notification:', error);
    }
  }

  /**
   * Cancel all overtime notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const overtimeNotifications = scheduledNotifications.filter(
        notification => 
          notification.identifier.startsWith('overtime_') ||
          ((notification.content.data?.type as string | undefined)?.includes('shift_end') || false)
      );
      
      for (const notification of overtimeNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      debug.debug(`Cancelled ${overtimeNotifications.length} overtime notifications`);
    } catch (error) {
      debug.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * Cancel notifications for a specific date
   */
  async cancelNotificationsForDate(date: string): Promise<void> {
    try {
      const notificationId = `overtime_${date}`;
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      debug.debug(`Cancelled notification for ${date}`);
    } catch (error) {
      debug.error('Failed to cancel notification for date:', error);
    }
  }

  /**
   * Schedule an 8-hour reminder for an active shift
   * @param shiftId - The ID of the active shift
   * @param shiftDate - The date the shift started (YYYY-MM-DD)
   * @param startTime - The time the shift started (HH:mm)
   */
  async scheduleActiveShiftReminder(shiftId: string, shiftDate: string, startTime: string): Promise<void> {
    try {
      if (!this.settings.enabled) return;

      // Cancel any existing active shift reminders first to prevent old notifications from firing
      await this.cancelAllActiveShiftReminders();

      // Parse start time to calculate 8 hours later
      const [hours, minutes] = startTime.split(':').map(Number);
      const [year, month, day] = shiftDate.split('-').map(Number);
      
      // Create date for when shift started
      const shiftStartDate = new Date(year, month - 1, day, hours, minutes, 0);
      
      // Add 8 hours
      const reminderDate = new Date(shiftStartDate);
      reminderDate.setHours(reminderDate.getHours() + 8);
      
      // Only schedule if reminder time is in the future
      if (reminderDate <= new Date()) {
        debug.debug('8-hour reminder time has already passed, not scheduling');
        return;
      }

      const notificationId = `active_shift_reminder_${shiftId}`;
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: 'Shift Reminder',
          body: "You've been tracking a shift for 8 hours. Don't forget to end it!",
          data: {
            shiftId,
            shiftDate,
            type: 'active_shift_8hr_reminder'
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          date: reminderDate,
          channelId: 'overtime-reminders'
        }
      });

      debug.debug(`Scheduled 8-hour reminder for shift ${shiftId} at ${reminderDate.toISOString()}`);
    } catch (error) {
      debug.error('Failed to schedule active shift reminder:', error);
    }
  }

  /**
   * Cancel the 8-hour reminder for an active shift
   * @param shiftId - The ID of the active shift
   */
  async cancelActiveShiftReminder(shiftId: string): Promise<void> {
    try {
      const notificationId = `active_shift_reminder_${shiftId}`;
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      debug.debug(`Cancelled 8-hour reminder for shift ${shiftId}`);
    } catch (error) {
      debug.error('Failed to cancel active shift reminder:', error);
    }
  }

  /**
   * Cancel all active shift reminder notifications
   * This is useful when starting a new shift to ensure no old reminders fire
   */
  async cancelAllActiveShiftReminders(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const activeShiftReminders = scheduledNotifications.filter(
        notification => notification.identifier.startsWith('active_shift_reminder_')
      );
      
      for (const notification of activeShiftReminders) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        debug.debug(`Cancelled active shift reminder: ${notification.identifier}`);
      }
      
      if (activeShiftReminders.length > 0) {
        debug.debug(`Cancelled ${activeShiftReminders.length} active shift reminder(s)`);
      }
    } catch (error) {
      debug.error('Failed to cancel all active shift reminders:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      debug.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Update notification settings
   */
  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Calculate notification time based on rostered finish and reminder minutes
   */
  private calculateNotificationTime(rosteredFinish: string, reminderMinutes: number): Date {
    const [hours, minutes] = rosteredFinish.split(':').map(Number);
    const notificationTime = new Date();
    notificationTime.setHours(hours, minutes - reminderMinutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (notificationTime <= new Date()) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }
    
    return notificationTime;
  }

  /**
   * Handle notification response (tap, action, etc.)
   */
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { data } = response.notification.request.content;
    
    if (data?.type === 'shift_end_reminder' || data?.type === 'shift_end_snooze') {
      // This will be handled by the app's notification listener
      debug.debug('Notification tapped:', data);
    }
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();

// Export notification response handler for app setup
export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  notificationManager.handleNotificationResponse(response);
};
