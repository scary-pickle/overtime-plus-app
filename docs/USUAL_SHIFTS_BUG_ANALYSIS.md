# Usual Shifts Table Name Bug Analysis

## The Issue

In `lib/state/authStore.ts:843`, the delete-account function attempts to soft-delete from a table called `'usual_shifts'`:

```typescript
const tables = ['overtime_logs', 'usual_shifts', 'export_batches'] as const;
for (const table of tables) {
  try {
    await (supabase as any).from(table).update({ deleted_at: now }).eq('user_id', userId);
  } catch (error) {
    debug.error(`[deleteAccount] Failed to flag ${table} rows for deletion`, error);
  }
}
```

**Problem:** `usual_shifts` is a **local SQLite table only** - it doesn't exist in Supabase. The Supabase table is called `'shifts'`.

## Architecture Context

### Local Storage (SQLite)
- `usual_shifts` table stores shift patterns locally on the device
- Used for offline access and quick local queries

### Cloud Storage (Supabase)
- `shifts` table stores shift patterns in Supabase
- UsualShift patterns are stored with:
  - `notes = 'usual_shift_pattern'` (marker to identify them)
  - Full `UsualShift` object stored in `extras` JSONB column
  - Regular shifts (actual shift instances) also use this table

### Sync Pattern
When syncing to Supabase:
- `shiftsSync.uploadShift()` stores UsualShift patterns in the `shifts` table
- `shiftsSync.downloadShifts()` retrieves from `shifts` table filtering by `notes = 'usual_shift_pattern'`
- `shiftsSync.deleteShift()` deletes from the `shifts` table

## Impact Analysis

### What Happens Currently

1. **Soft-delete attempt fails silently:**
   - The code tries: `supabase.from('usual_shifts').update(...)`
   - Supabase returns an error (table doesn't exist)
   - Error is caught and logged: `"Failed to flag usual_shifts rows for deletion"`
   - Execution continues (non-blocking)

2. **Hard delete still works:**
   - The `delete-account` Supabase function correctly uses `'shifts'` table
   - All shift data (including UsualShift patterns) gets deleted
   - Final result: Data is still deleted, just not soft-deleted first

### What Should Happen

1. **Soft-delete should mark `shifts` table rows:**
   - Set `deleted_at` timestamp on all user's shifts
   - This includes both regular shifts AND UsualShift patterns
   - Provides audit trail before hard delete

2. **Hard delete then removes everything:**
   - The delete-account function deletes from `shifts` table
   - All data is permanently removed

## Is It Worth Fixing?

### ✅ **YES - Worth Fixing** (Low effort, improves correctness)

**Reasons:**

1. **Trivial fix:** One word change (`'usual_shifts'` → `'shifts'`)

2. **Improves soft-delete behavior:**
   - Currently, shift patterns aren't soft-deleted before hard delete
   - Fix ensures all data types are consistently soft-deleted first
   - Provides better audit trail if hard delete fails or is delayed

3. **Eliminates error noise:**
   - Removes unnecessary error log: `"Failed to flag usual_shifts rows for deletion"`
   - Cleaner logs make debugging easier

4. **Consistency:**
   - Matches the pattern used elsewhere in codebase (`shiftsSync` uses `'shifts'`)
   - Aligns with the delete-account function which correctly uses `'shifts'`

5. **No risk:**
   - Change is safe (just fixing a table name)
   - Doesn't affect functionality (hard delete already works)
   - Only improves behavior

### Potential Concerns (None Significant)

1. **"But it already works"** - True, but soft-delete step is incomplete
2. **"It's just a soft-delete"** - True, but consistency matters and it's a 1-word fix
3. **"What if there are other shifts?"** - The soft-delete will mark ALL shifts (both regular and patterns), which is correct behavior

## Recommended Fix

```typescript
// lib/state/authStore.ts:843
// BEFORE:
const tables = ['overtime_logs', 'usual_shifts', 'export_batches'] as const;

// AFTER:
const tables = ['overtime_logs', 'shifts', 'export_batches'] as const;
```

**Note:** This will soft-delete ALL shifts (both regular shifts and UsualShift patterns), which is the correct behavior since they're all in the same `shifts` table.

## Verification

After fix, verify:
1. Soft-delete step completes without errors
2. Shift patterns are marked with `deleted_at` before hard delete
3. Hard delete still removes everything correctly
4. No error logs about `usual_shifts` table

## Conclusion

**Fix it.** It's a 1-word change that:
- Fixes incomplete soft-delete behavior
- Eliminates error logs
- Maintains consistency
- Has zero risk
- Improves correctness

The fact that hard delete works doesn't mean we should ignore the soft-delete step - both should work correctly.

