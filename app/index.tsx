import 'react-native-reanimated';
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../lib/state/authStore';
import { createScopedLogger } from '../lib/utils/logger';

const logger = createScopedLogger('Index');

export default function Index() {
  const router = useRouter();
  const { user, emailVerified, hasCompletedOnboarding, isLoading } = useAuthStore();
  const hasNavigated = useRef(false);

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

    // Prevent multiple navigations
    if (hasNavigated.current) {
      return;
    }

    // Navigate based on auth state
    let targetRoute: string;
    if (!user) {
      logger.debug('[app/index] No user - navigating to welcome');
      targetRoute = '/auth/welcome';
    } else if (!emailVerified) {
      logger.debug('[app/index] Email not verified - navigating to verify-email');
      targetRoute = '/auth/verify-email';
    } else if (!hasCompletedOnboarding) {
      logger.debug('[app/index] Onboarding not complete - navigating to onboarding');
      targetRoute = '/onboarding/welcome';
    } else {
      logger.debug('[app/index] User authenticated - navigating to home');
      targetRoute = '/(tabs)/home';
    }

    hasNavigated.current = true;
    
    // Navigate immediately - no splash overlays, just native splash then app content
    router.replace(targetRoute);
  }, [isLoading, user, emailVerified, hasCompletedOnboarding, router]);

  // Return null - this is just a routing component
  return null;
}
