# Overtime+ Security Findings (Mobile App)

Severity legend: **P0** critical, **P1** high, **P2** medium, **P3** low.

## Findings

### P0
- **Plaintext offline database** — `lib/db/sqlite.ts` uses `expo-sqlite` without encryption; overtime logs, payroll numbers, and exports are stored unencrypted. Device compromise or backups expose all PII and work data.  
  **Fix:** Move to an encrypted database (SQLCipher/`expo-sqlite-crypto`) or encrypt sensitive columns (XChaCha20/AES-GCM) before writes with per-install keys in SecureStore. Provide migration to re-encrypt existing rows.

### P1
- **Session tokens can be written unencrypted** — `lib/auth/sqliteStorageAdapter.ts:363-407` stores auth sessions in SQLite. If encryption fails, it falls back to plaintext (“storing unencrypted payload”). A rooted device/backups could steal refresh/access tokens for full account takeover.  
  **Fix:** Fail closed for session keys: if encryption fails or DB unavailable, abort the write and force re-auth; do not persist plaintext. Add telemetry and user-facing retry guidance.

### P2
- **Profile encryption fails open** — `lib/storage/profile.ts:32-49` continues saving profile PII (email/initials) if encryption errors occur. This leaves PII unencrypted.  
  **Fix:** Treat encryption failure as fatal for profile saves; surface an error and block persistence. Add monitoring for encryption errors.

- **PDF exports left in cache across logout** — `lib/storage/pdfStorage.ts:118-136, 360-373`; logout only clears PDFs during account deletion, leaving exported PDFs (with PII) in `Paths.cache`.  
  **Fix:** Encrypt cached PDFs or delete cached copies on sign-out and after share/export completion. Invoke `clearCachedPdfsForBatches` during logout and when batches are removed.

### P3
- **Password policy minimal on client** — `lib/auth/validation.ts:17-29` only enforces 8 chars + upper/lower/number. If Supabase password policy differs, users may set weak passwords or see inconsistent errors.  
  **Fix:** Align with server policy (symbols/entropy) and show guidance. Enable Supabase Auth throttling/rate limits.

- **iOS allows local HTTP** — `ios/Overtime/Info.plist` sets `NSAllowsLocalNetworking=true`. If production endpoints ever use HTTP, traffic is exposed.  
  **Fix:** Keep local networking only for dev; validate production config uses HTTPS exclusively.

## Recommended Remediation Order
1) Encrypt the offline database or sensitive columns; ship a migration.  
2) Make auth session and profile encryption fail-closed; force re-auth on failure.  
3) Add PDF cache scrubbing/encryption on logout/export completion.  
4) Align password policy with Supabase and confirm Auth rate limiting is enabled.  
5) Review platform transport settings to ensure HTTPS-only in production.
