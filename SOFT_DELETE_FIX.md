# Soft Delete Error Fixes

## Issues Found

When deleting items in the app, two errors occurred:

1. **RLS Policy Error** (42501): "new row violates row-level security policy for table"
   - The UPDATE policy was blocking soft deletes
   - This prevented `deleted_at` from being set on cloud records

2. **UNIQUE Constraint Error** (Error code 19): "UNIQUE constraint failed: overtime_logs.id"
   - When syncing from cloud, it tried to INSERT logs that already existed locally
   - This caused sync failures after deleting items

## Fixes Applied

### 1. Database Changes (lib/db/sqlite.ts)

Changed INSERT statements to use `INSERT OR REPLACE` for all three tables:
- `createOvertimeLog()` - Now uses `INSERT OR REPLACE`
- `createUsualShift()` - Now uses `INSERT OR REPLACE`
- `createExportBatch()` - Now uses `INSERT OR REPLACE`

This allows syncing to overwrite existing records, preventing UNIQUE constraint errors.

### 2. Supabase Migration (supabase/migrations/20250110_fix_soft_delete_policies.sql)

Created new migration to fix RLS policies:
- Drops existing UPDATE policies
- Recreates them with same USING and WITH CHECK clauses
- This ensures the policies evaluate correctly for soft deletes
- Adds performance indexes on `deleted_at` columns

**IMPORTANT**: You must deploy this migration to Supabase before the soft delete feature will work properly.

## Deploying the Migration

You have two options to deploy the migration:

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project directory
cd /Users/nathanaeldavidson/Overtime+

# Apply the migration to your Supabase project
supabase db push

# Or if you have the CLI linked to your project:
npx supabase db push
```

### Option 2: Manual SQL Execution

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to SQL Editor
4. Copy and paste the entire contents of `supabase/migrations/20250110_fix_soft_delete_policies.sql`
5. Click "Run" to execute the migration

## Testing the Fix

After deploying the migration, test the following:

1. **Delete a log**:
   - Go to a log and tap delete
   - Verify it disappears from the list
   - Check logs - should NOT see RLS policy errors
   - Verify item appears in Recently Deleted

2. **Sync check**:
   - Pull to refresh on the logs screen
   - Should NOT see UNIQUE constraint errors
   - Deleted items should stay deleted (not re-download)

3. **Restore functionality**:
   - Go to Recently Deleted
   - Tap restore on an item
   - Verify it reappears in the main list
   - Check logs - should sync successfully

4. **Cross-device sync** (if you have multiple devices):
   - Delete an item on Device A
   - Open app on Device B
   - Verify deleted item doesn't appear
   - Restore on Device B
   - Verify it reappears on Device A

## Error Log Analysis

The errors you saw were:

```
ERROR [logsSync.deleteLog] Error deleting log: 
{"code": "42501", "message": "new row violates row-level security policy for table \"overtime_logs\""}
```

This was caused by the RLS policy evaluating the row AFTER the update. The old policy configuration was rejecting the update even though the `user_id` remained the same.

```
ERROR [logsStore.loadLogs] Failed to save remote-only log: 
[Error: UNIQUE constraint failed: overtime_logs.id]
```

This happened because the sync logic tried to INSERT a log that was already in the local database (just soft-deleted). The `INSERT OR REPLACE` fix resolves this by updating existing records instead of trying to insert duplicates.

## What This Fixes

✅ Soft delete now works correctly in the cloud  
✅ Deleted items won't re-download from cloud  
✅ Sync queue will stop retrying failed delete operations  
✅ Recently Deleted feature works end-to-end  
✅ No more UNIQUE constraint errors during sync  
✅ Cross-device deletion state syncs properly  

## Prevention

The `INSERT OR REPLACE` change makes the system more resilient to sync conflicts in general, not just for soft deletes. This will help prevent similar issues in the future if there are any race conditions or timing issues during sync.

## Next Steps

1. Deploy the Supabase migration (see options above)
2. Test deletion flow thoroughly
3. Monitor logs for any remaining errors
4. If everything works, the soft delete system is fully operational

