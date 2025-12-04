import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated, Platform, Easing } from 'react-native';

interface AnimatedSplashIconProps {
  onHide?: () => void;
}

/**
 * Animated splash icon component that shows the app icon with a smooth transition
 * Starts at 60% to match native splash screen (which should also be at 60% scale)
 * Provides a seamless transition from splash screen to app content
 */
export function AnimatedSplashIcon({ onHide }: AnimatedSplashIconProps) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current; // Start at 60% to match native splash
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Keep icon at 60% scale to match native splash - no scale animation needed
    // Just keep it visible until fade out
    
    // Keep icon visible until app is ready and navigation completes
    // This ensures smooth transition from native splash to app content
    const displayDuration = Platform.OS === 'ios' ? 1500 : 1500;
    const hideTimer = setTimeout(() => {
      // Fade out smoothly with easing
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
        onHide?.(); // Notify parent to unmount component
      });
    }, displayDuration);
    
    return () => {
      clearTimeout(hideTimer);
    };
  }, [fadeAnim, onHide]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: fadeAnim }
      ]} 
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </Animated.View>
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
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999, // Android z-index
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
});

