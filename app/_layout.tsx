import '../lib/utils/consoleSafe';
import '../lib/utils/secureFetch';
// Register the geofence background task handler at module scope (required by expo-task-manager)
import '../lib/location/geofenceManager';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Keep the native splash visible until our JS loading screen (index.tsx) is ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <View style={styles.rootContainer}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: '#ffffff' },
            animation: 'none',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="log/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="log/new"
            options={{
              title: 'New Log',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="log/shift-swap"
            options={{
              title: 'Shift Swap',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="log/leave"
            options={{
              title: 'Leave',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="log/edit-leave"
            options={{
              title: 'Edit Leave',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="log/edit-shift-swap"
            options={{
              title: 'Edit Shift Swap',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="export/preview"
            options={{
              title: 'Export Preview',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="export/view"
            options={{
              title: 'PDF Viewer',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="shifts/[id]"
            options={{
              title: 'Edit Shift',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="shifts/new"
            options={{
              title: 'Create Shift Pattern',
              presentation: 'modal',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#000' },
            }}
          />
          <Stack.Screen
            name="shifts/quick-add"
            options={{ title: 'Quick Shift', presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="email-settings"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="clear-data"
            options={{ title: 'Clear Test Data', presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="reset-app"
            options={{ title: 'Reset App', presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="backup"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="widget/[action]"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="widget/confirm"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="log/template/new"
            options={{ title: 'Create Template', presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="recently-deleted"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="notifications-settings"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="geofence-settings"
            options={{ headerShown: false }}
          />
        </Stack>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
