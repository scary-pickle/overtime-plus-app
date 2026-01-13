# Delete Account Investigation

## Issue Summary

After deleting a test account, the user was still visible in the backend. This investigation reveals the root cause and provides a fix.

## Root Cause

The delete account function has a **two-phase deletion process**:

1. **Soft Delete Phase**: Sets `account_deleted_at` timestamp on the `profiles` table
2. **Hard Delete Phase**: Calls the `delete-account` edge function to permanently delete all data

### The Problem

The **RLS (Row Level Security) policy** for the `profiles` table only checks `deleted_at IS NULL`, but the delete account function sets `account_deleted_at`. This means:

- ✅ The profile is marked for deletion (`account_deleted_at` is set)
- ❌ The RLS policy doesn't filter it out (only checks `deleted_at`)
- ❌ Deleted accounts remain visible in queries

**RLS Policy (Before Fix):**
```sql
CREATE POLICY profiles_select ON public.profiles 
  FOR SELECT 
  USING (user_id = auth.uid() AND deleted_at IS NULL);
```

**What Delete Account Does:**
```typescript
await supabase.from('profiles').update({ account_deleted_at: now }).eq('user_id', userId);
```

The policy doesn't check `account_deleted_at`, so deleted accounts pass through the RLS filter.

## Additional Considerations

### Hard Delete Function

The hard delete function (`supabase/functions/delete-account/index.ts`) should permanently delete:
- All table rows (attachments, export_batches, overtime_logs, shifts, profiles)
- All storage files (exports, attachments buckets)
- The auth user record

**If the hard delete fails or times out**, the account will remain in the database with `account_deleted_at` set, but still visible due to the RLS policy gap.

### Is Data Retention Required?

**No regulatory retention period is implemented.** The delete account function is designed to permanently delete all data immediately. There's no code that:
- Keeps data for a grace period
- Implements regulatory retention
- Delays hard deletion

The two-phase approach (soft delete → hard delete) appears to be for:
1. **Audit trail**: Mark data as deleted before permanent removal
2. **Error recovery**: If hard delete fails, data is at least marked as deleted
3. **Best-effort cleanup**: Soft delete happens even if hard delete fails

## The Fix

### 1. Update RLS Policy

Created migration: `supabase/migrations/20250120000001_fix_profiles_rls_account_deleted_at.sql`

This updates the RLS policy to check both `deleted_at` and `account_deleted_at`:

```sql
CREATE POLICY profiles_select ON public.profiles 
  FOR SELECT 
  USING (
    user_id = auth.uid() 
    AND deleted_at IS NULL 
    AND account_deleted_at IS NULL
  );
```

### 2. Why This Works

Once the RLS policy is updated:
- ✅ All queries (REST API, Supabase client, direct SQL) will automatically filter out deleted accounts
- ✅ No code changes needed - RLS is enforced at the database level
- ✅ Defense-in-depth: Even if hard delete fails, deleted accounts won't be visible

## Verification Steps

After applying the migration:

1. **Test delete account flow:**
   - Delete a test account
   - Verify `account_deleted_at` is set in the database
   - Verify the account is NOT visible in any queries (should return null/empty)

2. **Check hard delete function:**
   - Verify the `delete-account` edge function completes successfully
   - Check logs for any errors during hard delete
   - Verify all data is permanently removed after hard delete

3. **Verify RLS policy:**
   ```sql
   -- Check that deleted accounts are filtered
   SELECT * FROM profiles WHERE account_deleted_at IS NOT NULL;
   -- Should return 0 rows when queried as a regular user (RLS enforced)
   ```

## Recommendations

1. **Apply the migration** to fix the RLS policy
2. **Monitor hard delete function** for failures/timeouts
3. **Consider adding a cleanup job** to permanently delete accounts where `account_deleted_at` is set but hard delete failed (after a reasonable grace period, e.g., 7 days)
4. **Add logging** to track when hard delete fails vs succeeds

## Files Changed

- ✅ `supabase/migrations/20250120000001_fix_profiles_rls_account_deleted_at.sql` - New migration to fix RLS policy

## Related Files

- `lib/state/authStore.ts:1278` - Delete account function (soft delete phase)
- `supabase/functions/delete-account/index.ts` - Hard delete edge function
- `supabase/migrations/20251103_init.sql:99` - Original RLS policy (needs update)
