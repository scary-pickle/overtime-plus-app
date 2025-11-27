# Security Hardening Summary & Cursor Task List

## What Changed
- **Supabase soft-delete RPCs** (`supabase/migrations/20250110_fix_soft_delete_rls.sql`, `MANUAL_SQL_FIX.sql`, client calls in `lib/supabase.ts`) now derive ownership from `auth.uid()` instead of trusting a `user_uuid` parameter, closing the cross-tenant delete gap.
- **Edge Function auth** (`supabase/functions/auth-signup-guard/index.ts`) requires the shared secret via a timing-safe comparison before validating email domains, so spoofed headers can’t bypass the guard.
- **Session persistence** switches the Supabase client back to the chunked SecureStore adapter (`lib/supabase.ts`), removing the unencrypted SQLite token store.
- **PII/log hygiene** (`app/(tabs)/profile.tsx`, `lib/state/profileStore.ts`, `lib/state/shiftsStore.ts`, `app/_layout.tsx`) now gates debug logs behind the environment flag so production builds stop emitting payroll data and auth metadata.
- **Android backups** disabled (`app.config.ts`, `app.json`) to keep Supabase refresh tokens out of Google backup archives.

## Next Actions (delegate-ready)
1. **Apply Supabase DB changes**
   - `supabase db push` (or run `MANUAL_SQL_FIX.sql` in SQL Editor if migrations aren’t auto-applied).
   - Verify new `soft_delete_*` signatures exist and old versions are removed (Database → Functions).
2. **Redeploy edge function**
   - `supabase functions deploy auth-signup-guard --no-verify-jwt`.
   - In Dashboard → Auth Hooks, ensure the call sends `Authorization: Bearer <SIGNUP_GUARD_SECRET>`.
   - Smoke-test allowed vs blocked signup domains.
3. **Fix SafeAreaView typing error**
   - Update `app/recently-deleted.tsx` to use `SafeAreaView` from `react-native-safe-area-context` (supports `edges` prop) and re-run `npx tsc --noEmit`.
4. **Regression tests**
   - `npx tsc --noEmit`
   - `npm run test`
   - Manual sanity: sign-up flow, login, profile save, shift CRUD, export delete.
5. **Prepare release checklist**
   - Document new requirement to run `supabase db push` + function deploy before shipping.
   - Note that Android builds now require a clean prebuild because `allowBackup` changed.

Use this file to coordinate follow-up work in Cursor or your task tracker.***
