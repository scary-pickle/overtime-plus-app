# Security Hardening Summary – `security-hardening` branch

## Completed changes (no further action required)
- **Supabase session persistence**
  - Chunked `SecureStoreAdapter` replaces the insecure SQLite/XOR store.
  - Auth flows updated to use `setSession({ access_token, refresh_token })` and tolerate delayed persistence.
- **Storage privacy & RLS tightening**
  - Buckets (`attachments`, `exports`) are created as private and all UPDATE policies include `WITH CHECK (user_id = auth.uid())`.
  - Client now uses storage URIs and signed URLs instead of public links.
- **Secrets**
  - Supabase anon key & URL rotated; local `.env` scrubbed back to placeholders.
- **Type / build verification**
  - `npx tsc --noEmit` passes after the above refactors.

## Latest updates (completed)
- **Edge function guard**
  - ✅ Updated `auth-signup-guard` to accept secret in both Authorization header and request body (fallback for hooks that don't support custom headers).
  - ✅ Updated `SUPABASE_DEPLOY.md` with instructions for setting `SIGNUP_GUARD_SECRET` and configuring the hook.
- **Logging hygiene**
  - ✅ Added masking helpers (`maskEmail`, `maskUserId`, `maskName`) in `lib/supabase.ts`, `lib/state/authStore.ts`, `lib/storage/profile.ts`, and `app/auth/verify-email.tsx`.
  - ✅ Gated all debug logging in `app/auth/sign-in.tsx`, `app/auth/sign-up.tsx`, and `app/index.tsx` with `NODE_ENV` checks.
  - ✅ All `debug(...)` calls are now properly gated - production builds with `NODE_ENV=production` will not emit debug logs.

## Deployment / configuration steps
1. **Edge function (`auth-signup-guard`)** ✅ **DEPLOYED**
   - ✅ Secrets set: `SIGNUP_GUARD_SECRET`, `REQUIRE_DOMAIN=true`, `ALLOWED_DOMAINS=health.qld.gov.au`
   - ✅ Function deployed to project `ethllesuiqlomdtctvdh`
   - ⚠️ **Still needed:** Configure the Auth hook in Supabase Dashboard (see `SUPABASE_DEPLOY.md` for details)
   - The function accepts the secret in either:
     - Authorization header: `Authorization: Bearer <SIGNUP_GUARD_SECRET>` (preferred)
     - Request body: `{ "secret": "<SIGNUP_GUARD_SECRET>", ... }` (fallback)
2. **Logging**
   - ✅ Code changes complete - ensure production builds run with `NODE_ENV=production` (default for production builds).

## Suggested verification
- `npx tsc --noEmit`
- End-to-end sign-up / verification / onboarding (confirm masked logs only, no raw PII).
- Invoke `auth-signup-guard` manually with and without the shared secret to confirm enforcement.

## Reference files
- `lib/auth/storageAdapter.ts`, `lib/auth/migrateAuthStorage.ts`
- `lib/supabase.ts`, `lib/state/authStore.ts`, `lib/state/logsStore.ts`
- `lib/storage/pdfStorage.ts`, `lib/storage/profile.ts`
- `supabase/create_buckets.sql`, `supabase/migrations/*`, `supabase/storage-policies.sql`
- `supabase/functions/auth-signup-guard/index.ts`
