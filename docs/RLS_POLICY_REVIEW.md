# Supabase RLS Policy & Delete-Account Function Review

## Executive Summary

✅ **RLS policies properly enforce user_id scoping** for all user-owned tables  
✅ **Delete-account function properly purges cloud data** using service role  
⚠️ **Minor gaps**: No explicit DELETE policies (acceptable since service role bypasses RLS)

---

## 1. RLS Policies Analysis

### Tables with RLS Enabled

#### ✅ User-Owned Tables (Properly Scoped by `user_id`)

| Table | SELECT | INSERT | UPDATE | DELETE | Status |
|-------|--------|--------|--------|--------|--------|
| `profiles` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ⚠️ None | **Good** |
| `shifts` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ⚠️ None | **Good** |
| `overtime_logs` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ⚠️ None | **Good** |
| `export_batches` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ⚠️ None | **Good** |
| `attachments` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ✅ `user_id = auth.uid()` | ⚠️ None | **Good** |

**Policy Details:**
- All SELECT policies filter by `user_id = auth.uid() AND deleted_at IS NULL` (properly excludes soft-deleted rows)
- All INSERT policies use `WITH CHECK (user_id = auth.uid())` (prevents inserting rows for other users)
- All UPDATE policies use `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` (allows soft deletes)
- **No explicit DELETE policies** - This is acceptable because:
  1. The delete-account function uses service role (bypasses RLS)
  2. Soft deletes are used (UPDATE with `deleted_at`)
  3. Foreign keys have `ON DELETE CASCADE` which works with service role

#### ✅ System Tables (Intentionally Public/Service-Role Only)

| Table | Purpose | RLS Policy | Status |
|-------|---------|------------|--------|
| `pdf_templates` | Public PDF templates | `SELECT` for `anon, authenticated` | **Good** (intentional public read) |
| `remote_feature_flags` | Feature flags | `SELECT` for `authenticated`, `ALL` for `service_role` | **Good** (service role only writes) |

### Storage Bucket Policies

✅ **Storage policies properly scope by user_id via folder structure:**

```sql
-- Attachments bucket
SELECT/INSERT/UPDATE/DELETE: (storage.foldername(name))[1] = auth.uid()::text

-- Exports bucket  
SELECT/INSERT/UPDATE/DELETE: (storage.foldername(name))[1] = auth.uid()::text
```

**Status:** ✅ **Secure** - Files are organized by `{userId}/{filename}` and policies enforce folder ownership.

---

## 2. Delete-Account Function Analysis

### Location
`supabase/functions/delete-account/index.ts`

### Security Validation ✅

1. **Authentication Check:**
   ```typescript
   const authHeader = req.headers.get('Authorization') ?? '';
   if (!authHeader.toLowerCase().startsWith('bearer ')) {
     return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 });
   }
   ```

2. **User Resolution:**
   ```typescript
   const { data: userData, error: userError } = await userScopedClient.auth.getUser();
   if (userError || !userData?.user) {
     return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 });
   }
   const userId = userData.user.id;
   ```

3. **Service Role Usage:**
   - Uses service role client to bypass RLS (necessary for account deletion)
   - Only deletes data for the authenticated user's `userId`

### Data Deletion Process ✅

**Tables Deleted (in order):**
1. `attachments` - User attachments
2. `export_batches` - Export batch records
3. `overtime_logs` - Overtime log entries
4. `shifts` - Shift records
5. `profiles` - User profile

**Storage Deleted:**
- `exports` bucket: All files under `{userId}/` prefix
- `attachments` bucket: All files under `{userId}/` prefix

**Auth User Deleted:**
- Final step: `adminClient.auth.admin.deleteUser(userId)`

**Foreign Key Cascades:**
- All tables have `ON DELETE CASCADE` from `auth.users(id)`, so deleting the auth user would cascade
- However, the function explicitly deletes tables first, then auth user (good practice)

### Potential Issues

⚠️ **Minor:** The function doesn't explicitly verify that the `userId` extracted from the token matches the data being deleted. However, this is safe because:
- The `userId` is extracted from the authenticated token
- Only that specific `userId` is used in all delete operations
- The service role client is scoped to that user's token context

✅ **Recommendation:** Current implementation is secure. The explicit `userId` extraction and usage ensures only the authenticated user's data is deleted.

---

## 3. Foreign Key Constraints

All user-owned tables have proper foreign key constraints:

```sql
-- All tables reference auth.users(id) with ON DELETE CASCADE
user_id uuid not null references auth.users(id) on delete cascade
```

**Status:** ✅ **Good** - Ensures data integrity and automatic cleanup if auth user is deleted.

---

## 4. Security Assessment

### ✅ Strengths

1. **RLS properly scopes all user data by `user_id = auth.uid()`**
2. **Storage policies enforce folder-based ownership**
3. **Delete-account function validates authentication before deletion**
4. **Delete-account function uses service role appropriately (bypasses RLS for cleanup)**
5. **Foreign keys ensure referential integrity**
6. **Soft deletes are properly handled (UPDATE policies don't check `deleted_at`)**

### ⚠️ Minor Observations

1. **No explicit DELETE policies** - Acceptable because:
   - Service role bypasses RLS (needed for account deletion)
   - Soft deletes are used (UPDATE with `deleted_at`)
   - Foreign keys handle cascades

2. **Delete-account function could add explicit userId validation** - Current implementation is safe, but could add:
   ```typescript
   // Optional: Explicit validation
   if (userId !== userData.user.id) {
     throw new Error('User ID mismatch');
   }
   ```
   However, this is redundant since `userId` is extracted from `userData.user.id`.

3. **Minor bug in client-side soft delete** - In `lib/state/authStore.ts:843`, the code attempts to soft-delete from `'usual_shifts'`:
   ```typescript
   const tables = ['overtime_logs', 'usual_shifts', 'export_batches'] as const;
   ```
   However, `usual_shifts` is a **local SQLite table only**, not a Supabase table. The Supabase table is `shifts`. This will fail silently (caught in try-catch), but should be fixed to use `'shifts'` instead. **Note:** This doesn't affect the delete-account function, which correctly uses `'shifts'`.

---

## 5. Recommendations

### ✅ Current Implementation is Secure

The RLS policies and delete-account function are properly implemented:

1. ✅ All user-owned tables are scoped by `user_id = auth.uid()`
2. ✅ Storage policies enforce folder-based ownership
3. ✅ Delete-account function properly authenticates and deletes only the authenticated user's data
4. ✅ Foreign keys ensure data integrity

### Optional Enhancements (Not Required)

1. **Add explicit DELETE policies** (for defense-in-depth, though service role bypasses RLS):
   ```sql
   CREATE POLICY profiles_delete ON public.profiles
     FOR DELETE USING (user_id = auth.uid());
   ```
   This would prevent accidental client-side hard deletes, but is not critical since:
   - Soft deletes are the standard approach
   - Delete-account uses service role
   - Foreign keys handle cascades

2. **Add logging to delete-account function** (already has console.log, could enhance):
   - Log which tables were deleted
   - Log file counts from storage
   - Log deletion timestamps

---

## 6. Conclusion

**✅ RLS policies correctly enforce user_id scoping**  
**✅ Delete-account function properly purges cloud data**  
**✅ Storage policies enforce user ownership**  
**✅ Foreign keys ensure data integrity**

**Status: SECURE** - The implementation follows best practices for Supabase RLS and account deletion. The minor gaps (no explicit DELETE policies) are acceptable given the architecture (soft deletes + service role for hard deletes).

---

## 7. Testing Recommendations

To validate these assumptions:

1. **Test RLS isolation:**
   - Create two test users
   - Verify user A cannot SELECT/INSERT/UPDATE user B's data
   - Verify storage policies prevent cross-user file access

2. **Test delete-account function:**
   - Create test user with data in all tables
   - Call delete-account function
   - Verify all rows deleted from tables
   - Verify all files deleted from storage
   - Verify auth user deleted
   - Verify other users' data remains intact

3. **Test foreign key cascades:**
   - Verify `overtime_logs.shift_id` properly handles `ON DELETE SET NULL`
   - Verify all other foreign keys cascade correctly

