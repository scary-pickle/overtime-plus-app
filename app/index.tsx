import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text, SafeAreaView } from 'react-native';
import { useAuthStore } from '../lib/state/authStore';

import { createScopedLogger } from '../lib/utils/logger';

const logger = createScopedLogger('Index');

export default function Index() {
  const router = useRouter();
  const { user, emailVerified, hasCompletedOnboarding, isLoading } = useAuthStore();

  logger.debug('[app/index] Render state:', {
    isLoading,
    hasUser: !!user,
    userId: user?.id?.substring(0, 8),
    emailVerified,
    hasCompletedOnboarding,
  });

  useEffect(() => {
    // Don't navigate while loading
    if (isLoading) {
      logger.debug('[app/index] Still loading, waiting...');
      return;
    }

    // Navigate based on auth state
    if (!user) {
      logger.debug('[app/index] No user - navigating to welcome');
      router.replace('/auth/welcome');
      return;
    }

    if (!emailVerified) {
      logger.debug('[app/index] Email not verified - navigating to verify-email');
      router.replace('/auth/verify-email');
      return;
    }

    if (!hasCompletedOnboarding) {
      logger.debug('[app/index] Onboarding not complete - navigating to onboarding');
      router.replace('/onboarding/welcome');
      return;
    }

    logger.debug('[app/index] User authenticated - navigating to home');
    router.replace('/(tabs)/home');
  }, [isLoading, user, emailVerified, hasCompletedOnboarding, router]);

  // Show welcome screen with loading spinner while checking session or navigating
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconPlaceholder} />
        </View>
        <Text style={styles.title}>Welcome to Overtime+</Text>
        <Text style={styles.descriptionPlaceholder}>
          Track your overtime hours, manage your shifts, and generate AVAC forms with ease.
        </Text>
        <View style={styles.featuresPlaceholder}>
          <View style={styles.featureItemPlaceholder} />
          <View style={styles.featureItemPlaceholder} />
          <View style={styles.featureItemPlaceholder} />
        </View>
        <View style={styles.buttonPlaceholder}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconPlaceholder: {
    width: 80,
    height: 80,
    opacity: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  descriptionPlaceholder: {
    fontSize: 16,
    color: 'transparent',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  featuresPlaceholder: {
    width: '100%',
    marginBottom: 48,
    gap: 16,
  },
  featureItemPlaceholder: {
    height: 24,
    opacity: 0,
  },
  buttonPlaceholder: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
