import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

/**
 * Animated welcome text component that matches the splash screen
 * Provides a smooth fade-in and scale animation
 * Stays visible until splash screen is hidden (matches hideSplashOnFocus timing)
 */
export function AnimatedSplashText() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const overlayFadeAnim = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start text animations immediately when component mounts
    const startTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, 50);
    
    // Hide overlay after the same delay as splash screen hides
    // This matches the timing in hideSplashOnFocus.ts (1200ms iOS, 1000ms Android)
    const splashHideDelay = Platform.OS === 'ios' ? 1200 : 1000;
    const hideTimer = setTimeout(() => {
      // Fade out the overlay smoothly
      Animated.timing(overlayFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
      });
    }, splashHideDelay);
    
    return () => {
      clearTimeout(startTimer);
      clearTimeout(hideTimer);
    };
  }, [fadeAnim, scaleAnim, overlayFadeAnim]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: overlayFadeAnim }
      ]} 
      pointerEvents="none"
    >
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        Welcome to Overtime+
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF', // Blue background to match splash screen
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999, // Android z-index
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});

