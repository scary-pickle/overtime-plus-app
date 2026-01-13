import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';

interface AnimatedSplashIconProps {
  onHide?: () => void;
  visible?: boolean;
}

/**
 * Static launch overlay that matches the native splash icon size and adds a spinner.
 */
export function AnimatedSplashIcon({ onHide, visible = true }: AnimatedSplashIconProps) {
  // Calculate icon size once using useMemo to ensure it's stable across renders
  // This prevents the icon from appearing larger on cold startup and then shrinking
  // The size is calculated once when the component mounts and never changes
  const layout = useMemo(() => {
    const window = Dimensions.get('window');
    const screen = Dimensions.get('screen');
    const width = screen.width > 0 ? screen.width : (window.width > 0 ? window.width : 375);
    const height = screen.height > 0 ? screen.height : (window.height > 0 ? window.height : 812);
    const iconSize = width * 0.6;
    const iconTop = Math.round((height - iconSize) / 2);
    const iconLeft = Math.round((width - iconSize) / 2);
    const spinnerTop = Math.round(iconTop + iconSize + 24);
    return { iconSize, iconTop, iconLeft, spinnerTop };
  }, []); // Empty dependency array ensures this only calculates once per component instance

  // Always render the container to ensure it's in the render tree immediately
  // When visible, it's fully opaque to immediately cover native splash
  if (!visible) {
    return null;
  }
  
  return (
    <View style={styles.container} pointerEvents="none">
      <View
        style={[
          styles.iconContainer,
          { width: layout.iconSize, height: layout.iconSize, top: layout.iconTop, left: layout.iconLeft }
        ]}
      >
        <Image
          source={require('../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
      <View style={[styles.spinnerContainer, { top: layout.spinnerTop }]}>
        <ActivityIndicator size="small" color="#007AFF" />
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
    position: 'absolute',
    // Width and height set dynamically to 60% of screen width
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  spinnerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
