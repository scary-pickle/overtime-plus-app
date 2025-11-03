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
import { notificationManager } from '../lib/notifications';
import { subscribeToAuthDeepLinks } from '../lib/auth/deeplinks';
import { useAuthStore } from '../lib/state/authStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { user, checkSession, emailVerified } = useAuthStore();
  const { loadProfile } = useProfileStore();
  const { loadShifts } = useShiftsStore();
  const { loadLogs, loadExportBatches } = useLogsStore();

  useEffect(() => {
    (async () => {
      await checkSession();
      await initializeApp();
    })();
    const unsubscribeLinking = subscribeToAuthDeepLinks();
    return () => {
      unsubscribeLinking();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await database.init();
      console.log('Database initialized');

      // Request notification permissions
      await notificationManager.requestPermissions();

      // Load data from stores (only if authenticated and email verified)
      // Profile, shifts, logs are user-specific and should only load after auth
      if (user && emailVerified) {
        await Promise.all([
          loadProfile(),
          loadShifts(),
          loadLogs(),
          loadExportBatches(),
        ]);
      }

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="auth/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ title: 'Sign In', headerShown: true }} />
        <Stack.Screen name="auth/sign-up" options={{ title: 'Create Account', headerShown: true }} />
        <Stack.Screen name="auth/verify-email" options={{ title: 'Verify Email', headerShown: true }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: 'Reset Password', headerShown: true }} />
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
      </Stack>
    </>
  );
}
