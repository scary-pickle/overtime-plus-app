import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { database } from '../lib/db/sqlite';
import { useProfileStore } from '../lib/state/profileStore';
import { useShiftsStore } from '../lib/state/shiftsStore';
import { useLogsStore } from '../lib/state/logsStore';
import { notificationManager } from '../lib/notifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadProfile } = useProfileStore();
  const { loadShifts } = useShiftsStore();
  const { loadLogs, loadExportBatches } = useLogsStore();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await database.init();
      console.log('Database initialized');

      // Request notification permissions
      await notificationManager.requestPermissions();

      // Load data from stores
      await Promise.all([
        loadProfile(),
        loadShifts(),
        loadLogs(),
        loadExportBatches(),
      ]);

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
          name="clear-data" 
          options={{ 
            title: 'Clear Test Data',
            presentation: 'modal',
            headerShown: false 
          }} 
        />
      </Stack>
    </>
  );
}
