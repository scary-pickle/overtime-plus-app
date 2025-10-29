import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UsualShift } from '../types';
import { getRosterForDate } from './roster';

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
        console.warn('Notification permissions not granted');
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
      console.error('Failed to request notification permissions:', error);
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
        const dateStr = date.toISOString().split('T')[0];
        
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
      
      console.log(`Scheduled ${notifications.length} overtime notifications`);
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
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
      
      console.log(`Scheduled snooze notification for ${snoozeMinutes} minutes`);
    } catch (error) {
      console.error('Failed to schedule snooze notification:', error);
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
      
      console.log(`Cancelled ${overtimeNotifications.length} overtime notifications`);
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * Cancel notifications for a specific date
   */
  async cancelNotificationsForDate(date: string): Promise<void> {
    try {
      const notificationId = `overtime_${date}`;
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`Cancelled notification for ${date}`);
    } catch (error) {
      console.error('Failed to cancel notification for date:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
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
      console.log('Notification tapped:', data);
    }
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();

// Export notification response handler for app setup
export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  notificationManager.handleNotificationResponse(response);
};
