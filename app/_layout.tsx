import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, checkSession, emailVerified } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const { loadShifts } = useShiftsStore();
  const { loadLogs, loadExportBatches } = useLogsStore();

  useEffect(() => {
    (async () => {
      // Initialize database FIRST before checking session
      // Local tables back offline data; purge any legacy auth tokens from SQLite
      try {
        await database.init();
        console.log('Database initialized');
        await purgeLegacyAuthStorage();
      } catch (error) {
        console.error('Failed to initialize database:', error);
        return;
      }
      
      // Now check session (SecureStore-backed adapter restores Supabase session)
      // CRITICAL: Log database state RIGHT BEFORE checkSession
      try {
        const sessionCount = await database.countAuthSessions();
        if (process.env.NODE_ENV !== 'production') {
          const allKeys = await database.getAllAuthSessionKeys();
          console.log('[authStore.checkSession] 🔍 Database state BEFORE checkSession:', {
            sessionCount,
            keys: allKeys
          });
        }
      } catch (dbError) {
        console.error('[authStore.checkSession] Failed to check database state:', dbError);
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

  const initializeApp = async () => {
    try {
      // Database is already initialized at this point

      // Initialize sync queue
      await syncQueue.init();
      console.log('Sync queue initialized');

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
            console.log(`[App] Auto-cleaned up ${total} old deleted item(s)`);
          }
        } catch (error) {
          console.error('[App] Failed to cleanup old deleted items:', error);
        }
      }

      // Cleanup old PDF cache files (runs for all users, not just authenticated)
      try {
        const deletedCount = await cleanupOldPDFs();
        if (deletedCount > 0) {
          console.log(`[App] Cleaned up ${deletedCount} old PDF file(s) from cache`);
        }
      } catch (error) {
        console.error('[App] Failed to cleanup old PDF cache:', error);
      }

      // Check and refresh OTA templates (runs for all users, not just authenticated)
      // Templates are public and should be available even without login
      if (templateOTAEnabled) {
        console.log('[App] Checking for OTA template updates...');
        templatesSync.checkAndUpdate().catch((err) => {
          console.error('[App] Template OTA sync failed:', err);
        });
      }

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  return (
    <ErrorBoundary>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
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
      </Stack>
    </ErrorBoundary>
  );
}
