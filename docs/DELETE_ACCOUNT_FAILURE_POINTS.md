# Delete Account Function - Failure Points Analysis

## Overview

This document identifies potential failure points in the delete account flow and provides recommendations for improvements.

## Current Flow

1. **Soft Delete Phase** (Client-side):
   - Sets `account_deleted_at` on profiles
   - Sets `deleted_at` on overtime_logs, shifts, export_batches
   - Calls hard delete edge function (with 8s timeout, 2 retries)

2. **Hard Delete Phase** (Edge Function):
   - Deletes table rows (attachments, export_batches, overtime_logs, shifts, profiles)
   - Deletes storage files (exports, attachments buckets)
   - Deletes auth user

## Identified Failure Points

### 🔴 Critical Issues

#### 1. **Storage Path Construction Issue**
**Location**: `supabase/functions/delete-account/index.ts:47`

**Problem**: 
```typescript
const paths = data.map((entry) => `${prefix}/${entry.name}`);
```

If `entry.name` contains a path separator or if there are nested folders, this could create incorrect paths. The `list()` function might return entries with paths already included.

**Risk**: Files might not be deleted, leaving orphaned storage files.

**Fix**: Verify path construction handles nested folders correctly:
```typescript
// If entry.name already includes path, use it directly
// Otherwise, construct path
const path = entry.name.includes('/') 
  ? `${prefix}/${entry.name}` 
  : `${prefix}/${entry.name}`;
// Actually, need to check Supabase storage API behavior
```

#### 2. **No Edge Function Timeout**
**Location**: `supabase/functions/delete-account/index.ts`

**Problem**: The edge function has no built-in timeout. Supabase edge functions have a default timeout (usually 60s for Hobby, 300s for Pro), but if the deletion takes longer, it will fail.

**Risk**: Large accounts with many files could exceed the timeout, leaving partial deletions.

**Fix**: 
- Add progress logging
- Consider batching large operations
- Add timeout handling within the function

#### 3. **Client-Side Timeout Too Short**
**Location**: `lib/state/authStore.ts:1312`

**Problem**: 8-second timeout might be too short for accounts with many files or slow network.

**Risk**: Timeout occurs before deletion completes, leaving data in backend.

**Fix**: Increase timeout or make it configurable based on account size.

#### 4. **Storage Deletion Failure Stops Everything**
**Location**: `supabase/functions/delete-account/index.ts:117-124`

**Problem**: If storage deletion fails, the entire function fails, but tables might already be deleted.

**Risk**: Orphaned storage files remain after table data is deleted.

**Fix**: Make storage deletion best-effort, log failures but continue.

#### 5. **Auth User Deletion Happens Last**
**Location**: `supabase/functions/delete-account/index.ts:126`

**Problem**: If auth user deletion fails, all data is deleted but auth user remains. Foreign key cascades won't help because we're deleting manually.

**Risk**: Orphaned auth user with no associated data.

**Fix**: This is actually correct - we want to delete data first, then auth user. But we should ensure auth user deletion succeeds.

### 🟡 Medium Priority Issues

#### 6. **No Transaction/Rollback**
**Location**: Entire edge function

**Problem**: If deletion fails partway through, there's no rollback. Some data might be deleted while other data remains.

**Risk**: Inconsistent state - partial deletions.

**Fix**: Consider using database transactions where possible (though storage operations can't be transactional).

#### 7. **Limited Retry Logic**
**Location**: `lib/state/authStore.ts:1317-1325`

**Problem**: Only 2 retry attempts with 300ms delay. If network is flaky, this might not be enough.

**Risk**: Transient failures cause permanent deletion failures.

**Fix**: Increase retries or use exponential backoff.

#### 8. **Storage List Pagination Edge Case**
**Location**: `supabase/functions/delete-account/index.ts:29-58`

**Problem**: The pagination logic assumes `data.length < limit` means we're done, but if exactly `limit` items are returned on the last page, we might miss the exit condition. Actually, this looks correct - if `data.length < limit`, we're done. If `data.length === limit`, we continue.

**Risk**: Low - logic appears correct, but worth verifying.

#### 9. **Error Handling in Soft Delete Phase**
**Location**: `lib/state/authStore.ts:1288-1301`

**Problem**: Soft delete failures are caught and logged but don't stop the process. If soft delete fails, hard delete might still proceed, but data won't be marked as deleted.

**Risk**: Data deleted but not marked, making recovery harder.

**Fix**: This is actually acceptable - soft delete is best-effort, hard delete will remove data anyway.

### 🟢 Low Priority / Edge Cases

#### 10. **Concurrent Deletion Attempts**
**Problem**: If user triggers deletion multiple times, multiple edge function calls could run concurrently.

**Risk**: Race conditions, duplicate work, potential errors.

**Fix**: Add idempotency check - if `account_deleted_at` is already set, skip or return early.

#### 11. **Missing Error Details**
**Location**: `supabase/functions/delete-account/index.ts:137-141`

**Problem**: Error messages might not include enough context for debugging.

**Risk**: Hard to diagnose failures in production.

**Fix**: Add more detailed logging with userId, step information.

## Recommended Fixes

### Priority 1: Critical Fixes

1. **Fix storage path construction** - Verify and test with nested folders
2. **Increase client timeout** - Make it configurable (e.g., 30-60 seconds)
3. **Make storage deletion best-effort** - Don't fail entire operation if storage fails
4. **Add idempotency check** - Skip if already deleted

### Priority 2: Improvements

1. **Add better logging** - Include userId, step, file counts in logs
2. **Improve retry logic** - Exponential backoff, more retries
3. **Add progress tracking** - Log progress for long-running deletions

### Priority 3: Nice to Have

1. **Add cleanup job** - Periodically clean up accounts where hard delete failed
2. **Add monitoring** - Track deletion success/failure rates
3. **Add user notification** - Notify user if deletion partially failed

## Implementation Plan

### Fix 1: Improve Storage Deletion (Critical)

```typescript
// In delete-account/index.ts
async function deleteStoragePrefix(client: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  const limit = 100;
  let page = 0;
  let totalDeleted = 0;
  let errors: string[] = [];

  while (true) {
    try {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit,
        offset: page * limit,
      });

      if (error) {
        if (error.message?.toLowerCase().includes('folder not found')) {
          console.log(`[delete-account] Bucket ${bucket}/${prefix} not found (already empty)`);
          break;
        }
        // Log but don't throw - best effort
        console.error(`[delete-account] Failed to list ${bucket}/${prefix}:`, error);
        errors.push(`List error: ${error.message}`);
        break; // Can't continue if we can't list
      }

      if (!data || data.length === 0) {
        break;
      }

      // Construct paths - handle both flat and nested structures
      const paths = data.map((entry) => {
        // If entry has a full path, use it; otherwise construct
        return entry.name.startsWith(prefix) 
          ? entry.name 
          : `${prefix}/${entry.name}`;
      });

      const { error: removeError } = await client.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[delete-account] Failed to delete batch from ${bucket}/${prefix}:`, removeError);
        errors.push(`Delete error: ${removeError.message}`);
        // Continue anyway - might be partial success
      } else {
        totalDeleted += paths.length;
        console.log(`[delete-account] Deleted ${paths.length} files from ${bucket}/${prefix} (total: ${totalDeleted})`);
      }

      if (data.length < limit) {
        break;
      }

      page += 1;
    } catch (error) {
      console.error(`[delete-account] Unexpected error in storage deletion:`, error);
      errors.push(`Unexpected error: ${error.message}`);
      break;
    }
  }

  if (errors.length > 0) {
    console.warn(`[delete-account] Storage deletion completed with ${errors.length} errors for ${bucket}/${prefix}`);
  } else {
    console.log(`[delete-account] Successfully deleted ${totalDeleted} files from ${bucket}/${prefix}`);
  }
  
  // Don't throw - best effort deletion
}
```

### Fix 2: Add Idempotency Check

```typescript
// In delete-account/index.ts, after getting userId
const { data: profile } = await adminClient
  .from('profiles')
  .select('account_deleted_at')
  .eq('user_id', userId)
  .single();

if (profile?.account_deleted_at) {
  console.log('[delete-account] Account already marked for deletion, proceeding with hard delete');
  // Continue - might be a retry
}
```

### Fix 3: Increase Client Timeout

```typescript
// In lib/state/authStore.ts
const invokeWithTimeout = async (ms: number) => {
  return await Promise.race([
    functionsClient.invoke('delete-account', { body: { reason: 'user_initiated' } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Delete account timeout')), ms)),
  ]) as any;
};

// Increase from 8000 to 60000 (60 seconds)
let hardDeleteError = null;
for (let attempt = 1; attempt <= 3; attempt++) { // Increase retries
  const timeout = attempt === 1 ? 60000 : 30000; // Longer timeout on first attempt
  const result = await invokeWithTimeout(timeout).catch(err => ({ error: err }));
  // ... rest of logic
}
```

### Fix 4: Better Error Handling

```typescript
// In delete-account/index.ts
try {
  // ... deletion logic
} catch (error) {
  console.error('[delete-account] Error processing request', {
    userId,
    error: error?.message,
    stack: error?.stack,
    step: 'unknown', // Add step tracking
  });
  return new Response(JSON.stringify({ 
    error: error?.message ?? 'server_error',
    userId, // Include for debugging (sanitized in production)
  }), {
    status: 500,
    headers: JSON_HEADERS,
  });
}
```

## Testing Recommendations

1. **Test with large accounts**: Account with 1000+ files, 10000+ rows
2. **Test with nested storage**: Files in subdirectories
3. **Test network failures**: Simulate timeouts, network errors
4. **Test concurrent deletions**: Multiple deletion attempts
5. **Test partial failures**: Storage fails but tables succeed
6. **Test edge cases**: Empty accounts, accounts with only storage, accounts with only tables

## Monitoring

Add metrics to track:
- Deletion success rate
- Average deletion time
- Storage deletion failures
- Auth user deletion failures
- Timeout occurrences

