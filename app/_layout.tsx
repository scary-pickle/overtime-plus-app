import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useCallback } from 'react';
import '../lib/utils/consoleSafe';
import '../lib/utils/secureFetch';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { database } from '../lib/db/sqlite';
import { useProfileStore } from '../lib/state/profileStore';
import { useShiftsStore } from '../lib/state/shiftsStore';
import { useLogsStore } from '../lib/state/logsStore';
import { useDeletedItemsStore } from '../lib/state/deletedItemsStore';
import { notificationManager } from '../lib/notifications';
import { subscribeToAuthDeepLinks } from '../lib/auth/deeplinks';
import { useAuthStore } from '../lib/state/authStore';
import { syncQueue } from '../lib/sync/queue';
import { templatesSync, templateOTAEnabled } from '../lib/supabase';
import { purgeLegacyAuthStorage } from '../lib/auth/migrateAuthStorage';
import { cleanupOldPDFs } from '../lib/utils/cacheCleanup';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSubscriptionStore } from '../lib/state/subscriptionStore';
import { createScopedLogger } from '../lib/utils/logger';
import { AnimatedSplashText } from '../components/AnimatedSplashText';

const debug = createScopedLogger('App');

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, checkSession, emailVerified, isLoading } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const { loadShifts } = useShiftsStore();
  const { loadLogs, loadExportBatches } = useLogsStore();
  const router = useRouter();
  const pathname = usePathname();
  const shouldShowPaywall = useSubscriptionStore((state) => state.access.shouldShowPaywall);
  const subscriptionInitialized = useSubscriptionStore((state) => state.initialized);
  const initializeSubscription = useSubscriptionStore((state) => state.init);
  const resetSubscription = useSubscriptionStore((state) => state.reset);
  const [appIsReady, setAppIsReady] = React.useState(false);
  const [showSplashText, setShowSplashText] = React.useState(true);

  useEffect(() => {
    (async () => {
      // Initialize database FIRST before checking session
      // Local tables back offline data; purge any legacy auth tokens from SQLite
      try {
        await database.init();
        debug.debug('Database initialized');
        await purgeLegacyAuthStorage();
      } catch (error) {
        debug.error('Failed to initialize database:', error);
        // Still hide splash even on error
        setAppIsReady(true);
        return;
      }
      
      // Now check session (SecureStore-backed adapter restores Supabase session)
      // CRITICAL: Log database state RIGHT BEFORE checkSession
      try {
        const sessionCount = await database.countAuthSessions();
        if (process.env.NODE_ENV !== 'production') {
          const allKeys = await database.getAllAuthSessionKeys();
          debug.debug('[authStore.checkSession] 🔍 Database state BEFORE checkSession:', {
            sessionCount,
            keys: allKeys
          });
        }
      } catch (dbError) {
        debug.error('[authStore.checkSession] Failed to check database state:', dbError);
      }
      
      await checkSession();
      
      // Continue with rest of app initialization
      await initializeApp();
      
      // Mark app as ready
      setAppIsReady(true);
    })();
    const unsubscribeLinking = subscribeToAuthDeepLinks();
    return () => {
      unsubscribeLinking();
    };
  }, []);

  // Don't hide splash screen here - let index.tsx handle it after navigation
  // This ensures smooth transition without white flash

  useEffect(() => {
    // Only initialize/reset if state actually changed to prevent loops
    if (user?.id && emailVerified) {
      // Only initialize if not already initialized for this user
      if (!subscriptionInitialized || useSubscriptionStore.getState().userId !== user.id) {
        initializeSubscription(user.id).catch(() => {});
      }
    } else {
      // Only reset if we were previously initialized
      if (subscriptionInitialized) {
        resetSubscription();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, emailVerified, subscriptionInitialized]);

  useEffect(() => {
    if (!user?.id || !emailVerified || !subscriptionInitialized) {
      return;
    }
    const onPaywallScreen = pathname?.startsWith('/subscription');
    const snapshot = useSubscriptionStore.getState().snapshot;
    const legacyAccess = snapshot?.legacyFreeAccess;
    const acknowledged = snapshot?.paywallAcknowledgedAt;
    
    // If legacy user hasn't acknowledged, don't force paywall yet
    // (The modal will be shown from profile screen or paywall screen)
    if (legacyAccess && !acknowledged) {
      return;
    }
    
    // Only auto-redirect TO paywall if user needs to see it
    // Don't redirect AWAY from paywall - allow users to manually view it
    // Use a ref to prevent multiple redirects in quick succession
    if (shouldShowPaywall && !onPaywallScreen) {
      // Use setTimeout to debounce rapid state changes
      const timeoutId = setTimeout(() => {
        router.replace('/subscription/paywall');
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    // Removed: else if (!shouldShowPaywall && onPaywallScreen) - allow manual navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowPaywall, subscriptionInitialized, pathname, user?.id, emailVerified]);

  const initializeApp = async () => {
    try {
      // Database is already initialized at this point

      // Initialize sync queue
      await syncQueue.init();
      debug.debug('Sync queue initialized');

      // Initialize notification manager (load settings)
      await notificationManager.init();
      
      // Cancel all existing notifications when initializing (in case of user switch)
      // This ensures old user's notifications don't persist
      await notificationManager.cancelAllNotifications();
      
      // Request notification permissions
      await notificationManager.requestPermissions();

      // Load data from stores (only if authenticated and email verified)
      // Profile, shifts, logs are user-specific and should only load after auth
      if (user && emailVerified) {
        // Clear old legacy data (without user_id) when a new authenticated user signs in
        await database.clearLegacyData();
        
        await Promise.all([
          loadProfile(user.id), // Pass userId to load user-specific profile
          loadShifts(user.id), // Pass userId to load user-specific shifts
          loadLogs(user.id), // Pass userId to load user-specific logs
          loadExportBatches(user.id), // Pass userId to load user-specific export batches
        ]);

        // Schedule notifications after shifts are loaded
        const { shifts } = useShiftsStore.getState();
        if (shifts.length > 0) {
          notificationManager.scheduleRolling7Days(shifts).catch(err => {
            debug.error('Failed to schedule notifications (non-fatal):', err);
          });
        }

        // Check and schedule unsubmitted AVAC notification after export batches are loaded
        const { exportBatches, logs, getDraftLogs, getReadyLogs } = useLogsStore.getState();
        if (exportBatches.length > 0) {
          notificationManager.checkAndScheduleUnsubmittedAVACNotification(exportBatches).catch(err => {
            debug.error('Failed to check unsubmitted AVAC notification (non-fatal):', err);
          });
        }

        // Schedule weekly summary and check incomplete drafts after logs are loaded
        if (logs.length > 0) {
          // Schedule weekly summary
          const totalMinutes = logs.reduce((sum, log) => sum + log.minutesOvertime, 0);
          const totalHours = totalMinutes / 60;
          const draftLogs = getDraftLogs();
          const readyLogs = getReadyLogs();
          const pendingCount = draftLogs.length + readyLogs.length;
          
          notificationManager.scheduleWeeklySummary(totalHours, pendingCount).catch(err => {
            debug.error('Failed to schedule weekly summary (non-fatal):', err);
          });

          // Check incomplete draft reminders
          const draftLogsForNotification = draftLogs.map(log => ({
            id: log.id,
            date: log.date,
            createdAt: log.createdAt,
            isActiveShift: log.isActiveShift
          }));
          notificationManager.checkAndScheduleIncompleteDraftReminder(draftLogsForNotification).catch(err => {
            debug.error('Failed to check incomplete draft reminder (non-fatal):', err);
          });
        }

        // Check and refresh OTA templates (non-blocking)
        if (templateOTAEnabled) {
          templatesSync.checkAndUpdate().catch(() => {});
        }

        // Auto-cleanup deleted items older than 30 days
        try {
          const { cleanupOldItems } = useDeletedItemsStore.getState();
          const result = await cleanupOldItems(user.id);
          const total = result.logsDeleted + result.shiftsDeleted + result.batchesDeleted;
          if (total > 0) {
            debug.debug(`Auto-cleaned up ${total} old deleted item(s)`);
          }
        } catch (error) {
          debug.error('Failed to cleanup old deleted items:', error);
        }
      }

      // Cleanup old PDF cache files (runs for all users, not just authenticated)
      try {
        const deletedCount = await cleanupOldPDFs();
        if (deletedCount > 0) {
          debug.debug(`Cleaned up ${deletedCount} old PDF file(s) from cache`);
        }
      } catch (error) {
        debug.error('Failed to cleanup old PDF cache:', error);
      }

      // Check and refresh OTA templates (runs for all users, not just authenticated)
      // Templates are public and should be available even without login
      if (templateOTAEnabled) {
        debug.debug('Checking for OTA template updates...');
        templatesSync.checkAndUpdate().catch((err) => {
          debug.error('Template OTA sync failed:', err);
        });
      }

      debug.debug('App initialized successfully');
    } catch (error) {
      debug.error('Failed to initialize app:', error);
    }
  };

  return (
    <ErrorBoundary>
      <View style={styles.rootContainer}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: '#007AFF' },
            animation: 'none', // Disable animation to prevent white flash
          }}
        >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="auth/verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="log/[id]" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="log/new" 
          options={{ 
            title: 'New Log',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="log/shift-swap" 
          options={{ 
            title: 'Shift Swap',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="export/preview" 
          options={{ 
            title: 'Export Preview',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="export/view" 
          options={{ 
            title: 'PDF Viewer',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="shifts/[id]" 
          options={{ 
            title: 'Edit Shift',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="shifts/new" 
          options={{ 
            title: 'Create Shift Pattern',
            presentation: 'modal',
            headerShown: true,
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#fff' : '#000',
            },
          }} 
        />
        <Stack.Screen 
          name="email-settings" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="clear-data" 
          options={{ 
            title: 'Clear Test Data',
            presentation: 'modal',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="delete-account" 
          options={{ 
            title: 'Delete Account',
            presentation: 'modal',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="widget/[action]" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="widget/confirm" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="log/template/new" 
          options={{ 
            title: 'Create Template',
            presentation: 'modal',
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="recently-deleted" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="notifications-settings" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen
          name="subscription/paywall"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        </Stack>
        {/* Global animated splash text overlay - stays visible until splash hides */}
        {showSplashText && <AnimatedSplashText onHide={() => setShowSplashText(false)} />}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#007AFF', // Match splash screen color
  },
});
