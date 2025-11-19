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
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.overtimeplus.app'
  },
  android: {
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.overtimeplus.app'
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
        color: '#ffffff',
        sounds: ['./assets/notification.wav']
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
      projectId: 'your-project-id'
    },
    revenuecat: {
      iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
      androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
      amazonApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_AMAZON
    }
  }
});
