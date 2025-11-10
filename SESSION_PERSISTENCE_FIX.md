# Session Persistence Fix

## Problem Summary

Users had to log in every time they restarted the app, even though sessions were being saved successfully to the database. The app was not recognizing that the user had previously logged in on the device.

## Root Cause

The issue was a **race condition** during app startup:

1. When the app started, the Supabase client was created and immediately tried to restore the session from SQLite storage
2. However, the SQLite database initialization happened in `app/_layout.tsx` which ran **after** the Supabase client creation
3. The `SQLiteStorageAdapter.getItem()` checked if the database was initialized and returned `null` if it wasn't
4. By the time the database was fully initialized, Supabase had already given up on session restoration
5. Result: The session couldn't be retrieved on app restart, forcing the user to log in again

### Evidence from Logs

```
 691| LOG  [SQLiteStorageAdapter] Getting item: sb-ethllesuiqlomdtct...
 692| LOG  [SQLiteStorageAdapter] Database not initialized yet, returning null
 ...
 701| LOG  Database initialized successfully
 ...
 715| LOG  [onboardingStore.checkOnboardingStatus] Checking status
 717| LOG  [onboardingStore.checkOnboardingStatus] Onboarding not completed
 720| LOG  [app/index] No user - navigating to welcome
```

## Solution

Modified `SQLiteStorageAdapter` to **wait for database initialization** instead of immediately returning `null`:

### Changes Made

#### 1. Added `waitForDatabase()` Helper Function

```typescript
// Helper to wait for database initialization
async function waitForDatabase(maxWaitMs: number = 5000): Promise<boolean> {
  const startTime = Date.now();
  while (!database['db']) {
    if (Date.now() - startTime > maxWaitMs) {
      debug('Timeout waiting for database initialization');
      return false;
    }
    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return true;
}
```

This function:
- Polls the database to check if it's initialized
- Waits up to 5 seconds (configurable) for initialization
- Returns `true` if database is ready, `false` on timeout

#### 2. Updated `getItem()` Method

**Before:**
```typescript
// Check if database is initialized - return null if not
try {
  row = await database.getAuthSession(key);
} catch (dbError: any) {
  if (dbError?.message?.includes('not initialized')) {
    debug('Database not initialized yet, returning null');
    return null;  // ❌ Gives up immediately
  }
  throw dbError;
}
```

**After:**
```typescript
// Wait for database to be initialized (with timeout)
// This is critical for session restoration on app start
const dbReady = await waitForDatabase();
if (!dbReady) {
  debug('Database not ready after timeout, returning null');
  return null;
}

// Get from database
let row;
try {
  row = await database.getAuthSession(key);
} catch (dbError: any) {
  if (dbError?.message?.includes('not initialized')) {
    debug('Database not initialized (unexpected), returning null');
    return null;
  }
  throw dbError;
}
```

#### 3. Updated `setItem()` Method

Applied the same wait logic to `setItem()` for consistency:

```typescript
// Wait for database to be initialized (with timeout)
const dbReady = await waitForDatabase();
if (!dbReady) {
  debug('Database not ready after timeout, cannot store value');
  return;
}
```

## How It Works Now

1. **App starts** → `app/_layout.tsx` begins initialization
2. **Supabase client is created** (lazy, on first access)
3. **Supabase tries to restore session** → calls `SQLiteStorageAdapter.getItem()`
4. **Storage adapter waits** for database initialization (up to 5 seconds)
5. **Database finishes initialization** in `app/_layout.tsx`
6. **Session is retrieved** from SQLite successfully
7. **User is logged in automatically** without needing to re-enter credentials

## Benefits

- ✅ **Session persistence works reliably** across app restarts
- ✅ **Users stay logged in** on the same device
- ✅ **No breaking changes** to existing code
- ✅ **Graceful timeout** if database fails to initialize (falls back to requiring login)
- ✅ **Consistent behavior** for both reading and writing sessions

## Testing

To verify the fix works:

1. **Log in to the app** with valid credentials
2. **Close the app completely** (force quit)
3. **Reopen the app**
4. **Expected result:** You should be automatically logged in without seeing the login screen

## Technical Details

### Why This Approach?

- **Non-breaking:** Doesn't require changes to app initialization order
- **Robust:** Handles both fast and slow database initialization
- **Safe:** Has a timeout to prevent infinite waiting
- **Minimal:** Only changes the storage adapter, not the entire auth flow

### Alternative Approaches Considered

1. **Initialize database before creating Supabase client**
   - Problem: Would require restructuring app initialization and module loading order
   - Rejected: Too invasive, harder to maintain

2. **Use async Proxy for Supabase client**
   - Problem: Changes the entire Supabase client API to async
   - Rejected: Would break all existing code that uses the Supabase client

3. **Queue session restoration for later**
   - Problem: Would require changes to Supabase SDK behavior
   - Rejected: Not feasible without forking the SDK

### Performance Impact

- **Minimal:** The wait loop checks every 50ms and times out after 5 seconds
- **First launch:** Database initializes in < 100ms typically, so very little waiting
- **Subsequent launches:** Session is restored immediately once database is ready
- **No blocking:** Uses async/await, doesn't block the UI thread

## Files Modified

1. `/lib/auth/sqliteStorageAdapter.ts`
   - Added `waitForDatabase()` helper function
   - Updated `getItem()` to wait for database
   - Updated `setItem()` to wait for database

## Related Issues

- Session storage was working (confirmed by successful login)
- Session retrieval was failing on app restart
- Database initialization timing was the bottleneck

## Verification Logs to Look For

After the fix, you should see logs like:

```
LOG [SQLiteStorageAdapter] Getting item: sb-ethllesuiqlomdtct...
LOG [supabase] Database already initialized
LOG [SQLiteStorageAdapter] Decrypted and base64 decoded value, length: 2234
LOG [SQLiteStorageAdapter] Decompressed value, original length: 847, decompressed length: 2234
LOG [authStore.checkSession] getSession attempt 1: {"hasSession": true, "hasUser": true}
LOG [app/index] User found - has session
```

Instead of:

```
LOG [SQLiteStorageAdapter] Database not initialized yet, returning null
LOG [authStore.checkSession] getSession attempt 1: {"hasSession": false, "hasUser": false}
LOG [app/index] No user - navigating to welcome
```
