import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
  startReminderMinutes: number; // minutes before rostered start (default: 15)
  snoozeMinutes: number;   // default snooze duration
  // Per-type notification toggles
  shiftStartReminders: boolean;
  shiftEndReminders: boolean;
  activeShift8HourReminder: boolean;
  unexportedLogsReminder: boolean;
  unsubmittedAVACReminder: boolean;
  incompleteDraftReminders: boolean;
  weeklySummary: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderMinutes: 0, // at rostered finish time
  startReminderMinutes: 15, // 15 minutes before rostered start
  snoozeMinutes: 10,
  shiftStartReminders: true,
  shiftEndReminders: true,
  activeShift8HourReminder: true,
  unexportedLogsReminder: true,
  unsubmittedAVACReminder: true,
  incompleteDraftReminders: true,
  weeklySummary: true
};

class NotificationManager {
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  
  /**
   * Load settings from SecureStore
   */
  async loadSettings(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync('notification_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
        debug.debug('Loaded notification settings from storage');
      }
    } catch (error) {
      debug.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Save settings to SecureStore
   */
  async saveSettings(): Promise<void> {
    try {
      await SecureStore.setItemAsync('notification_settings', JSON.stringify(this.settings));
      debug.debug('Saved notification settings to storage');
    } catch (error) {
      debug.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Initialize notification manager (load settings)
   */
  async init(): Promise<void> {
    await this.loadSettings();
  }

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
        if (roster) {
          // Schedule end reminder if rostered finish exists and enabled
          if (roster.rosteredFinish && this.settings.shiftEndReminders) {
            const notificationTime = this.calculateNotificationTime(
              roster.rosteredFinish,
              this.settings.reminderMinutes,
              date
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
              trigger: this.buildDateTrigger(notificationTime)
            });
          }
          
          // Schedule start reminder if rostered start exists and enabled
          if (roster.rosteredStart && this.settings.shiftStartReminders) {
            await this.scheduleShiftStartReminder(dateStr, roster.rosteredStart);
          }
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
        trigger: this.buildDateTrigger(snoozeTime)
      });
      
      debug.debug(`Scheduled snooze notification for ${snoozeMinutes} minutes`);
    } catch (error) {
      debug.error('Failed to schedule snooze notification:', error);
    }
  }

  /**
   * Cancel all overtime notifications (end reminders and start reminders)
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const overtimeNotifications = scheduledNotifications.filter(
        notification => {
          const id = notification.identifier;
          const type = notification.content.data?.type as string | undefined;
          return (
            id.startsWith('overtime_') ||
            id.startsWith('shift_start_reminder_') ||
            id.startsWith('active_shift_reminder_') ||
            id === 'weekly_summary' ||
            id === 'unexported_logs_reminder' ||
            id === 'unsubmitted_avac_reminder' ||
            id.startsWith('incomplete_draft_reminder_') ||
            type === 'shift_end_reminder' ||
            type === 'shift_start_reminder' ||
            type === 'active_shift_8hr_reminder' ||
            type === 'weekly_summary' ||
            type === 'unexported_logs_reminder' ||
            type === 'unsubmitted_avac_reminder' ||
            type === 'incomplete_draft_reminder'
          );
        }
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
      // Also cancel start reminder for this date
      const startReminderId = `shift_start_reminder_${date}`;
      await Notifications.cancelScheduledNotificationAsync(startReminderId);
      debug.debug(`Cancelled notifications for ${date}`);
    } catch (error) {
      debug.error('Failed to cancel notification for date:', error);
    }
  }

  /**
   * Schedule a shift start reminder for a specific date
   * @param date - The date of the shift (YYYY-MM-DD)
   * @param rosteredStart - The rostered start time (HH:mm)
   * @param reminderMinutes - Minutes before start time to remind (defaults to settings)
   */
  async scheduleShiftStartReminder(
    date: string,
    rosteredStart: string,
    reminderMinutes?: number
  ): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.shiftStartReminders) return;

      const reminderMins = reminderMinutes ?? this.settings.startReminderMinutes;
      
      // Parse start time to calculate reminder time
      const [hours, minutes] = rosteredStart.split(':').map(Number);
      const [year, month, day] = date.split('-').map(Number);
      
      // Create date for when shift starts
      const shiftStartDate = new Date(year, month - 1, day, hours, minutes, 0);
      
      // Subtract reminder minutes
      const reminderDate = new Date(shiftStartDate);
      reminderDate.setMinutes(reminderDate.getMinutes() - reminderMins);
      
      // Only schedule if reminder time is in the future
      if (reminderDate <= new Date()) {
        debug.debug(`Shift start reminder time has already passed for ${date}, not scheduling`);
        return;
      }

      const notificationId = `shift_start_reminder_${date}`;
      
      // Check if notification already exists for this date
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingNotification = scheduledNotifications.find(
        n => n.identifier === notificationId
      );
      
      if (existingNotification) {
        debug.debug(`Shift start reminder already scheduled for ${date}, skipping`);
        return;
      }
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: 'Shift Starting Soon',
          body: `Your shift starts at ${rosteredStart}. Don't forget to end your shift when you finish!`,
          data: {
            date,
            rosteredStart,
            type: 'shift_start_reminder'
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: this.buildDateTrigger(reminderDate)
      });

      debug.debug(`Scheduled shift start reminder for ${date} at ${reminderDate.toISOString()}`);
    } catch (error) {
      debug.error('Failed to schedule shift start reminder:', error);
    }
  }

  /**
   * Cancel shift start reminder for a specific date
   * Also cancels any shift start reminders scheduled to fire soon (within 5 minutes)
   * to prevent notifications from firing immediately after a shift is started
   * @param date - The date of the shift (YYYY-MM-DD)
   */
  async cancelShiftStartReminder(date: string): Promise<void> {
    try {
      const notificationId = `shift_start_reminder_${date}`;
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      debug.debug(`Cancelled shift start reminder for ${date}`);
      
      // Also cancel any shift start reminders that are scheduled to fire soon
      // This prevents notifications from firing immediately after a shift is started
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      const soonToFireReminders = scheduledNotifications.filter(notification => {
        const isShiftStartReminder = notification.identifier.startsWith('shift_start_reminder_');
        if (!isShiftStartReminder) return false;
        
        // Cancel if it's scheduled to fire soon (within 5 minutes)
        if (notification.trigger && 'date' in notification.trigger) {
          const triggerDate = new Date(notification.trigger.date);
          if (triggerDate <= fiveMinutesFromNow) {
            debug.debug(`Found shift start reminder scheduled to fire soon: ${notification.identifier} at ${triggerDate.toISOString()}`);
            return true;
          }
        }
        return false;
      });
      
      for (const notification of soonToFireReminders) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        debug.debug(`Cancelled shift start reminder scheduled to fire soon: ${notification.identifier}`);
      }
      
      if (soonToFireReminders.length > 0) {
        debug.debug(`Cancelled ${soonToFireReminders.length} shift start reminder(s) scheduled to fire soon`);
      }
    } catch (error) {
      debug.error('Failed to cancel shift start reminder:', error);
    }
  }

  /**
   * Cancel all shift start reminder notifications
   */
  async cancelAllShiftStartReminders(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const startReminders = scheduledNotifications.filter(
        notification => notification.identifier.startsWith('shift_start_reminder_')
      );
      
      for (const notification of startReminders) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        debug.debug(`Cancelled shift start reminder: ${notification.identifier}`);
      }
      
      if (startReminders.length > 0) {
        debug.debug(`Cancelled ${startReminders.length} shift start reminder(s)`);
      }
    } catch (error) {
      debug.error('Failed to cancel all shift start reminders:', error);
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
      if (!this.settings.enabled || !this.settings.activeShift8HourReminder) return;

      // Get current time FIRST - this is the source of truth
      const now = new Date();
      
      // Cancel any existing active shift reminders first to prevent old notifications from firing
      // Do this multiple times to ensure all are cancelled (in case of race conditions)
      await this.cancelAllActiveShiftReminders();
      // Small delay to ensure cancellation completes
      await new Promise(resolve => setTimeout(resolve, 200));
      // Cancel again to catch any that might have been scheduled in the meantime
      await this.cancelAllActiveShiftReminders();
      // One more check after another delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify no reminders are still scheduled
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingReminders = scheduledNotifications.filter(n => 
        n.identifier.startsWith('active_shift_reminder_')
      );
      
      if (existingReminders.length > 0) {
        debug.warn(`Found ${existingReminders.length} existing active shift reminder(s) after cancellation, force cancelling them`);
        for (const reminder of existingReminders) {
          try {
            await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
            if (reminder.trigger && 'date' in reminder.trigger) {
              const triggerDate = new Date(reminder.trigger.date);
              const minutesUntilFire = (triggerDate.getTime() - now.getTime()) / (1000 * 60);
              debug.debug(`Force cancelled reminder: ${reminder.identifier} (scheduled for ${minutesUntilFire.toFixed(1)} minutes from now)`);
            } else {
              debug.debug(`Force cancelled reminder: ${reminder.identifier}`);
            }
          } catch (cancelError) {
            debug.warn(`Failed to cancel reminder ${reminder.identifier}:`, cancelError);
          }
        }
        // Wait a bit more to ensure cancellation completes
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Calculate 8 hours from NOW (since the shift just started)
      // This is more reliable than parsing date strings which can have timezone issues
      const reminderDate = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now
      
      // Add a buffer (10 minutes) to ensure we're scheduling well in the future
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      
      // Only schedule if reminder time is at least 10 minutes in the future
      // This prevents scheduling notifications that would fire immediately
      if (reminderDate <= tenMinutesFromNow) {
        debug.debug('8-hour reminder time is too soon, not scheduling', {
          reminderDate: reminderDate.toISOString(),
          now: now.toISOString(),
          tenMinutesFromNow: tenMinutesFromNow.toISOString(),
          startTime,
          shiftDate,
          minutesUntilReminder: (reminderDate.getTime() - now.getTime()) / (1000 * 60)
        });
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
        trigger: this.buildDateTrigger(reminderDate)
      });

      // Verify the notification was scheduled correctly
      const verifyNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const scheduledReminder = verifyNotifications.find(n => n.identifier === notificationId);
      
      if (scheduledReminder && scheduledReminder.trigger && 'date' in scheduledReminder.trigger) {
        const scheduledDate = new Date(scheduledReminder.trigger.date);
        const hoursUntilFire = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const minutesUntilFire = (scheduledDate.getTime() - now.getTime()) / (1000 * 60);
        
        if (hoursUntilFire < 7.5) {
          debug.warn(`WARNING: Scheduled reminder is less than 7.5 hours away!`, {
            scheduledDate: scheduledDate.toISOString(),
            now: now.toISOString(),
            hoursUntilFire: hoursUntilFire.toFixed(2),
            minutesUntilFire: minutesUntilFire.toFixed(1)
          });
        } else {
          debug.debug(`Verified notification scheduled correctly: ${hoursUntilFire.toFixed(2)} hours (${minutesUntilFire.toFixed(1)} minutes) from now`);
        }
      } else {
        debug.warn(`WARNING: Could not verify scheduled notification ${notificationId}`);
      }

      debug.debug(`Scheduled 8-hour reminder for shift ${shiftId}`, {
        reminderDate: reminderDate.toISOString(),
        now: now.toISOString(),
        hoursUntilReminder: (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60),
        minutesUntilReminder: (reminderDate.getTime() - now.getTime()) / (1000 * 60)
      });
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
   * Cancels ALL active shift reminders, regardless of when they're scheduled
   */
  async cancelAllActiveShiftReminders(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const now = new Date();
      
      // Filter for ALL active shift reminders (not just ones scheduled to fire soon)
      const activeShiftReminders = scheduledNotifications.filter(notification => {
        const isActiveShiftReminder = notification.identifier.startsWith('active_shift_reminder_');
        if (!isActiveShiftReminder) return false;
        
        // Log details about the notification we're cancelling
        if (notification.trigger && 'date' in notification.trigger) {
          const triggerDate = new Date(notification.trigger.date);
          const isInPast = triggerDate <= now;
          const minutesUntilFire = (triggerDate.getTime() - now.getTime()) / (1000 * 60);
          
          debug.debug(`Found active shift reminder to cancel: ${notification.identifier}`, {
            triggerDate: triggerDate.toISOString(),
            now: now.toISOString(),
            isInPast,
            minutesUntilFire: minutesUntilFire.toFixed(1)
          });
        }
        
        return true; // Cancel ALL active shift reminders
      });
      
      // Cancel all found notifications
      for (const notification of activeShiftReminders) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          debug.debug(`Cancelled active shift reminder: ${notification.identifier}`);
        } catch (cancelError) {
          debug.warn(`Failed to cancel notification ${notification.identifier}:`, cancelError);
        }
      }
      
      if (activeShiftReminders.length > 0) {
        debug.debug(`Cancelled ${activeShiftReminders.length} active shift reminder(s)`);
      } else {
        debug.debug('No active shift reminders found to cancel');
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
    // Auto-save when settings are updated
    this.saveSettings().catch(err => {
      debug.error('Failed to auto-save notification settings:', err);
    });
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Build a date-based trigger that keeps the reminders channel
   */
  private buildDateTrigger(date: Date): Notifications.SchedulableNotificationTriggerInput {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'overtime-reminders'
    };
  }

  /**
   * Calculate notification time based on rostered finish, reminder minutes, and target date.
   * Uses the target date so each day gets its own notification time (prevents duplicate notifications).
   */
  private calculateNotificationTime(
    rosteredFinish: string,
    reminderMinutes: number,
    targetDate: Date
  ): Date {
    const [hours, minutes] = rosteredFinish.split(':').map(Number);
    const notificationTime = new Date(targetDate);
    notificationTime.setHours(hours, minutes - reminderMinutes, 0, 0);
    
    // If the time has already passed on the target date, schedule for the next day
    if (notificationTime <= new Date()) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }
    
    return notificationTime;
  }

  /**
   * Check and schedule unexported logs notification with back-off policy
   * @param unexportedCount - Number of unexported logs (draft + ready)
   */
  async checkAndScheduleUnexportedLogsNotification(unexportedCount: number): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.unexportedLogsReminder) return;
      if (unexportedCount < 10) {
        // Reset notification state if count drops below 10
        await this.clearUnexportedLogsNotificationState();
        return;
      }

      // Get current user ID for user-specific storage
      const { useLocalUserStore } = require('./state/localUserStore');
      const userId = useLocalUserStore.getState().localUserId;
      const STORAGE_KEY = userId
        ? `unexported_logs_notification_state_${userId}`
        : 'unexported_logs_notification_state';
      
      // Also cancel any old global notifications (for migration)
      if (userId) {
        try {
          const oldKey = 'unexported_logs_notification_state';
          await SecureStore.deleteItemAsync(oldKey);
        } catch (error) {
          // Ignore errors
        }
      }
      const now = new Date();
      
      // Get stored state - track first notification time and notification count
      let storedState: {
        firstNotificationTime: string | null;
        lastNotificationTime: string | null;
        lastCount: number;
        notificationCount: number; // How many notifications have been sent
      } | null = null;

      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
          storedState = JSON.parse(stored);
        }
      } catch (error) {
        debug.debug('No existing notification state found, starting fresh');
      }

      let shouldSchedule = false;
      let nextNotificationTime: Date | null = null;
      let notificationCount = 0;

      if (!storedState || !storedState.firstNotificationTime) {
        // First time detecting 10+ logs - schedule immediately
        shouldSchedule = true;
        notificationCount = 1;
        nextNotificationTime = new Date(now.getTime() + 1000); // 1 second from now
        debug.debug(`First time detecting ${unexportedCount} unexported logs, scheduling immediate notification`);
      } else {
        const firstNotificationTime = new Date(storedState.firstNotificationTime);
        const timeSinceFirst = now.getTime() - firstNotificationTime.getTime();
        const daysSinceFirst = Math.floor(timeSinceFirst / (24 * 60 * 60 * 1000));
        const currentNotificationCount = storedState.notificationCount || 1;
        const nextNotificationNumber = currentNotificationCount + 1;
        
        // Back-off schedule from first notification:
        // Notification 1: Immediate (already sent)
        // Notification 2: 24 hours later at 12pm (1 day after first)
        // Notification 3: 48 hours later at 12pm (2 days after first)
        // Notification 4: 5 days later at 12pm (7 days after first)
        // Notification 5+: Every 5 days at 12pm (12, 17, 22, 27... days after first)
        
        let targetDaysSinceFirst: number;
        
        if (nextNotificationNumber === 2) {
          // Second notification: 24 hours (1 day) after first, at 12pm
          targetDaysSinceFirst = 1;
        } else if (nextNotificationNumber === 3) {
          // Third notification: 48 hours (2 days) after first, at 12pm
          targetDaysSinceFirst = 2;
        } else if (nextNotificationNumber === 4) {
          // Fourth notification: 5 days after first, at 12pm (7 days total)
          targetDaysSinceFirst = 7;
        } else {
          // Subsequent: 7 + (nextNotificationNumber - 4) * 5 days
          // Notification 5: 12 days, Notification 6: 17 days, etc.
          targetDaysSinceFirst = 7 + (nextNotificationNumber - 4) * 5;
        }
        
        // Calculate next notification time
        nextNotificationTime = new Date(firstNotificationTime);
        nextNotificationTime.setDate(nextNotificationTime.getDate() + targetDaysSinceFirst);
        nextNotificationTime.setHours(12, 0, 0, 0);
        
        // Check if it's time to send the next notification
        if (nextNotificationTime <= now && now.getHours() >= 12) {
          // Time to send immediately
          nextNotificationTime = new Date(now.getTime() + 1000);
          notificationCount = nextNotificationNumber;
          shouldSchedule = true;
        } else if (nextNotificationTime > now) {
          // Schedule for future
          notificationCount = currentNotificationCount; // Don't increment until sent
          shouldSchedule = true;
        } else {
          // Before 12pm today, but past the target day - schedule for today at 12pm
          if (daysSinceFirst >= targetDaysSinceFirst) {
            nextNotificationTime = new Date(now);
            nextNotificationTime.setHours(12, 0, 0, 0);
            if (nextNotificationTime <= now) {
              // Already past 12pm, send immediately
              nextNotificationTime = new Date(now.getTime() + 1000);
              notificationCount = nextNotificationNumber;
            } else {
              notificationCount = currentNotificationCount;
            }
            shouldSchedule = true;
          } else {
            // Not time yet, schedule for future
            notificationCount = currentNotificationCount;
            shouldSchedule = true;
          }
        }
      }

      // Cancel existing notification first
      await this.cancelUnexportedLogsNotification();

      // Check if notification already exists (prevent duplicates from rapid calls)
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingNotification = scheduledNotifications.find(
        n => n.identifier === 'unexported_logs_reminder' ||
             n.content.data?.type === 'unexported_logs_reminder'
      );
      
      if (existingNotification && existingNotification.trigger && 'date' in existingNotification.trigger) {
        const scheduledDate = new Date(existingNotification.trigger.date);
        if (scheduledDate > now) {
          debug.debug('Unexported logs notification already scheduled, skipping');
          return;
        }
      }

      if (shouldSchedule && nextNotificationTime) {
        // Only schedule if time is in the future
        if (nextNotificationTime > now) {
          const notificationId = 'unexported_logs_reminder';
          
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: 'Unexported Logs',
              body: `You have ${unexportedCount} log${unexportedCount !== 1 ? 's' : ''} ready for export. Don't forget to export them!`,
              data: {
                unexportedCount,
                type: 'unexported_logs_reminder'
              },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: this.buildDateTrigger(nextNotificationTime)
          });

          // Update stored state
          const isFirstNotification = !storedState || !storedState.firstNotificationTime;
          const newState = {
            firstNotificationTime: isFirstNotification ? now.toISOString() : storedState?.firstNotificationTime || now.toISOString(),
            lastNotificationTime: now.toISOString(),
            lastCount: unexportedCount,
            notificationCount: notificationCount
          };
          await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newState));
          
          // Also clear old global key if it exists (migration)
          if (userId) {
            try {
              await SecureStore.deleteItemAsync('unexported_logs_notification_state');
            } catch (error) {
              // Ignore errors
            }
          }

          debug.debug(`Scheduled unexported logs notification for ${nextNotificationTime.toISOString()} (notification #${notificationCount})`);
        } else {
          // Time has passed, send immediately by scheduling for now
          const notificationId = 'unexported_logs_reminder';
          const immediateTime = new Date(now.getTime() + 1000);
          
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: 'Unexported Logs',
              body: `You have ${unexportedCount} log${unexportedCount !== 1 ? 's' : ''} ready for export. Don't forget to export them!`,
              data: {
                unexportedCount,
                type: 'unexported_logs_reminder'
              },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: this.buildDateTrigger(immediateTime)
          });

          const isFirstNotification = !storedState || !storedState.firstNotificationTime;
          const newState = {
            firstNotificationTime: isFirstNotification ? now.toISOString() : storedState?.firstNotificationTime || now.toISOString(),
            lastNotificationTime: now.toISOString(),
            lastCount: unexportedCount,
            notificationCount: notificationCount
          };
          await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newState));
          
          // Also clear old global key if it exists (migration)
          if (userId) {
            try {
              await SecureStore.deleteItemAsync('unexported_logs_notification_state');
            } catch (error) {
              // Ignore errors
            }
          }

          debug.debug(`Scheduled immediate unexported logs notification (notification #${notificationCount})`);
        }
      }
    } catch (error) {
      debug.error('Failed to check and schedule unexported logs notification:', error);
    }
  }

  /**
   * Cancel unexported logs notification
   */
  async cancelUnexportedLogsNotification(): Promise<void> {
    try {
      const notificationId = 'unexported_logs_reminder';
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      debug.debug('Cancelled unexported logs notification');
    } catch (error) {
      debug.error('Failed to cancel unexported logs notification:', error);
    }
  }

  /**
   * Clear unexported logs notification state (when count drops below 10 or user changes)
   */
  async clearUnexportedLogsNotificationState(userId?: string | null): Promise<void> {
    try {
      const STORAGE_KEY = userId 
        ? `unexported_logs_notification_state_${userId}` 
        : 'unexported_logs_notification_state';
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      await this.cancelUnexportedLogsNotification();
      debug.debug('Cleared unexported logs notification state');
    } catch (error) {
      debug.error('Failed to clear unexported logs notification state:', error);
    }
  }

  /**
   * Clear all notification state for a user (used on sign out/account deletion)
   */
  async clearAllNotificationState(userId?: string | null): Promise<void> {
    try {
      // Cancel all scheduled notifications
      await this.cancelAllNotifications();
      
      // Clear notification settings (they're global, but we'll keep them for now)
      // Clear unexported logs notification state
      await this.clearUnexportedLogsNotificationState(userId);
      
      debug.debug('Cleared all notification state');
    } catch (error) {
      debug.error('Failed to clear all notification state:', error);
    }
  }

  /**
   * Check and schedule notification for unsubmitted AVAC exports
   * Notifies when an export batch is 7+ days old and hasn't been submitted
   * @param exportBatches - Array of export batches to check
   */
  async checkAndScheduleUnsubmittedAVACNotification(exportBatches: Array<{ id: string; createdAt: string; submittedAt?: string }>): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.unsubmittedAVACReminder) return;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Find unsubmitted batches that are 7+ days old
      const unsubmittedBatches = exportBatches.filter(batch => {
        if (batch.submittedAt) return false; // Already submitted
        const createdAt = new Date(batch.createdAt);
        return createdAt <= sevenDaysAgo;
      });

      if (unsubmittedBatches.length === 0) {
        // No unsubmitted batches, cancel any existing notification
        await this.cancelUnsubmittedAVACNotification();
        return;
      }

      // Cancel existing notification first
      await this.cancelUnsubmittedAVACNotification();

      // Check if notification already exists (prevent duplicates from rapid calls)
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingNotification = scheduledNotifications.find(
        n => n.identifier === 'unsubmitted_avac_reminder' ||
             n.content.data?.type === 'unsubmitted_avac_reminder'
      );
      
      if (existingNotification && existingNotification.trigger && 'date' in existingNotification.trigger) {
        const scheduledDate = new Date(existingNotification.trigger.date);
        if (scheduledDate > now) {
          debug.debug('Unsubmitted AVAC notification already scheduled, skipping');
          return;
        }
      }

      // Schedule notification for today at 12pm if it hasn't passed, otherwise tomorrow
      const notificationTime = new Date(now);
      notificationTime.setHours(12, 0, 0, 0);
      
      if (notificationTime <= now) {
        // Already past 12pm today, schedule for tomorrow
        notificationTime.setDate(notificationTime.getDate() + 1);
      }

      const notificationId = 'unsubmitted_avac_reminder';
      const batchCount = unsubmittedBatches.length;
      const oldestBatch = unsubmittedBatches.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      const daysOld = Math.floor((now.getTime() - new Date(oldestBatch.createdAt).getTime()) / (24 * 60 * 60 * 1000));

      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: 'Unsubmitted AVAC Forms',
          body: `You have ${batchCount} unsubmitted AVAC form${batchCount !== 1 ? 's' : ''} from ${daysOld} day${daysOld !== 1 ? 's' : ''} ago. Don't forget to submit them!`,
          data: {
            batchCount,
            oldestBatchId: oldestBatch.id,
            daysOld,
            type: 'unsubmitted_avac_reminder'
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: this.buildDateTrigger(notificationTime)
      });

      debug.debug(`Scheduled unsubmitted AVAC notification for ${notificationTime.toISOString()} (${batchCount} batch(es))`);
    } catch (error) {
      debug.error('Failed to check and schedule unsubmitted AVAC notification:', error);
    }
  }

  /**
   * Cancel unsubmitted AVAC notification
   */
  async cancelUnsubmittedAVACNotification(): Promise<void> {
    try {
      const notificationId = 'unsubmitted_avac_reminder';
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      debug.debug('Cancelled unsubmitted AVAC notification');
    } catch (error) {
      debug.error('Failed to cancel unsubmitted AVAC notification:', error);
    }
  }

  /**
   * Check and schedule incomplete draft reminders
   * Notifies daily at 9am for draft logs older than 3 days
   * @param draftLogs - Array of draft logs to check
   */
  async checkAndScheduleIncompleteDraftReminder(
    draftLogs: Array<{ id: string; date: string; createdAt: string; isActiveShift?: boolean }>
  ): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.incompleteDraftReminders) {
        await this.cancelIncompleteDraftReminder();
        return;
      }

      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      // Filter out active shifts and find drafts older than 3 days
      const oldDrafts = draftLogs.filter(draft => {
        if (draft.isActiveShift) return false; // Don't notify for active shifts
        const createdDate = new Date(draft.createdAt);
        return createdDate <= threeDaysAgo;
      });

      if (oldDrafts.length === 0) {
        // No old drafts, cancel any existing notification
        await this.cancelIncompleteDraftReminder();
        return;
      }

      // Cancel all existing incomplete draft reminders first
      await this.cancelIncompleteDraftReminder();
      
      // Check if notifications already exist (prevent duplicates from rapid calls)
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingReminders = scheduledNotifications.filter(
        notification => notification.identifier.startsWith('incomplete_draft_reminder_')
      );
      
      if (existingReminders.length > 0) {
        // Check if any are scheduled for future dates
        const futureReminders = existingReminders.filter(n => {
          if (n.trigger && 'date' in n.trigger) {
            return new Date(n.trigger.date) > now;
          }
          return false;
        });
        
        if (futureReminders.length > 0) {
          debug.debug('Incomplete draft reminders already scheduled, skipping');
          return;
        }
      }

      const oldestDraft = oldDrafts.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      const daysOld = Math.floor((now.getTime() - new Date(oldestDraft.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      
      // Format dates for display (show up to 3 dates)
      const dateStrings = oldDrafts.slice(0, 3).map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      });
      const datesText = dateStrings.length === 1 
        ? dateStrings[0]
        : dateStrings.length === 2
        ? `${dateStrings[0]} and ${dateStrings[1]}`
        : `${dateStrings[0]}, ${dateStrings[1]}${oldDrafts.length > 3 ? ` and ${oldDrafts.length - 2} more` : ` and ${dateStrings[2]}`}`;

      // Schedule for next 7 days at 9am (daily until drafts are completed)
      for (let day = 0; day < 7; day++) {
        const notificationTime = new Date(now);
        notificationTime.setDate(notificationTime.getDate() + day);
        notificationTime.setHours(9, 0, 0, 0);
        
        // Only schedule if time is in the future
        if (notificationTime > now) {
          const notificationId = `incomplete_draft_reminder_${day}`;
          
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: 'Incomplete Draft Logs',
              body: `You have ${oldDrafts.length} incomplete draft log${oldDrafts.length !== 1 ? 's' : ''} from ${datesText}. Complete them to export!`,
              data: {
                draftCount: oldDrafts.length,
                oldestDraftId: oldestDraft.id,
                daysOld,
                type: 'incomplete_draft_reminder'
              },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: this.buildDateTrigger(notificationTime)
          });

          debug.debug(`Scheduled incomplete draft reminder #${day + 1} for ${notificationTime.toISOString()}`);
        }
      }
    } catch (error) {
      debug.error('Failed to check and schedule incomplete draft reminder:', error);
    }
  }

  /**
   * Cancel all incomplete draft reminders
   */
  async cancelIncompleteDraftReminder(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const incompleteDraftReminders = scheduledNotifications.filter(
        notification => notification.identifier.startsWith('incomplete_draft_reminder_')
      );
      
      for (const notification of incompleteDraftReminders) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      if (incompleteDraftReminders.length > 0) {
        debug.debug(`Cancelled ${incompleteDraftReminders.length} incomplete draft reminder(s)`);
      }
    } catch (error) {
      debug.error('Failed to cancel incomplete draft reminder:', error);
    }
  }

  /**
   * Schedule weekly summary notification
   * Schedules for next Sunday at 8am (single notification, reschedules after firing)
   * @param totalHours - Total hours logged (all time)
   * @param pendingCount - Number of logs pending export (draft + ready)
   */
  async scheduleWeeklySummary(totalHours: number, pendingCount: number): Promise<void> {
    try {
      if (!this.settings.enabled || !this.settings.weeklySummary) {
        await this.cancelWeeklySummary();
        return;
      }

      const now = new Date();
      
      // Get current user ID for user-specific storage
      const { useLocalUserStore } = require('./state/localUserStore');
      const userId = useLocalUserStore.getState().localUserId;
      const STORAGE_KEY = userId
        ? `weekly_summary_last_sent_${userId}`
        : 'weekly_summary_last_sent';
      
      // Check when the last weekly summary was sent
      let lastSentTime: Date | null = null;
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
          lastSentTime = new Date(stored);
        }
      } catch (error) {
        // No stored time, that's fine
      }

      // Check if a weekly summary is already scheduled
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingWeeklySummary = scheduledNotifications.find(
        notification => 
          notification.identifier === 'weekly_summary' ||
          notification.content.data?.type === 'weekly_summary'
      );

      // If one exists and it's scheduled for a future date, don't reschedule
      if (existingWeeklySummary && existingWeeklySummary.trigger && 'date' in existingWeeklySummary.trigger) {
        const scheduledDate = new Date(existingWeeklySummary.trigger.date);
        if (scheduledDate > now) {
          debug.debug('Weekly summary already scheduled, skipping');
          return;
        }
        
        // If the scheduled time has passed (notification should have fired),
        // update the last sent time to prevent immediate rescheduling
        if (scheduledDate <= now) {
          const oneDayInMs = 24 * 60 * 60 * 1000;
          const timeSinceScheduled = now.getTime() - scheduledDate.getTime();
          // Only update if it's been at least a day (to avoid updating for notifications that just fired)
          if (timeSinceScheduled >= oneDayInMs) {
            try {
              await SecureStore.setItemAsync(STORAGE_KEY, scheduledDate.toISOString());
              debug.debug('Updated weekly summary last sent time based on past scheduled notification');
              lastSentTime = scheduledDate;
            } catch (error) {
              debug.error('Failed to update weekly summary last sent time:', error);
            }
          }
        }
      }

      // If we've scheduled a notification recently (within last 6 days), don't reschedule
      // This prevents the notification from being rescheduled every time the app opens
      // even if cancelAllNotifications() was called
      if (lastSentTime) {
        const timeSinceLastScheduled = now.getTime() - lastSentTime.getTime();
        const sixDaysInMs = 6 * 24 * 60 * 60 * 1000;
        
        // If we scheduled one recently (whether it was sent or just scheduled), don't reschedule
        // This prevents the notification from appearing every time the app opens
        if (Math.abs(timeSinceLastScheduled) < sixDaysInMs) {
          if (timeSinceLastScheduled > 0) {
            debug.debug(`Weekly summary was scheduled ${Math.floor(timeSinceLastScheduled / (24 * 60 * 60 * 1000))} days ago, skipping reschedule`);
          } else {
            debug.debug(`Weekly summary is scheduled for ${Math.floor(-timeSinceLastScheduled / (24 * 60 * 60 * 1000))} days from now, skipping reschedule`);
          }
          // Still cancel any old scheduled notifications to clean up
          await this.cancelWeeklySummary();
          return;
        }
      }

      // Cancel ALL existing weekly summary notifications first (including any duplicates)
      await this.cancelWeeklySummary();

      // Find next Sunday at 8am
      const nextSunday = new Date(now);
      const daysUntilSunday = (7 - nextSunday.getDay()) % 7; // 0 = Sunday
      
      if (daysUntilSunday === 0 && now.getHours() < 8) {
        // Today is Sunday and it's before 8am, schedule for today
        nextSunday.setHours(8, 0, 0, 0);
      } else {
        // Schedule for next Sunday
        const daysToAdd = daysUntilSunday === 0 ? 7 : daysUntilSunday;
        nextSunday.setDate(nextSunday.getDate() + daysToAdd);
        nextSunday.setHours(8, 0, 0, 0);
      }

      // Only schedule if time is in the future (with at least 1 hour buffer to avoid immediate firing)
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (nextSunday > oneHourFromNow) {
        // Use a single, consistent notification ID
        const notificationId = 'weekly_summary';
        
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: 'Weekly Summary',
            body: `Weekly summary: ${totalHours.toFixed(1)} hours logged, ${pendingCount} log${pendingCount !== 1 ? 's' : ''} pending export`,
            data: {
              totalHours,
              pendingCount,
              type: 'weekly_summary'
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: this.buildDateTrigger(nextSunday)
        });

        // Store the scheduled time (we'll update it to the actual sent time when it fires)
        // This helps us track when notifications were scheduled even if they get cancelled
        try {
          await SecureStore.setItemAsync(STORAGE_KEY, nextSunday.toISOString());
        } catch (error) {
          debug.error('Failed to store weekly summary scheduled time:', error);
        }

        debug.debug(`Scheduled weekly summary for ${nextSunday.toISOString()}`);
      } else {
        debug.debug(`Next Sunday (${nextSunday.toISOString()}) is too soon, will schedule on next app open`);
      }
    } catch (error) {
      debug.error('Failed to schedule weekly summary:', error);
    }
  }

  /**
   * Cancel all weekly summary notifications (including any duplicates)
   */
  async cancelWeeklySummary(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      // Cancel both old format (weekly_summary_0, etc.) and new format (weekly_summary)
      const weeklySummaries = scheduledNotifications.filter(
        notification => 
          notification.identifier.startsWith('weekly_summary_') ||
          notification.identifier === 'weekly_summary' ||
          (notification.content.data?.type === 'weekly_summary')
      );
      
      for (const notification of weeklySummaries) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      if (weeklySummaries.length > 0) {
        debug.debug(`Cancelled ${weeklySummaries.length} weekly summary notification(s)`);
      }
    } catch (error) {
      debug.error('Failed to cancel weekly summary:', error);
    }
  }

  /**
   * Handle notification response (tap, action, etc.)
   */
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { data } = response.notification.request.content;
    
    if (data?.type === 'shift_end_reminder' || data?.type === 'shift_end_snooze' || 
        data?.type === 'active_shift_8hr_reminder' || data?.type === 'shift_start_reminder' ||
        data?.type === 'unexported_logs_reminder' || data?.type === 'unsubmitted_avac_reminder' ||
        data?.type === 'incomplete_draft_reminder' || data?.type === 'weekly_summary') {
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
