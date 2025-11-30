import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationManager } from '../lib/notifications';
import { createScopedLogger } from '../lib/utils/logger';

const debug = createScopedLogger('NotificationsSettings');

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [settings, setSettings] = useState(notificationManager.getSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        await notificationManager.loadSettings();
        setSettings(notificationManager.getSettings());
      } catch (error) {
        debug.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const handleToggle = async (key: keyof typeof settings, value: boolean) => {
    setIsSaving(true);
    try {
      const newSettings = { ...settings, [key]: value };
      notificationManager.updateSettings(newSettings);
      setSettings(newSettings);
      
      // If master toggle is turned off, disable all notifications
      if (key === 'enabled' && !value) {
        const allDisabled = { ...newSettings, enabled: false };
        notificationManager.updateSettings(allDisabled);
        setSettings(allDisabled);
      }
    } catch (error) {
      debug.error('Failed to update setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const notificationTypes = [
    {
      key: 'shiftStartReminders' as const,
      title: 'Shift Start Reminders',
      description: 'Get notified 15 minutes before your rostered shift starts',
      icon: 'time-outline' as const,
    },
    {
      key: 'shiftEndReminders' as const,
      title: 'Shift End Reminders',
      description: 'Get notified when your rostered shift ends',
      icon: 'alarm-outline' as const,
    },
    {
      key: 'activeShift8HourReminder' as const,
      title: '8-Hour Shift Reminder',
      description: 'Get reminded if you\'ve been tracking a shift for 8 hours',
      icon: 'hourglass-outline' as const,
    },
    {
      key: 'unexportedLogsReminder' as const,
      title: 'Unexported Logs Reminder',
      description: 'Get notified when you have 10+ logs ready for export',
      icon: 'document-text-outline' as const,
    },
    {
      key: 'unsubmittedAVACReminder' as const,
      title: 'Unsubmitted AVAC Reminder',
      description: 'Get notified about AVAC forms that haven\'t been submitted after 7 days',
      icon: 'mail-outline' as const,
    },
    {
      key: 'incompleteDraftReminders' as const,
      title: 'Incomplete Draft Reminders',
      description: 'Get notified daily about draft logs older than 3 days',
      icon: 'document-text-outline' as const,
    },
    {
      key: 'weeklySummary' as const,
      title: 'Weekly Summary',
      description: 'Get a weekly summary every Sunday at 8am',
      icon: 'stats-chart-outline' as const,
    },
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#007AFF'} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header with back button */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.title, isDark && styles.darkText]}>
              Notifications
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        {/* Master Toggle */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <View style={styles.masterToggleContainer}>
            <View style={styles.masterToggleLeft}>
              <Ionicons name="notifications-outline" size={24} color={isDark ? '#fff' : '#000'} />
              <View style={styles.masterToggleText}>
                <Text style={[styles.masterToggleTitle, isDark && styles.darkText]}>
                  Enable Notifications
                </Text>
                <Text style={[styles.masterToggleDescription, isDark && styles.darkSubtitle]}>
                  Master switch for all notifications
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => handleToggle('enabled', value)}
              trackColor={{ false: isDark ? '#333' : '#ccc', true: '#007AFF' }}
              thumbColor="#fff"
              disabled={isSaving}
            />
          </View>
        </View>

        {/* Individual Notification Types */}
        {settings.enabled && (
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Notification Types
            </Text>
            <Text style={[styles.sectionDescription, isDark && styles.darkSubtitle]}>
              Choose which notifications you want to receive
            </Text>

            {notificationTypes.map((type) => (
              <View key={type.key} style={[styles.notificationRow, isDark && styles.darkNotificationRow]}>
                <View style={styles.notificationLeft}>
                  <Ionicons 
                    name={type.icon} 
                    size={22} 
                    color={isDark ? '#fff' : '#000'} 
                    style={styles.notificationIcon}
                  />
                  <View style={styles.notificationText}>
                    <Text style={[styles.notificationTitle, isDark && styles.darkText]}>
                      {type.title}
                    </Text>
                    <Text style={[styles.notificationDescription, isDark && styles.darkSubtitle]}>
                      {type.description}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings[type.key]}
                  onValueChange={(value) => handleToggle(type.key, value)}
                  trackColor={{ false: isDark ? '#333' : '#ccc', true: '#007AFF' }}
                  thumbColor="#fff"
                  disabled={isSaving || !settings.enabled}
                />
              </View>
            ))}
          </View>
        )}

        {/* Info Section */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color={isDark ? '#999' : '#666'} />
            <Text style={[styles.infoText, isDark && styles.darkSubtitle]}>
              Notifications are scheduled based on your shift schedule and log activity. 
              Some notifications may require app permissions to be enabled.
            </Text>
          </View>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
  },
  darkText: {
    color: '#fff',
  },
  darkSubtitle: {
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkSection: {
    backgroundColor: '#1c1c1e',
  },
  masterToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  masterToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  masterToggleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  masterToggleDescription: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkNotificationRow: {
    borderBottomColor: '#333',
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginLeft: 8,
  },
});

