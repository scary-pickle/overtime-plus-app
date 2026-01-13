import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Overtime+',
  slug: 'overtime-plus',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash-60.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*',
    '!cache/**'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.overtimeplus.app',
    buildNumber: '5',
    infoPlist: {
      NSUserNotificationUsageDescription: 'Overtime+ uses notifications to remind you when your rostered shift ends and to send snoozed reminders.',
      NSAllowsLocalNetworking: process.env.EXPO_PUBLIC_ALLOW_HTTP_IN_DEV === 'true',
      // Ensure URL scheme is properly registered for deep linking
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ['overtime-plus'],
          CFBundleURLName: 'com.overtimeplus.app',
        },
      ],
    }
  },
  android: {
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.overtimeplus.app',
    // @ts-ignore - networkSecurityConfig is valid but not in Expo types
    networkSecurityConfig: 'res/xml/network_security_config.xml'
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#ffffff'
      }
    ],
    [
      'expo-sqlite',
      {
        enableFTS: true
      }
    ]
  ],
  scheme: 'overtime-plus',
  extra: {
    router: {
      origin: false
    },
    eas: {
      // Linked EAS project ID created by `eas build:configure`
      projectId: 'ab788c8c-812d-4a78-a620-4f1131f759de',
    },
    revenuecat: {
      iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
      androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
      amazonApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_AMAZON
    }
  }
});
