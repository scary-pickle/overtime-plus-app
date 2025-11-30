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
    backgroundColor: '#007AFF'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.overtimeplus.app',
    infoPlist: {
      NSUserNotificationUsageDescription: 'Overtime+ uses notifications to remind you when your rostered shift ends and to send snoozed reminders.',
      NSAllowsLocalNetworking: process.env.EXPO_PUBLIC_ALLOW_HTTP_IN_DEV === 'true',
    }
  },
  android: {
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.overtimeplus.app',
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
