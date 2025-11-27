import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
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

const debug = createScopedLogger('App');

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, checkSession, emailVerified } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const { loadShifts } = useShiftsStore();
  const { loadLogs, loadExportBatches } = useLogsStore();
  const router = useRouter();
  const pathname = usePathname();
  const shouldShowPaywall = useSubscriptionStore((state) => state.access.shouldShowPaywall);
  const subscriptionInitialized = useSubscriptionStore((state) => state.initialized);
  const initializeSubscription = useSubscriptionStore((state) => state.init);
  const resetSubscription = useSubscriptionStore((state) => state.reset);

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
    })();
    const unsubscribeLinking = subscribeToAuthDeepLinks();
    return () => {
      unsubscribeLinking();
    };
  }, []);

  useEffect(() => {
    if (user?.id && emailVerified) {
      initializeSubscription(user.id).catch(() => {});
    } else {
      resetSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, emailVerified]);

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
    if (shouldShowPaywall && !onPaywallScreen) {
      router.replace('/subscription/paywall');
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
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
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
          name="subscription/paywall"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
