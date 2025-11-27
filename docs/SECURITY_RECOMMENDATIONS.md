# Security Recommendations – Overtime+

## 1. Protect Supabase Credentials (High)
- **Issue**: `.env` with production Supabase URL/key is committed.
- **Risks**: Anyone cloning the repo can hit the live API, brute-force auth, or scrape metadata.
- **Fix**:
  - Remove `.env` from Git history, keep only `env.example`.
  - Load secrets from EAS/CI secure storage (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
  - Rotate the publishable key after removal.

## 2. Encrypt On-Device Data (High)
- **Issue**: SQLite tables (`overtime_logs`, `shifts`, `export_batches`, etc.) and cached PDFs are plaintext.
- **Risks**: Rooted devices, backups, or malware can read shift/overtime data and PDFs.
- **Fix**:
  - Use SQLCipher or AES-wrapped columns (see `lib/db/crypto.ts` pattern) before writing to SQLite.
  - Store the encryption key in Expo SecureStore; regenerate per install.
  - After sharing/exporting, delete cached PDFs (`Paths.cache.uri`) or apply TTL cleanup.

## 3. Sanitize Logs & Telemetry (Medium)
- **Issue**: `onboardingStore`, log editors, onboarding flows, etc., `console.log` user metadata, emails, initials, session states without guards.
- **Risks**: PHI/PII lands in production logs (`logcat`, iOS Console, crash reporters).
- **Fix**:
  - Create `devLog()` helper (guards on `__DEV__`) and replace raw `console.*`.
  - Mask identifiers before logging (`maskEmail`, `maskUserId` already exist).
  - Ensure build scripts set `NODE_ENV=production` for releases.

## 4. Clipboard & Sharing Hygiene (Medium)
- **Issue**: `app/export/view.tsx` auto-copies recipient/subject/body when sharing AVAC emails.
- **Risks**: Any foreground app/keyboard can read clipboard contents (Android & iOS).
- **Fix**:
  - Prompt the user; copy only after explicit action.
  - Clear clipboard after sharing (e.g., overwrite with empty string after 60 sec).
  - Consider rendering the draft in-app instead of copying.

## 5. Supabase Soft Delete Fixes (Medium)
- **Action**: Run `MANUAL_SQL_FIX_V2.sql` in Supabase SQL editor to drop legacy signatures and install the secured `soft_delete_*` functions.
- **Follow-up**:
  - Verify RLS policies show only the single SECURITY DEFINER functions via the SELECT query at the bottom of that script.
  - Revoke execute on deprecated signatures if they reappear from migrations.

## 6. Storage Bucket Security (Medium)
- **Status**: Policies exist in `supabase/storage-policies.sql`, but double-check they are deployed.
- **Steps**:
  - Buckets `attachments` & `exports` must be private.
  - Apply path-based policies so folder[0] == `auth.uid()`.
  - Consider lifecycle rules (auto-delete PDFs after 30/60 days).

## 7. Session Persistence Review (Medium)
- **Context**: `SecureStoreAdapter` replaces the SQLite XOR store; ensure no regression.
- **Actions**:
  - Remove `logDebug` statements that print session key lengths/values.
  - Add automated tests that simulate storing/retrieving sessions to catch future adapter regressions.

## 8. Network & Auth Hardening (Medium)
- Enforce HTTPS-only Supabase URL validation on start-up.
- Enable Supabase Auth rate limits + CAPTCHA/MFA (esp. for domain-restricted deployments).
- Shorten JWT lifetimes if feasible (e.g., 1 hour access token, refresh token 2 weeks).
- Document lost-device response (remote sign-out, key rotation).

## 9. Edge Function Guard (Low/Operational)
- Ensure `auth-signup-guard` has `SIGNUP_GUARD_SECRET` set and Auth hook sends `Authorization: Bearer <secret>`.
- Monitor its logs for denied signups and consider alerting on repeated failures.

## 10. Validation & Monitoring (Ongoing)
- **Scripts**:
  - `rg "console\.log" app lib` ➜ ensure only dev logs remain.
  - `supabase db diff` ➜ confirm no new policies disable RLS.
  - Device tests: export/share flow, verify clipboard clears, confirm PDFs deleted afterward.
- **Monitoring**:
  - Supabase logs for RPC usage + failed policy checks.
  - Crash/analytics pipelines for accidental PII (mask fields before sending).

---

### Immediate To-Do List
1. Remove committed `.env`, rotate Supabase publishable key, configure secure env injection.
2. Merge logging guard changes + clipboard prompt/cleanup in `app/export/view.tsx`.
3. Implement at-rest encryption for SQLite + PDF cache, or at minimum add cleanup routines.
4. Run `MANUAL_SQL_FIX_V2.sql` in production Supabase and confirm only three `soft_delete_*` functions remain.

Once these are complete, schedule a follow-up audit covering SQLCipher migration, incident response runbooks, and automated policy verification in CI.
