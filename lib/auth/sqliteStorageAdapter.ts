import { database } from '../db/sqlite';
import * as SecureStore from 'expo-secure-store';
import base64 from 'react-native-base64';
import { createScopedLogger } from '../utils/logger';

const ENCRYPTION_KEY_STORE_KEY = 'overtime_auth_encryption_key';
const ENCRYPTION_THRESHOLD = 1500; // Encrypt values larger than this
const SECURE_STORE_OPTIONS = { keychainService: 'overtime-securestore' };

const debug = createScopedLogger('SQLiteStorageAdapter');

// Simple XOR encryption for SQLite storage
// Encryption key is stored in SecureStore (hardware-backed)
async function getEncryptionKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY, SECURE_STORE_OPTIONS);
    if (!key) {
      // Generate a new encryption key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      key = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key, SECURE_STORE_OPTIONS);
      debug.debug('Generated new encryption key');
    }
    return key;
  } catch (error) {
    debug.error('Failed to get encryption key:', error);
    throw error;
  }
}

// XOR encrypt/decrypt with binary-safe handling
function xorEncrypt(data: string, key: string): Uint8Array {
  const dataBytes = new TextEncoder().encode(data);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return result;
}

function xorDecrypt(encrypted: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    result[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(result);
}

// Convert Uint8Array to base64 string (binary-safe)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64.encode(binary);
}

// Convert base64 string to Uint8Array (binary-safe)
function base64ToUint8Array(base64Str: string): Uint8Array {
  const binary = base64.decode(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Key mapping: Use a different storage key for the actual session to avoid PKCE conflicts
const SESSION_KEY_SUFFIX = '-auth-token';
const ACTUAL_SESSION_KEY_SUFFIX = '-auth-token-session-data';

function getActualStorageKey(key: string): string {
  // If this is the main session key, map it to our dedicated storage key
  if (key.endsWith(SESSION_KEY_SUFFIX) && !key.includes('code-verifier') && !key.includes('-user')) {
    return key.replace(SESSION_KEY_SUFFIX, ACTUAL_SESSION_KEY_SUFFIX);
  }
  return key;
}

// Mutex to prevent concurrent writes to the same key
const writeLocks = new Map<string, Promise<void>>();

// Flag to track if we've cleaned up corrupted sessions
let hasCleanedCorruptedSessions = false;

// Migration version - increment this to force re-run migration
const MIGRATION_VERSION = 'v4_no_compression';
const MIGRATION_KEY = 'overtime_storage_migration_version';

// Clean up corrupted sessions (one-time migration for null-byte truncation bug fix)
async function cleanupCorruptedSessions(): Promise<void> {
  if (hasCleanedCorruptedSessions) return;
  
  try {
    // Wait for database to be ready
    const dbReady = await waitForDatabase();
    if (!dbReady) {
      debug.warn('Database not ready, skipping corrupted session cleanup');
      hasCleanedCorruptedSessions = true;
      return;
    }
    
    // Check if we've already run this migration
    const migrationRow = await database.getAuthSession(MIGRATION_KEY);
    if (migrationRow && migrationRow.value === MIGRATION_VERSION) {
      debug.debug('Migration already completed:', MIGRATION_VERSION);
      hasCleanedCorruptedSessions = true;
      return;
    }
    
    debug.debug('🔧 Running one-time migration to fix compression bug...');
    debug.debug('🧹 Clearing ALL auth sessions (you will need to sign in again)');
    
    // CRITICAL FIX: Mark migration as complete BEFORE clearing
    // This prevents the migration from running again after clearing!
    await database.setAuthSession(MIGRATION_KEY, MIGRATION_VERSION, 0);
    
    // Now clear ALL auth sessions EXCEPT the migration marker
    // We'll do this by getting all keys and removing non-migration keys
    const allKeys = await database.getAllAuthSessionKeys();
    for (const key of allKeys) {
      if (key !== MIGRATION_KEY) {
        await database.removeAuthSession(key);
      }
    }
    
    debug.debug('✅ Migration complete - all sessions cleared');
    debug.debug('ℹ️ You can now sign in and sessions will persist correctly');
    
    hasCleanedCorruptedSessions = true;
  } catch (error) {
    debug.warn('Failed to run migration:', error);
    // Don't throw - this is best-effort cleanup
    hasCleanedCorruptedSessions = true; // Don't retry
  }
}

async function withWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing write to complete
  const existingLock = writeLocks.get(key);
  if (existingLock) {
    debug.debug('Waiting for existing write lock on key:', key);
    try {
      await existingLock;
    } catch (e) {
      // Ignore errors from previous writes
    }
  }

  // Create our lock
  let resolveLock: () => void;
  const lock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  writeLocks.set(key, lock);

  try {
    const result = await fn();
    return result;
  } finally {
    // Release the lock
    resolveLock!();
    writeLocks.delete(key);
  }
}

function isSupabaseSessionKey(key: string): boolean {
  return key.includes('supabase') ||
    key.includes('auth') ||
    key.includes('session') ||
    key.includes('sb-');
}

// Helper to wait for database initialization
async function waitForDatabase(maxWaitMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;
  
  // Check if already initialized
  if (database['db']) {
    debug.debug('Database already initialized');
    return true;
  }
  
  debug.debug('Waiting for database initialization...');
  
  while (!database['db']) {
    attempts++;
    const elapsed = Date.now() - startTime;
    
    if (elapsed > maxWaitMs) {
      debug.error('Timeout waiting for database initialization after', elapsed, 'ms and', attempts, 'attempts');
      return false;
    }
    
    // Log progress every second
    if (attempts % 20 === 0) {
      debug.debug('Still waiting for database...', elapsed, 'ms elapsed,', attempts, 'attempts');
    }
    
    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const totalTime = Date.now() - startTime;
  debug.debug('Database ready after', totalTime, 'ms and', attempts, 'attempts');
  return true;
}

export const SQLiteStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      // First time accessing storage, clean up any corrupted sessions
      await cleanupCorruptedSessions();
      
      // Use dedicated storage key to avoid PKCE conflicts
      const storageKey = getActualStorageKey(key);
      
      // Log full key to understand what's being accessed
      debug.debug('Getting item:', key, storageKey !== key ? `(mapped to: ${storageKey})` : '');
      
      // Wait for database to be initialized (with timeout)
      // This is critical for session restoration on app start
      const dbReady = await waitForDatabase();
      if (!dbReady) {
        debug.debug('Database not ready after timeout, returning null');
        return null;
      }
      
      // Get from database using the mapped key
      let row;
      try {
        row = await database.getAuthSession(storageKey);
      } catch (dbError: any) {
        if (dbError?.message?.includes('not initialized')) {
          debug.debug('Database not initialized (unexpected), returning null');
          return null;
        }
        throw dbError; // Re-throw if it's a different error
      }
      if (!row) {
        debug.debug('No value found for key');
        return null;
      }

      let value = row.value;
      const originalEncryptedSize = value.length;
      
      // Decrypt if needed
      if (row.encrypted) {
        try {
          const encryptionKey = await getEncryptionKey();
          // Convert base64 string to Uint8Array (binary-safe)
          const encryptedBytes = base64ToUint8Array(value);
          debug.debug('Converted from base64, encrypted bytes:', encryptedBytes.length);
          
          // XOR decrypt (returns the original string)
          value = xorDecrypt(encryptedBytes, encryptionKey);
          debug.debug('Decrypted, length:', value.length);
        } catch (decryptError) {
          debug.warn('Failed to decrypt value:', decryptError);
          return null;
        }
      }

      // Compression is disabled - data is stored uncompressed
      // Validate session data size
      if (isSupabaseSessionKey(key)) {
        if (key.includes('auth-token') && !key.includes('code-verifier') && !key.includes('-user')) {
          if (value.length < 1000) {
            debug.error('🚨 CORRUPTED SESSION DETECTED!', {
              key: key.substring(0, 50) + '...', // Only log partial key
              size: value.length,
              message: 'A valid session should be at least 2000 characters!'
            });
            return null;
          }
          
          // CRITICAL: Validate that decrypted session is valid JSON
          try {
            const parsed = JSON.parse(value);
            debug.debug('✅ Session JSON is valid:', {
              hasAccessToken: !!parsed.access_token,
              hasRefreshToken: !!parsed.refresh_token,
              hasUser: !!parsed.user,
              accessTokenLength: parsed.access_token?.length || 0
              // DO NOT log token content - it's sensitive
            });
          } catch (jsonError: any) {
            debug.error('🚨 INVALID SESSION JSON!', {
              key: key.substring(0, 50) + '...', // Only log partial key
              length: value.length,
              error: jsonError.message
              // DO NOT log token content - it's sensitive
            });
            // Return null so Supabase knows the session is invalid
            return null;
          }
        }
      }

      debug.debug('Returning value as-is, length:', value.length);
      return value;
    } catch (error) {
      debug.warn('getItem failed:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    // Use write lock to prevent race conditions
    const storageKey = getActualStorageKey(key);
    
    return withWriteLock(storageKey, async () => {
      try {
        // Log full key to understand what's being stored
        debug.debug('Setting item:', key, storageKey !== key ? `(mapped to: ${storageKey})` : '', 'value length:', value.length);
        
        // Log auth-token writes for debugging (only in dev, with masking)
        if (key.includes('auth-token') && !key.includes('code-verifier') && !key.includes('-user')) {
          debug.debug('⚠️ WRITING TO AUTH TOKEN KEY', {
            originalKey: key.substring(0, 50) + '...', // Only partial key
            storageKey: storageKey.substring(0, 50) + '...',
            valueLength: value.length
            // DO NOT log token content - it's sensitive
          });
        }
        
        // Wait for database to be initialized (with timeout)
        const dbReady = await waitForDatabase();
        if (!dbReady) {
          debug.debug('Database not ready after timeout, cannot store value');
          // Don't throw - Supabase will retry when database is ready
          return;
        }
      
      try {
        // DISABLED: LZString compression produces Unicode that gets corrupted by TextEncoder/TextDecoder
        // Session data (~2200 bytes) is small enough to store uncompressed
        let payload = value;
        let compressed = false;

        // Encrypt if payload is large
        // Use binary-safe XOR encryption with Uint8Array to avoid UTF-8 corruption
        let encrypted = 0;
        const payloadBytes = new TextEncoder().encode(payload).length;
        if (payloadBytes > ENCRYPTION_THRESHOLD) {
          try {
            const encryptionKey = await getEncryptionKey();
            // XOR encrypt returns Uint8Array (binary-safe)
            const encryptedBytes = xorEncrypt(payload, encryptionKey);
            // Convert to base64 for safe TEXT storage in SQLite
            payload = uint8ArrayToBase64(encryptedBytes);
            encrypted = 1;
            debug.debug('Encrypted value (binary-safe):', { 
              originalLength: payloadBytes, 
              encryptedBytes: encryptedBytes.length,
              base64Length: payload.length
            });
          } catch (encryptError) {
            debug.warn('Encryption failed:', encryptError);
            // Continue with unencrypted value
          }
        }

        await database.setAuthSession(storageKey, payload, encrypted);
        debug.debug('Successfully stored in SQLite');
        
        // CRITICAL: Verify the write was successful for session keys
        if (key.includes('auth-token') && !key.includes('code-verifier') && !key.includes('-user')) {
          const verification = await database.getAuthSession(storageKey);
          if (verification && verification.value) {
            debug.debug('✅ WRITE VERIFIED - stored value length:', verification.value.length);
            if (verification.value.length < 300) {
              debug.error('🚨 WRITE CORRUPTION DETECTED!', {
                expectedEncryptedLength: payload.length,
                actualStoredLength: verification.value.length,
                message: 'THIS IS THE SOURCE OF CORRUPTION!'
              });
            }
          } else {
            debug.error('❌ WRITE VERIFICATION FAILED - value not found!');
          }
        }
      } catch (dbError: any) {
        if (dbError?.message?.includes('not initialized')) {
          debug.debug('Database not initialized (unexpected), cannot store value');
          // Don't throw - Supabase will retry when database is ready
          return;
        }
        throw dbError; // Re-throw if it's a different error
      }
      } catch (error) {
        debug.error('setItem failed:', error);
        throw error;
      }
    }); // End of withWriteLock
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Use dedicated storage key to avoid PKCE conflicts
      const storageKey = getActualStorageKey(key);
      
      // Log full key to understand what Supabase is removing
      debug.debug('Removing item:', key, storageKey !== key ? `(mapped to: ${storageKey})` : '');
      
      // Check if this is the main session key (contains 'auth-token')
      const isMainSessionKey = key.includes('auth-token') && !key.includes('code-verifier') && !key.includes('-user');
      if (isMainSessionKey) {
        debug.debug('ℹ️ Removing main session key:', key.substring(0, 50) + '...', '→', storageKey.substring(0, 50) + '...');
      }
      
      await database.removeAuthSession(storageKey);
      debug.debug('Successfully removed from SQLite');
    } catch (error) {
      debug.warn('removeItem failed:', error);
    }
  },
};

