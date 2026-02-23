import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { database } from '../lib/db/sqlite';
import { useLocalUserStore } from '../lib/state/localUserStore';
import { useOnboardingStore } from '../lib/state/onboardingStore';
import { useProfileStore } from '../lib/state/profileStore';
import { useShiftsStore } from '../lib/state/shiftsStore';
import { useLogsStore } from '../lib/state/logsStore';
import { useDeletedItemsStore } from '../lib/state/deletedItemsStore';
import { notificationManager } from '../lib/notifications';
import { cleanupOldPDFs } from '../lib/utils/cacheCleanup';
import { createScopedLogger } from '../lib/utils/logger';

const debug = createScopedLogger('LoadingScreen');

export default function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    // Swap native splash for this JS screen immediately on first render.
    SplashScreen.hideAsync().catch(() => {});
    initAndNavigate();
  }, []);

  async function initAndNavigate() {
    let destination: '/onboarding/welcome' | '/(tabs)/home' = '/onboarding/welcome';

    try {
      // 1. Stable local user ID — must be first.
      await useLocalUserStore.getState().init();
      const { localUserId } = useLocalUserStore.getState();

      // 2. SQLite database.
      let dbReady = false;
      try {
        await database.init();
        dbReady = true;
        debug.debug('Database initialized');
      } catch (error) {
        debug.error('Database init failed (non-fatal):', error);
      }

      // 3. Onboarding status from SecureStore — determines destination.
      await useOnboardingStore.getState().checkOnboardingStatus(localUserId);
      const { hasCompletedOnboarding } = useOnboardingStore.getState();

      if (hasCompletedOnboarding) {
        destination = '/(tabs)/home';
        // Pre-load all user data so home renders immediately with real content.
        if (dbReady) {
          await loadUserData(localUserId);
        }
      }

      // Notification permissions (OS shows dialog at most once; 5s failsafe).
      await Promise.race([
        notificationManager.init().then(() => notificationManager.requestPermissions()),
        new Promise<void>(resolve => setTimeout(resolve, 5000)),
      ]);
    } catch (error) {
      debug.error('Init failed:', error);
    }

    router.replace(destination);
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/icon.png')}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={styles.title}>Overtime+</Text>
      <ActivityIndicator size="small" color="#007AFF" style={styles.spinner} />
    </View>
  );
}

async function loadUserData(localUserId: string) {
  try {
    await notificationManager.cancelAllNotifications();

    await Promise.all([
      useProfileStore.getState().loadProfile(localUserId),
      useShiftsStore.getState().loadShifts(localUserId),
      useLogsStore.getState().loadLogs(localUserId),
      useLogsStore.getState().loadExportBatches(localUserId),
    ]);

    const { shifts } = useShiftsStore.getState();
    if (shifts.length > 0) {
      notificationManager.scheduleRolling7Days(shifts).catch(() => {});
    }

    const { exportBatches, logs, getDraftLogs, getReadyLogs } = useLogsStore.getState();
    if (exportBatches.length > 0) {
      notificationManager.checkAndScheduleUnsubmittedAVACNotification(exportBatches).catch(() => {});
    }

    if (logs.length > 0) {
      const totalHours = logs.reduce((sum, log) => sum + log.minutesOvertime, 0) / 60;
      const draftLogs = getDraftLogs();
      const pendingCount = draftLogs.length + getReadyLogs().length;
      notificationManager.scheduleWeeklySummary(totalHours, pendingCount).catch(() => {});
      notificationManager.checkAndScheduleIncompleteDraftReminder(
        draftLogs.map(log => ({
          id: log.id,
          date: log.date,
          createdAt: log.createdAt,
          isActiveShift: log.isActiveShift,
        }))
      ).catch(() => {});
    }

    const result = await useDeletedItemsStore.getState().cleanupOldItems(localUserId);
    const cleaned = result.logsDeleted + result.shiftsDeleted + result.batchesDeleted;
    if (cleaned > 0) debug.debug(`Auto-cleaned ${cleaned} old deleted item(s)`);

    await cleanupOldPDFs().catch(() => {});

    debug.debug('User data loaded');
  } catch (error) {
    debug.error('Failed to load user data:', error);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 26,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  spinner: {},
});
