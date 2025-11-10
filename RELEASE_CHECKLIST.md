# Security Hardening Release Checklist

This checklist covers the deployment steps required for the security hardening changes made in the `security-hardening-2` branch.

## Pre-Release: Database & Infrastructure Changes

### 1. Apply Database Migrations ⚠️ MANUAL STEP REQUIRED

**Action Required:** The Supabase database migration has a version conflict and must be applied manually.

**Steps:**
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `MANUAL_SQL_FIX.sql` from the repository
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute the migration

**What this does:**
- Creates or replaces `soft_delete_overtime_log(uuid)` function
- Creates or replaces `soft_delete_shift(uuid)` function
- Creates or replaces `soft_delete_export_batch(uuid)` function
- All functions use `SECURITY DEFINER` with `auth.uid()` ownership checks
- Grants execute permissions to authenticated users

**Verification:**
After running the SQL, you should see 3 functions listed in the query results:
- `soft_delete_overtime_log(log_uuid uuid)` - SECURITY DEFINER
- `soft_delete_shift(shift_uuid uuid)` - SECURITY DEFINER
- `soft_delete_export_batch(batch_uuid uuid)` - SECURITY DEFINER

You can also verify in the Supabase Dashboard:
- Go to **Database** → **Functions**
- Confirm all three `soft_delete_*` functions exist
- Check that old versions (if any) are removed

### 2. Deploy Edge Function ✅ COMPLETED

**Status:** Already deployed via `supabase functions deploy auth-signup-guard --no-verify-jwt`

**Post-deployment verification required:**
1. Open Supabase Dashboard → **Authentication** → **Hooks**
2. Locate the signup hook configuration
3. Ensure the Authorization header is set: `Authorization: Bearer <SIGNUP_GUARD_SECRET>`
   - The secret should match your `SIGNUP_GUARD_SECRET` environment variable
4. Test the hook:
   - Try signing up with an allowed email domain (should succeed)
   - Try signing up with a blocked email domain (should fail with appropriate error)

**What changed:**
- Edge function now requires `Authorization: Bearer <secret>` header
- Uses timing-safe comparison to prevent timing attacks
- Spoofed headers can no longer bypass the domain validation

## Build Changes

### 3. Android Build Requirements

**⚠️ BREAKING CHANGE:** `allowBackup` has been disabled in Android configuration.

**Required Actions:**
```bash
# Clean the Android build directory
cd android
./gradlew clean
cd ..

# Regenerate native projects
npx expo prebuild --clean

# Rebuild Android app
npm run android
# or
npx expo run:android
```

**Why:** 
- `allowBackup` was set to `false` in `app.json` and `app.config.ts`
- This prevents Supabase refresh tokens from being backed up to Google Drive
- A clean prebuild is required to apply this security change to native code

### 4. iOS Build (No Changes Required)

iOS builds do not require any special steps. The security changes are compatible with existing iOS configurations.

## Code Changes Summary

### Session Persistence
- Reverted to SecureStore with chunked storage adapter
- Removed unencrypted SQLite token storage
- **Files changed:** `lib/supabase.ts`, `lib/auth/sqliteStorageAdapter.ts`

### Debug Logging
- All PII and sensitive auth metadata now gated behind `__DEV__` flag
- Production builds will not log payroll data or session tokens
- **Files changed:** `app/(tabs)/profile.tsx`, `lib/state/profileStore.ts`, `lib/state/shiftsStore.ts`, `app/_layout.tsx`

### TypeScript Fixes
- Fixed `SafeAreaView` import in `app/recently-deleted.tsx`
- Now imports from `react-native-safe-area-context` (supports `edges` prop)

### Test Updates
- Updated `__tests__/logsStore.test.ts` to handle new `userId` parameter in database functions
- Added `authStore` mock with test user ID
- All 32 tests passing ✅

## Post-Release Testing

### Functional Tests (Manual)

#### Authentication Flow
- [ ] Sign up with allowed email domain succeeds
- [ ] Sign up with blocked email domain fails appropriately
- [ ] Sign in with existing account works
- [ ] Session persists after app restart
- [ ] Logout clears session properly

#### Profile & Data Management
- [ ] Profile save succeeds
- [ ] Profile data loads correctly
- [ ] No PII visible in production logs

#### Shift & Log CRUD
- [ ] Create new overtime log
- [ ] Update existing log
- [ ] Delete log (soft delete)
- [ ] Restore deleted log from Recently Deleted
- [ ] Permanently delete log
- [ ] Create shift
- [ ] Update shift
- [ ] Delete shift (soft delete)

#### Export Batch Management
- [ ] Create export batch
- [ ] Delete export batch (soft delete)
- [ ] Restore deleted batch

#### Cross-Tenant Security (CRITICAL)
- [ ] User A cannot view User B's logs
- [ ] User A cannot delete User B's logs (try calling RPC directly)
- [ ] User A cannot restore User B's deleted items
- [ ] Soft delete RPCs reject unauthorized attempts with proper error

### Automated Tests

```bash
# Type checking
npx tsc --noEmit

# Unit tests
npm run test

# Expected results:
# - No TypeScript errors
# - All 32 tests passing
```

## Rollback Plan

If issues are discovered post-release:

### Database Rollback
The new database functions are backward-compatible. If you need to rollback:
1. The old functions (if they existed) can be restored
2. Or keep the new functions - they're secure and won't break existing functionality

### Code Rollback
```bash
# Revert to previous branch
git checkout main  # or your stable branch
git pull

# Clean and rebuild
npx expo prebuild --clean
npm run android  # or ios
```

### Edge Function Rollback
```bash
# Deploy previous version
git checkout main  # or your stable branch
supabase functions deploy auth-signup-guard --no-verify-jwt
```

## Deployment Checklist

Use this checklist to track deployment progress:

- [ ] **Database Migration Applied** (via SQL Editor)
- [ ] **Database Functions Verified** (in Dashboard → Functions)
- [ ] **Edge Function Deployed** ✅
- [ ] **Edge Function Auth Header Configured** (in Dashboard → Auth Hooks)
- [ ] **Edge Function Tested** (allowed/blocked domains)
- [ ] **Android Build Cleaned** (`./gradlew clean`)
- [ ] **Native Projects Rebuilt** (`npx expo prebuild --clean`)
- [ ] **TypeScript Check Passed** ✅
- [ ] **Unit Tests Passed** ✅
- [ ] **Manual Testing Completed** (see checklist above)
- [ ] **Production Logs Verified** (no PII visible)
- [ ] **Cross-Tenant Security Tested** (critical!)

## Environment Variables

Ensure the following environment variables are set:

**Supabase Dashboard (Edge Function):**
- `SIGNUP_GUARD_SECRET` - Shared secret for edge function authentication

**App Configuration (if applicable):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Support & Documentation

For reference, see these documentation files:
- `SECURITY_NEXT_STEPS.md` - Detailed explanation of changes
- `SECURITY_HARDENING_NOTES.md` - Security analysis and rationale
- `MANUAL_SQL_FIX.sql` - Database migration SQL
- `SESSION_PERSISTENCE_FIX.md` - Session storage implementation details

## Questions or Issues?

If you encounter any issues during deployment:
1. Check the Supabase Dashboard logs (Functions → auth-signup-guard → Logs)
2. Check the Database logs (Database → Logs)
3. Review test results: `npm run test`
4. Check TypeScript compilation: `npx tsc --noEmit`

---

**Last Updated:** November 10, 2025
**Branch:** `security-hardening-2`
**Deployment Status:** Ready for production ✅ (pending manual database migration)

