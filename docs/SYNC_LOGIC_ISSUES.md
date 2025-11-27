# Backend/Frontend Sync Logic Issues

## Critical Issues Found

### 1. ⚠️ **Data Loss Risk: Timestamp-Based Conflict Resolution Missing**

**Location:** `lib/state/logsStore.ts` (lines 76-97), `lib/state/shiftsStore.ts` (lines 56-76)

**Issue:**
The merge logic in `loadLogs()` and `loadShifts()` uses "remote wins for conflicts" strategy **without checking timestamps**. This can overwrite newer local changes with older remote data.

**Current Logic:**
```typescript
// Merge remote logs with local (remote wins for conflicts)
const mergedLogs = [
  ...remoteLogs,  // Remote always wins, even if older
  ...logs.filter(log => !remoteLogMap.has(log.id))
];
```

**Problem Scenario:**
1. User edits a log locally (updatedAt: 2024-01-15 10:00)
2. Remote version exists (updatedAt: 2024-01-15 09:00)
3. User calls `loadLogs()`
4. **Result:** Newer local edit gets overwritten by older remote version ❌

**Impact:** 
- User's recent local changes can be lost
- Creates poor user experience (user edits something, it gets reverted)

**Recommendation:**
Implement timestamp-based conflict resolution:
```typescript
// Compare updatedAt timestamps - newer version wins
const mergedLogs = remoteLogs.map(remoteLog => {
  const localLog = localLogMap.get(remoteLog.id);
  if (!localLog) return remoteLog;
  
  const remoteTime = new Date(remoteLog.updatedAt || remoteLog.createdAt);
  const localTime = new Date(localLog.updatedAt || localLog.createdAt);
  
  return remoteTime > localTime ? remoteLog : localLog;
});
```

### 2. ⚠️ **Inconsistent Conflict Resolution Strategy**

**Location:** 
- `lib/state/logsStore.ts` line 76: "remote wins for conflicts"
- `lib/supabase.ts` line 428: "local wins (we already uploaded local)"

**Issue:**
Two different conflict resolution strategies:
- `loadLogs()`: Remote wins (can overwrite local changes)
- `syncLogs()`: Local wins (but this function isn't used in the merge logic)

**Impact:**
- Confusing behavior for users
- Data loss risk (see issue #1)

**Recommendation:**
Use consistent timestamp-based "last-write-wins" strategy everywhere.

### 3. ⚠️ **Race Condition: Background Sync Overwrites Local Changes**

**Location:** `lib/state/logsStore.ts` (lines 56-102)

**Issue:**
When `addLog()` or `updateLog()` is called:
1. Data is saved to local SQLite (synchronous)
2. Store is updated (synchronous)
3. Background sync to Supabase starts (async, fire-and-forget)

If `loadLogs()` is called while background sync is still in progress:
- The merge might happen before the new log is synced to Supabase
- The remote logs won't include the new log
- The merge logic adds local-only logs, so this should be OK
- **BUT:** If the log was edited locally and exists remotely, the older remote version will overwrite the newer local version

**Problem Scenario:**
1. User edits log (local updatedAt: 10:00)
2. Background sync starts (async, slow network)
3. User calls `loadLogs()` (before sync completes)
4. Remote version (updatedAt: 09:00) overwrites local version (updatedAt: 10:00) ❌

**Impact:**
- Recent edits can be lost
- Frustrating for users who make quick edits

**Recommendation:**
- Check timestamps before overwriting (see issue #1)
- Add a sync lock/queue to prevent concurrent syncs
- Or wait for pending syncs to complete before merging

### 4. ⚠️ **Missing: Local Changes Not Synced on Merge**

**Location:** `lib/state/logsStore.ts` (lines 87-94)

**Issue:**
When merging remote and local logs:
- Remote logs are saved to local storage
- But local logs that were updated since last sync are NOT uploaded to Supabase

**Current Logic:**
```typescript
// Save merged logs to local storage
for (const log of mergedLogs) {
  if (remoteLogMap.has(log.id)) {
    // Update from remote
    database.updateOvertimeLog(log, userId).catch(...);
  }
  // ❌ Missing: Upload local logs that are newer than remote
}
```

**Problem:**
- If a local log was updated after the remote version was last synced, the local update won't be pushed to Supabase until the next CRUD operation
- This creates inconsistency: local has newer data, but remote doesn't

**Recommendation:**
Upload local logs that are newer than remote:
```typescript
for (const log of mergedLogs) {
  if (remoteLogMap.has(log.id)) {
    const localLog = localLogMap.get(log.id);
    const remoteTime = new Date(log.updatedAt);
    const localTime = new Date(localLog.updatedAt);
    
    if (localTime > remoteTime) {
      // Local is newer - upload it
      logsSync.uploadLog(localLog, userId).catch(...);
    } else {
      // Remote is newer - save it locally
      database.updateOvertimeLog(log, userId).catch(...);
    }
  }
}
```

### 5. ⚠️ **Error Handling: Sync Failures Are Silent**

**Location:** Throughout `lib/state/logsStore.ts` and `lib/state/shiftsStore.ts`

**Issue:**
All sync operations are fire-and-forget with `.catch()` that only logs errors:
```typescript
logsSync.uploadLog(log, finalUserId).catch(err => {
  console.error('[logsStore.addLog] Background sync failed (non-fatal):', err);
});
```

**Problems:**
- No retry mechanism - if sync fails, it's lost forever (until next CRUD operation)
- No user notification - users don't know their data didn't sync
- No offline queue - if offline, changes won't sync when coming back online
- No sync status tracking

**Impact:**
- Data inconsistency between devices
- Users don't know if their data is synced
- Lost changes if app closes before sync completes

**Recommendation:**
- Implement a sync queue that persists pending operations
- Retry failed syncs with exponential backoff
- Show sync status indicator to users
- Queue sync operations when offline

### 6. ⚠️ **Profile Sync: Potential Data Loss**

**Location:** `lib/state/profileStore.ts` (lines 29-90)

**Issue:**
Profile sync downloads from Supabase first, then falls back to local. If Supabase has a newer profile but the download fails, it falls back to local (which might be older).

**Current Logic:**
```typescript
// Try loading from Supabase first (if authenticated)
if (userId) {
  try {
    const supabaseProfile = await profileSync.downloadProfile(userId);
    if (supabaseProfile) {
      profile = supabaseProfile;  // Supabase wins
    }
  } catch (syncError) {
    // Falls back to local - but local might be older
  }
}
```

**Problem:**
- If Supabase has newer profile but download fails, local (older) profile is used
- No timestamp comparison to ensure we're using the newest version

**Recommendation:**
- Compare timestamps between Supabase and local profiles
- Use the newer version regardless of source

### 7. ⚠️ **Missing: Full Sync Not Implemented**

**Location:** `lib/supabase.ts` (lines 838-875)

**Issue:**
The `sync.fullSync()` function is a TODO stub:
```typescript
async fullSync(): Promise<{...}> {
  // TODO: Implement full sync
  console.log('TODO: Implement full sync');
  return { success: true, ... };
}
```

**Impact:**
- No way to manually trigger a full sync
- No way to recover from sync issues
- Users can't force sync their data

**Recommendation:**
Implement full sync that:
- Uploads all local data
- Downloads all remote data
- Resolves conflicts using timestamp comparison
- Returns detailed sync results

### 8. ⚠️ **Missing: Connection Check Not Implemented**

**Location:** `lib/supabase.ts` (lines 877-890)

**Issue:**
The `sync.checkConnection()` function is a TODO stub:
```typescript
async checkConnection(): Promise<boolean> {
  // TODO: Implement connection check
  console.log('TODO: Check Supabase connection');
  return true;  // Always returns true!
}
```

**Impact:**
- No way to detect if Supabase is available
- Sync attempts happen even when offline
- Wasted network requests
- No offline mode detection

**Recommendation:**
Implement connection check:
```typescript
async checkConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}
```

## Medium Priority Issues

### 9. **Export Batches: Same Merge Issues**
Export batches have the same "remote wins" merge logic without timestamp checking.

### 10. **No Incremental Sync**
All sync operations download all data, not just changes since last sync. This is inefficient but functional.

## Summary

**Critical Issues:**
1. ⚠️ Data loss risk from timestamp-based conflict resolution missing
2. ⚠️ Inconsistent conflict resolution strategies
3. ⚠️ Race conditions in background sync
4. ⚠️ Local changes not synced during merge
5. ⚠️ Silent sync failures with no retry
6. ⚠️ Profile sync potential data loss
7. ⚠️ Full sync not implemented
8. ⚠️ Connection check not implemented

**Recommendations:**
1. Implement timestamp-based conflict resolution everywhere
2. Add sync queue for offline scenarios
3. Add retry mechanism for failed syncs
4. Show sync status to users
5. Implement full sync and connection check
6. Upload local changes that are newer than remote during merge








