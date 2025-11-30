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
        // Delay to ensure screen is fully painted and for a smooth transition
        // This creates a professional feel rather than a quick flash
        // Longer delay for a more polished, professional appearance
        const delay = Platform.OS === 'ios' ? 1200 : 1000;
        setTimeout(() => {
          SplashScreen.hideAsync().catch((error) => {
            // Splash may already be hidden, ignore error
          });
        }, delay);
      }
    }, [])
  );
}

