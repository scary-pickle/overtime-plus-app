import * as SecureStore from 'expo-secure-store';
import { database } from '../db/sqlite';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('purgeLegacyAuthStorage');

const LEGACY_SECURE_STORE_KEYS = [
  'supabase.auth.token',
  'sb-session',
  'supabase-session',
];

/**
 * Removes residual Supabase session data from legacy storage locations (older SecureStore keys only).
 * 
 * NOTE: We NO LONGER clear SQLite auth sessions because we're now using SQLite as our PRIMARY storage!
 * The previous behavior was deleting our migration marker, causing migrations to run on every app start.
 */
export async function purgeLegacyAuthStorage(): Promise<void> {
  try {
    // DISABLED: Do NOT clear SQLite auth sessions - we're using SQLite as our storage adapter now!
    // This was deleting the migration marker and causing infinite migration loops.
    // await database.clearAuthSessions().catch(() => {});
    
    debug.debug('Cleaning up legacy SecureStore keys only (preserving SQLite sessions)');

    // Best-effort cleanup for known SecureStore keys (limited by SecureStore API)
    const keysToDelete = [...LEGACY_SECURE_STORE_KEYS];
    const projectRefMatch = process.env.EXPO_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    if (projectRefMatch?.[1]) {
      keysToDelete.push(`sb-${projectRefMatch[1]}-auth-token`);
    }

    for (const key of keysToDelete) {
      try {
        await SecureStore.deleteItemAsync(key, { keychainService: 'overtime-securestore' });
      } catch {
        // Ignore cleanup errors; data will be overwritten on next sign-in
      }
    }
  } catch (error) {
    debug.warn('Failed to purge legacy auth storage', error);
  }
}

/**
 * Compatibility shim retained for previous API; no migration required.
 */
export async function shouldMigrateAuthStorage(): Promise<boolean> {
  return false;
}


