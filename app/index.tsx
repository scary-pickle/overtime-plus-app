import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/state/authStore';

const isDev = process.env.NODE_ENV !== 'production';
const debug = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

export default function Index() {
  const router = useRouter();
  const { user, emailVerified, hasCompletedOnboarding, isLoading } = useAuthStore();

  debug('[app/index] Render state:', {
    isLoading,
    hasUser: !!user,
    userId: user?.id?.substring(0, 8),
    emailVerified,
    hasCompletedOnboarding,
  });

  useEffect(() => {
    // Don't navigate while loading
    if (isLoading) {
      debug('[app/index] Still loading, waiting...');
      return;
    }

    // Navigate based on auth state
    if (!user) {
      debug('[app/index] No user - navigating to welcome');
      router.replace('/auth/welcome');
      return;
    }

    if (!emailVerified) {
      debug('[app/index] Email not verified - navigating to verify-email');
      router.replace('/auth/verify-email');
      return;
    }

    if (!hasCompletedOnboarding) {
      debug('[app/index] Onboarding not complete - navigating to onboarding');
      router.replace('/onboarding/welcome');
      return;
    }

    debug('[app/index] User authenticated - navigating to home');
    router.replace('/(tabs)/home');
  }, [isLoading, user, emailVerified, hasCompletedOnboarding, router]);

  // Show loading spinner while checking session
  if (isLoading) {
    debug('[app/index] Showing loading spinner');
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Show loading spinner while navigating (prevents flash of wrong screen)
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
