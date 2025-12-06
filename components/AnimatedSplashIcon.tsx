import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';

interface AnimatedSplashIconProps {
  onHide?: () => void;
}

/**
 * Static splash icon component that shows the app icon
 * No animations - provides predictable, consistent loading experience
 * Matches native splash screen appearance
 */
export function AnimatedSplashIcon({ onHide }: AnimatedSplashIconProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Hide immediately - no delays, no animations
    // The native splash screen handles the initial display
    // This component just ensures smooth transition when native splash hides
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onHide?.(); // Notify parent to unmount component
    }, 100); // Minimal delay just to ensure native splash has hidden
    
    return () => {
      clearTimeout(hideTimer);
    };
  }, [onHide]);

  if (!isVisible) {
    return null;
  }

  return (
    <View 
      style={styles.container} 
      pointerEvents="none"
    >
      <View style={styles.iconContainer}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
    </View>
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

