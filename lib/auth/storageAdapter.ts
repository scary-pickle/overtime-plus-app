import * as SecureStore from 'expo-secure-store';

// A minimal storage adapter compatible with @supabase/supabase-js auth storage API
// Provides getItem, setItem, removeItem using Expo SecureStore for better security on mobile
export const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key, {
        keychainService: 'overtime-securestore',
      });
      return value ?? null;
    } catch (error) {
      console.warn('SecureStoreAdapter.getItem failed', { key, error });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainService: 'overtime-securestore',
        // Use the most restrictive defaults available on the platform
      });
    } catch (error) {
      console.warn('SecureStoreAdapter.setItem failed', { key, error });
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainService: 'overtime-securestore',
      });
    } catch (error) {
      console.warn('SecureStoreAdapter.removeItem failed', { key, error });
    }
  },
};

export type StorageAdapter = typeof SecureStoreAdapter;


