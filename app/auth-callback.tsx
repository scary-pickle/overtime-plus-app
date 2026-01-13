import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { handlePasswordResetLink, exchangeSessionFromUrl } from '../lib/auth/deeplinks';
import { createScopedLogger } from '../lib/utils/logger';
import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';

const debug = createScopedLogger('AuthCallback');

/**
 * Auth callback handler for deep links
 * Handles both password reset and regular auth flows
 * This route is matched by expo-router when deep links like:
 * - overtime-plus://auth-callback?code=... (PKCE flow)
 * - overtime-plus://auth-callback#access_token=...&type=recovery (password reset)
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full URL - expo-router receives the deep link URL
        // We need to reconstruct it from the current URL or get it from Linking
        let currentUrl: string | null = null;
        
        // Try to get the URL that opened the app
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('auth-callback')) {
          currentUrl = initialUrl;
        } else {
          // Reconstruct from params if available
          const queryString = new URLSearchParams(params as any).toString();
          if (queryString) {
            currentUrl = `overtime-plus://auth-callback?${queryString}`;
          }
        }

        if (!currentUrl) {
          debug.error('No URL found in callback');
          router.replace('/auth/sign-in');
          return;
        }

        debug.debug('Processing auth callback', { 
          url: currentUrl.substring(0, 150),
          fullUrl: currentUrl,
        });

        // First, check if it's a password reset flow (type=recovery in params)
        const isPasswordReset = await handlePasswordResetLink(currentUrl);
        if (isPasswordReset) {
          debug.debug('Password reset flow detected, handled by handlePasswordResetLink');
          return;
        }

        // Otherwise, handle as regular auth flow (email verification, magic link, etc.)
        debug.debug('Handling as regular auth flow - setting session from URL tokens');
        const success = await exchangeSessionFromUrl(currentUrl);
        if (success) {
          debug.debug('Auth callback successful, redirecting to home');
          router.replace('/(tabs)/home');
        } else {
          debug.warn('Auth callback failed, redirecting to sign-in');
          router.replace('/auth/sign-in');
        }
      } catch (error) {
        debug.error('Error handling auth callback:', error);
        router.replace('/auth/sign-in');
      }
    };

    // Run immediately - don't delay, we need to exchange code before checkSession runs
    handleCallback();
  }, [router, params]);

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={[styles.text, isDark && styles.darkText]}>Processing...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    gap: 16,
  },
  darkContainer: {
    backgroundColor: '#000000',
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
});
