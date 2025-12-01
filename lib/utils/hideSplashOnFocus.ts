import { useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { Platform } from 'react-native';

/**
 * Hook to hide splash screen when screen comes into focus
 * This ensures the splash only hides when the target screen is actually ready
 * Includes a delay for a smooth, professional transition
 */
export function useHideSplashOnFocus() {
  const hasHiddenSplash = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!hasHiddenSplash.current) {
        hasHiddenSplash.current = true;
        // Very short delay - animation should start almost instantly
        // Just enough time for the screen to be ready
        const delay = Platform.OS === 'ios' ? 100 : 80;
        setTimeout(() => {
          SplashScreen.hideAsync().catch((error) => {
            // Splash may already be hidden, ignore error
          });
        }, delay);
      }
    }, [])
  );
}

