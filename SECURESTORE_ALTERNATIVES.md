# Alternative Storage Options for Supabase Auth Session Data

## Problem

Supabase auth session data exceeds SecureStore's 2048 byte limit, even after compression. This can cause:
- Session loss on app restart
- Silent storage failures
- Future SDK version may throw errors

## Current Situation

- **Current solution**: Compression with `lz-string` (✅ **IMPLEMENTED**)
- **Issue**: Some session data still exceeds 2048 bytes even after compression
- **Root cause**: JWTs, refresh tokens, and user metadata can grow large

## Alternative Options

### Option 1: SQLite with Encryption (Recommended for Large Data)

**Description**: Store Supabase session data in SQLite database with encryption, similar to how other app data is stored.

**Implementation**:
```typescript
// Create a new table in lib/db/sqlite.ts
CREATE TABLE IF NOT EXISTS auth_sessions (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  encrypted INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

// Use SQLiteAdapter instead of SecureStoreAdapter
import { database } from './db/sqlite';
import * as Crypto from 'expo-crypto';

export const SQLiteStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const row = await database.getFirstAsync(
        'SELECT value FROM auth_sessions WHERE key = ?',
        [key]
      );
      if (!row) return null;
      return (row as any).value;
    } catch (error) {
      console.warn('SQLiteStorageAdapter.getItem failed', { key, error });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await database.runAsync(
        `INSERT OR REPLACE INTO auth_sessions (key, value, updated_at) 
         VALUES (?, ?, ?)`,
        [key, value, new Date().toISOString()]
      );
    } catch (error) {
      console.warn('SQLiteStorageAdapter.setItem failed', { key, error });
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await database.runAsync('DELETE FROM auth_sessions WHERE key = ?', [key]);
    } catch (error) {
      console.warn('SQLiteStorageAdapter.removeItem failed', { key, error });
    }
  },
};
```

**Pros**:
- ✅ No size limit (SQLite can handle large values)
- ✅ Already using SQLite in the app
- ✅ Can store compressed data
- ✅ Better for large session objects
- ✅ Can add encryption if needed (using `expo-crypto`)

**Cons**:
- ⚠️ Less secure than SecureStore (requires manual encryption)
- ⚠️ More complex setup
- ⚠️ Need to handle encryption/decryption manually
- ⚠️ Requires database migration

**Security Note**: For sensitive auth data, you should add encryption:
```typescript
import * as Crypto from 'expo-crypto';

// Generate/retrieve encryption key (store securely)
async function getEncryptionKey(): Promise<string> {
  // Use SecureStore to store the encryption key itself
  let key = await SecureStore.getItemAsync('auth_encryption_key');
  if (!key) {
    key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`
    );
    await SecureStore.setItemAsync('auth_encryption_key', key);
  }
  return key;
}
```

---

### Option 2: Hybrid Approach (Tokens in SecureStore, Metadata in SQLite)

**Description**: Split storage - keep tokens in SecureStore (small, secure), store session metadata in SQLite.

**Implementation**:
```typescript
export const HybridStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    // Check if it's a token (small) or metadata (large)
    if (key.includes('access_token') || key.includes('refresh_token')) {
      // Small tokens go to SecureStore
      return await SecureStore.getItemAsync(key);
    } else {
      // Large metadata goes to SQLite
      const row = await database.getFirstAsync(
        'SELECT value FROM auth_sessions WHERE key = ?',
        [key]
      );
      return row ? (row as any).value : null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const sizeInBytes = new TextEncoder().encode(value).length;
    
    if (key.includes('access_token') || key.includes('refresh_token')) {
      // Small tokens in SecureStore
      await SecureStore.setItemAsync(key, value);
    } else if (sizeInBytes > 2048) {
      // Large data in SQLite
      await database.runAsync(
        `INSERT OR REPLACE INTO auth_sessions (key, value, updated_at) 
         VALUES (?, ?, ?)`,
        [key, value, new Date().toISOString()]
      );
    } else {
      // Small data in SecureStore
      await SecureStore.setItemAsync(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
    try {
      await database.runAsync('DELETE FROM auth_sessions WHERE key = ?', [key]);
    } catch {}
  },
};
```

**Pros**:
- ✅ Best of both worlds - security for tokens, flexibility for metadata
- ✅ Tokens stay in hardware-backed secure storage
- ✅ No size limit for large session data
- ✅ Gradual migration possible

**Cons**:
- ⚠️ Breaks Supabase's expected storage format (single key-value store)
- ⚠️ More complex logic
- ⚠️ Requires custom session reconstruction

**Note**: This approach breaks Supabase's storage API contract, which expects a single storage location. You'd need to reconstruct the session object from multiple sources.

---

### Option 3: Reduce Session Data Size

**Description**: Minimize what's stored in the Supabase session by cleaning user metadata.

**Implementation**:
```typescript
// After Supabase auth operations, clean the session
import { supabase } from './supabase';

async function cleanUserMetadata() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user && user.user_metadata) {
    // Only keep essential metadata
    const minimalMetadata = {
      onboarding_complete: user.user_metadata.onboarding_complete || false,
      // Remove other large metadata fields
    };
    
    await supabase.auth.updateUser({
      data: minimalMetadata
    });
  }
}
```

**Pros**:
- ✅ Simple
- ✅ No storage changes needed
- ✅ Reduces session size at source

**Cons**:
- ⚠️ May lose useful metadata
- ⚠️ Requires refactoring if metadata is used elsewhere
- ⚠️ May not solve the problem if tokens are large

---

### Option 4: Use AsyncStorage with Encryption (Not Recommended for Production)

**Description**: Use `@react-native-async-storage/async-storage` with manual encryption.

**Implementation**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export const EncryptedAsyncStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return null;
      // Decrypt using stored key
      const encryptionKey = await SecureStore.getItemAsync('storage_encryption_key');
      // ... implement decryption
      return decrypted;
    } catch (error) {
      return null;
    }
  },
  // ... similar for setItem/removeItem
};
```

**Pros**:
- ✅ No size limit
- ✅ Already available (used in widget code)

**Cons**:
- ❌ **Less secure** than SecureStore (not hardware-backed)
- ❌ Requires manual encryption implementation
- ❌ Not recommended for production auth tokens
- ❌ More complex than SQLite approach

---

### Option 5: Chunked Storage (Split Large Values)

**Description**: Split large values across multiple SecureStore keys.

**Implementation**:
```typescript
const CHUNK_SIZE = 2000; // Leave room for chunk marker
const MAX_CHUNKS = 10; // Prevent infinite splitting

export const ChunkedStorageAdapter = {
  async setItem(key: string, value: string): Promise<void> {
    const sizeInBytes = new TextEncoder().encode(value).length;
    
    if (sizeInBytes <= 2048) {
      // Small enough for single SecureStore entry
      await SecureStore.setItemAsync(key, value);
      return;
    }
    
    // Split into chunks
    const chunks: string[] = [];
    let remaining = value;
    
    while (remaining.length > 0 && chunks.length < MAX_CHUNKS) {
      chunks.push(remaining.substring(0, CHUNK_SIZE));
      remaining = remaining.substring(CHUNK_SIZE);
    }
    
    // Store chunk count
    await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
  },

  async getItem(key: string): Promise<string | null> {
    // Check if it's chunked
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    
    if (!chunkCount) {
      // Not chunked, return directly
      return await SecureStore.getItemAsync(key);
    }
    
    // Reconstruct from chunks
    const chunks: string[] = [];
    for (let i = 0; i < parseInt(chunkCount); i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!chunk) return null; // Missing chunk
      chunks.push(chunk);
    }
    
    return chunks.join('');
  },

  async removeItem(key: string): Promise<void> {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    
    if (chunkCount) {
      // Remove all chunks
      for (let i = 0; i < parseInt(chunkCount); i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    
    await SecureStore.deleteItemAsync(key);
  },
};
```

**Pros**:
- ✅ Stays within SecureStore limits
- ✅ Uses existing SecureStore infrastructure
- ✅ No database changes needed

**Cons**:
- ⚠️ Multiple SecureStore operations (slower)
- ⚠️ More complex logic
- ⚠️ Still limited by SecureStore's overall limits
- ⚠️ Risk of partial writes (some chunks succeed, others fail)

---

## Recommendation

### **Option 1: SQLite with Encryption** (Best for Production)

This is the best long-term solution because:
1. ✅ No size limits
2. ✅ Already using SQLite in the app
3. ✅ Can add encryption for security
4. ✅ Maintains Supabase's storage API contract
5. ✅ Handles large session data gracefully

### **Option 5: Chunked Storage** (Quick Fix)

If you need a quick fix without database changes:
- ✅ Stays in SecureStore
- ✅ Works with existing code
- ⚠️ More complex but no migration needed

## Migration Path

If choosing Option 1 (SQLite):

1. **Add migration** to create `auth_sessions` table
2. **Create SQLiteStorageAdapter** with encryption
3. **Update `lib/supabase.ts`** to use new adapter
4. **Test thoroughly** - ensure session persistence works
5. **Add migration script** to move existing SecureStore data to SQLite

## Testing Checklist

After implementing any solution:
- [ ] Sign in and verify session persists
- [ ] Close and reopen app - session should persist
- [ ] Leave app open for 30+ minutes (token refresh)
- [ ] Check for storage warnings in console
- [ ] Test on both iOS and Android
- [ ] Verify session data is correctly stored/retrieved
- [ ] Test with large user metadata
- [ ] Test error handling (corrupted data, missing keys)

## References

- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Supabase Auth Storage](https://supabase.com/docs/reference/javascript/auth-getsession)
- [React Native Secure Storage Guide](https://medium.com/@talsec/safeguarding-your-data-in-react-native-secure-storage-solutions-97fce1db97e0)







