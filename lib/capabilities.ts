/**
 * Feature flags for Phase-2 capabilities
 * These are disabled for Expo Go compatibility
 */

export interface Capabilities {
  // iOS Live Activities (ActivityKit)
  supportsLiveActivities: boolean;
  
  // Android Foreground Service for ongoing notifications
  supportsAndroidForegroundService: boolean;
  
  // Background geofencing for auto start/stop
  supportsBackgroundGeofencing: boolean;
  
  // iOS Home/Lock Screen widgets
  supportsWidgets: boolean;
  
  // Advanced notification actions
  supportsNotificationActions: boolean;
  
  // Background location access
  supportsBackgroundLocation: boolean;
}

/**
 * Current capabilities (all false for Expo Go MVP)
 */
export const capabilities: Capabilities = {
  supportsLiveActivities: false,
  supportsAndroidForegroundService: false,
  supportsBackgroundGeofencing: false,
  supportsWidgets: false,
  supportsNotificationActions: false,
  supportsBackgroundLocation: false,
};

/**
 * Check if a specific capability is available
 */
export function hasCapability(capability: keyof Capabilities): boolean {
  return capabilities[capability];
}

/**
 * Get all available capabilities
 */
export function getAvailableCapabilities(): string[] {
  return Object.entries(capabilities)
    .filter(([_, enabled]) => enabled)
    .map(([capability, _]) => capability);
}

/**
 * Get all disabled capabilities
 */
export function getDisabledCapabilities(): string[] {
  return Object.entries(capabilities)
    .filter(([_, enabled]) => !enabled)
    .map(([capability, _]) => capability);
}

/**
 * TODO: Phase-2 Implementation Notes
 * 
 * When migrating to custom dev builds, these capabilities can be enabled:
 * 
 * 1. supportsLiveActivities (iOS):
 *    - Implement ActivityKit for Live Activities
 *    - Show real-time shift status on Lock Screen
 *    - Update: Add ActivityKit framework, implement ActivityManager
 * 
 * 2. supportsAndroidForegroundService (Android):
 *    - Implement ForegroundService for ongoing notifications
 *    - Keep shift timer running in background
 *    - Update: Add foreground service, notification channel
 * 
 * 3. supportsBackgroundGeofencing:
 *    - Implement background location monitoring
 *    - Auto-start/stop shifts based on location
 *    - Update: Add location permissions, geofencing logic
 * 
 * 4. supportsWidgets (iOS):
 *    - Create Home/Lock Screen widgets
 *    - Show today's shift info and quick actions
 *    - Update: Add WidgetKit framework, widget extensions
 * 
 * 5. supportsNotificationActions:
 *    - Add action buttons to notifications
 *    - "End Shift", "Snooze", "Start Break" actions
 *    - Update: Enhance notification content with actions
 * 
 * 6. supportsBackgroundLocation:
 *    - Access location in background for geofencing
 *    - More accurate location-based features
 *    - Update: Add background location permissions
 */

/**
 * Development helper to enable capabilities for testing
 * (Only use in development builds, not Expo Go)
 */
export function enableCapabilityForTesting(capability: keyof Capabilities): void {
  if (__DEV__) {
    console.warn(`Enabling ${capability} for testing - this may not work in Expo Go`);
    (capabilities as any)[capability] = true;
  }
}

/**
 * Check if running in Expo Go
 */
export function isExpoGo(): boolean {
  // This is a simple check - in practice, you might want to use
  // Constants.appOwnership === 'expo' or similar
  return true; // Assume Expo Go for MVP
}

/**
 * Get capability status with explanation
 */
export function getCapabilityStatus(): Record<string, { enabled: boolean; reason: string }> {
  return {
    supportsLiveActivities: {
      enabled: capabilities.supportsLiveActivities,
      reason: capabilities.supportsLiveActivities 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with ActivityKit'
    },
    supportsAndroidForegroundService: {
      enabled: capabilities.supportsAndroidForegroundService,
      reason: capabilities.supportsAndroidForegroundService 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with foreground service'
    },
    supportsBackgroundGeofencing: {
      enabled: capabilities.supportsBackgroundGeofencing,
      reason: capabilities.supportsBackgroundGeofencing 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with background location'
    },
    supportsWidgets: {
      enabled: capabilities.supportsWidgets,
      reason: capabilities.supportsWidgets 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with WidgetKit'
    },
    supportsNotificationActions: {
      enabled: capabilities.supportsNotificationActions,
      reason: capabilities.supportsNotificationActions 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with notification actions'
    },
    supportsBackgroundLocation: {
      enabled: capabilities.supportsBackgroundLocation,
      reason: capabilities.supportsBackgroundLocation 
        ? 'Available in custom dev build' 
        : 'Requires custom dev build with background location permissions'
    }
  };
}
