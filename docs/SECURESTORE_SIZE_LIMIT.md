# SecureStore Size Limit Warning

## Problem

The app is showing a warning:
```
WARN  Value being stored in SecureStore is larger than 2048 bytes and it may not be stored successfully.
```

This warning occurs when the app has been sitting open in the simulator for a while.

## Root Cause

**Supabase auth session data** is stored in SecureStore via `SecureStoreAdapter`. Supabase stores the entire session object as JSON, which includes:
- Access token (JWT) - typically ~500-1000 bytes
- Refresh token - typically ~200-500 bytes  
- User metadata - can grow over time (we store onboarding status here)
- Session metadata - additional session info

When combined and JSON-stringified, this can easily exceed SecureStore's 2048 byte limit, especially after:
- Token refreshes (new tokens added)
- User metadata accumulation
- Long-running sessions

## Impact

### Current Behavior
- **Warning only**: The app still functions, but the warning indicates potential storage issues
- **May fail silently**: If the value exceeds the limit, SecureStore may not store it, causing:
  - Session loss on app restart
  - User needing to sign in again
  - Potential data sync issues

### Future SDK Behavior
According to the warning, "In a future SDK version, this call may throw an error" - meaning the app will crash if this isn't addressed.

## Solutions

### Option 1: Compress Session Data (Recommended)
Compress the session JSON before storing it:

```typescript
// In SecureStoreAdapter.setItem
import { compress, decompress } from 'lz-string';

async setItem(key: string, value: string): Promise<void> {
  try {
    // Compress if it's a Supabase session (contains large JSON)
    if (key.includes('supabase') || key.includes('session')) {
      const compressed = compress(value);
      await SecureStore.setItemAsync(key, compressed, {
        keychainService: 'overtime-securestore',
      });
    } else {
      await SecureStore.setItemAsync(key, value, {
        keychainService: 'overtime-securestore',
      });
    }
  } catch (error) {
    console.warn('SecureStoreAdapter.setItem failed', { key, error });
  }
}

async getItem(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key, {
      keychainService: 'overtime-securestore',
    });
    if (!value) return null;
    
    // Decompress if it's compressed
    if (key.includes('supabase') || key.includes('session')) {
      return decompress(value);
    }
    return value;
  } catch (error) {
    console.warn('SecureStoreAdapter.getItem failed', { key, error });
    return null;
  }
}
```

**Pros**: Simple, reduces size by 50-70%
**Cons**: Requires `lz-string` package, slight performance overhead

### Option 2: Store Session in SQLite (Alternative)
Instead of SecureStore, store Supabase sessions in SQLite with encryption:

**Pros**: No size limit, better for large data
**Cons**: More complex, requires encryption setup

### Option 3: Minimize User Metadata
Only store essential data in Supabase user metadata:

```typescript
// Instead of storing all onboarding status in metadata,
// only store a minimal flag
await supabase.auth.updateUser({
  data: { onboarding: true } // Minimal, not full object
});
```

**Pros**: Reduces session size
**Cons**: Less flexible, may need to refactor

### Option 4: Split Session Storage
Store tokens separately from metadata:

**Pros**: Prevents size issues
**Cons**: Complex, breaks Supabase's expected storage format

## Recommendation

**Use Option 1 (Compression)** - ✅ **IMPLEMENTED** - It's the simplest solution that:
- Fixes the immediate issue
- Maintains compatibility with Supabase
- Reduces storage size by 50-70%
- Only adds a small dependency (`lz-string`)

## Implementation Status

✅ **COMPLETED** - Compression has been implemented in `lib/auth/storageAdapter.ts`:
- Automatically compresses Supabase session data when it exceeds 1500 bytes
- Decompresses data when reading (backward compatible with uncompressed data)
- Uses `lz-string` for compression (typically 50-70% size reduction)
- Includes a marker prefix (`__COMPRESSED__`) to identify compressed data
- Handles errors gracefully - falls back to uncompressed storage if compression fails

## Testing

After implementing a fix:
1. Sign in to the app
2. Leave it open for 30+ minutes (allows token refresh)
3. Check console for warnings
4. Close and reopen app - verify session persists
5. Check SecureStore size - should be < 2048 bytes

## References

- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Supabase Auth Storage](https://supabase.com/docs/reference/javascript/auth-getsession)
- [lz-string Compression](https://github.com/pieroxy/lz-string)

