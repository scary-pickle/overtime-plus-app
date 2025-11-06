import * as SecureStore from 'expo-secure-store';
import base64 from 'react-native-base64';
import { database } from '../db/sqlite';

// Simple XOR cipher for encryption (lightweight, sufficient for SQLite storage)
// The encryption key itself is stored in SecureStore
function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return base64.encode(result); // Base64 encode
}

function simpleDecrypt(encrypted: string, key: string): string {
  try {
    const text = base64.decode(encrypted); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (error) {
    throw new Error('Failed to decrypt data');
  }
}

// Get or generate encryption key stored in SecureStore
async function getEncryptionKey(): Promise<string> {
  const KEY_NAME = 'auth_storage_encryption_key';
  let key = await SecureStore.getItemAsync(KEY_NAME, {
    keychainService: 'overtime-securestore',
  });

  if (!key) {
    // Generate a new key (32 random characters)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Store the key securely in SecureStore
    await SecureStore.setItemAsync(KEY_NAME, key, {
      keychainService: 'overtime-securestore',
    });
  }

  return key;
}

/**
 * SQLite-based storage adapter for Supabase auth sessions
 * Stores session data in SQLite to avoid SecureStore's 2048 byte limit
 * Uses encryption with key stored in SecureStore for security
 */
export const SQLiteStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Wait for database to be initialized (with timeout)
      // This is important because Supabase may try to restore session before database is ready
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait (50 * 100ms)
      
      // @ts-ignore - accessing private db property to check initialization
      while (!database || !(database as any).db) {
        if (attempts >= maxAttempts) {
          console.warn('SQLiteStorageAdapter.getItem: Database not initialized after timeout, returning null');
          return null;
        }
        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const row = await database.getAuthSession(key);

      if (!row) return null;

      let value = row.value;

      // Decrypt if encrypted
      if (row.encrypted === 1) {
        try {
          const encryptionKey = await getEncryptionKey();
          value = simpleDecrypt(value, encryptionKey);
        } catch (decryptError) {
          console.warn(`SQLiteStorageAdapter.getItem: Failed to decrypt value for key "${key}"`, decryptError);
          return null;
        }
      }

      return value;
    } catch (error) {
      // If error is "Database not initialized", return null gracefully
      // This happens during app startup before database is ready
      if (error instanceof Error && error.message === 'Database not initialized') {
        return null;
      }
      console.warn('SQLiteStorageAdapter.getItem failed', { key, error });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Wait for database to be initialized (with timeout)
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait (50 * 100ms)
      
      // @ts-ignore - accessing private db property to check initialization
      while (!database || !(database as any).db) {
        if (attempts >= maxAttempts) {
          console.warn('SQLiteStorageAdapter.setItem: Database not initialized after timeout, cannot store session');
          return;
        }
        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const sizeInBytes = new TextEncoder().encode(value).length;
      
      // For large values (> 1500 bytes), encrypt them
      // For small values, store as-is for performance
      const shouldEncrypt = sizeInBytes > 1500;
      let finalValue = value;
      let encrypted = 0;

      if (shouldEncrypt) {
        try {
          const encryptionKey = await getEncryptionKey();
          finalValue = simpleEncrypt(value, encryptionKey);
          encrypted = 1;
        } catch (encryptError) {
          console.warn(`SQLiteStorageAdapter.setItem: Failed to encrypt value for key "${key}"`, encryptError);
          // Continue with unencrypted storage if encryption fails
        }
      }

      await database.setAuthSession(key, finalValue, encrypted);

      if (shouldEncrypt) {
        console.log(`SQLiteStorageAdapter.setItem: Stored encrypted value for key "${key}" (${sizeInBytes} bytes)`);
      }
    } catch (error) {
      // If error is "Database not initialized", return gracefully
      if (error instanceof Error && error.message === 'Database not initialized') {
        console.warn('SQLiteStorageAdapter.setItem: Database not initialized yet, cannot store session');
        return;
      }
      console.warn('SQLiteStorageAdapter.setItem failed', { key, error });
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Check if database is initialized
      // @ts-ignore - accessing private db property to check initialization
      if (!database || !(database as any).db) {
        // Database not initialized yet - return gracefully
        return;
      }

      await database.removeAuthSession(key);
    } catch (error) {
      // If error is "Database not initialized", return gracefully
      if (error instanceof Error && error.message === 'Database not initialized') {
        return;
      }
      console.warn('SQLiteStorageAdapter.removeItem failed', { key, error });
    }
  },
};

export type StorageAdapter = typeof SQLiteStorageAdapter;

