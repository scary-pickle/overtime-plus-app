# Security Hardening Summary (current branch)

## Scope of changes
- Replaced legacy XOR schemes with authenticated encryption (XChaCha20-Poly1305) for:
  - PII field helper: `lib/utils/encryption.ts`
  - Supabase auth session storage in SQLite: `lib/auth/sqliteStorageAdapter.ts`
  - Keys now generated as 256-bit random bytes in SecureStore; legacy data is migrated on read (best-effort fallback).
- Added HTTPS enforcement for Supabase config:
  - `lib/supabase.ts` now throws on non-HTTPS, non-localhost URLs to prevent insecure transport.
- PDF cleanup and deletion hooks:
  - `lib/storage/pdfStorage.ts` now exposes helpers to clear cached PDFs and remove Supabase storage objects (best-effort).
  - `lib/state/authStore.ts` account deletion uses these helpers after collecting export batches.
- Dependency addition:
  - `@noble/ciphers` added (used for XChaCha20-Poly1305).

## Rationale
- Stronger cryptography: XOR offered no confidentiality or integrity; AEAD provides both and resists tampering.
- Transport safety: failing fast on non-HTTPS avoids accidental plaintext token leakage.
- Data lifecycle: PDF cache and cloud objects are now cleaned up during account deletion to reduce residual PII.

## Important behaviors
- Legacy encrypted values are decrypted on read; any unreadable payload returns as-is to avoid crashes.
- Session storage encrypts when the payload is a Supabase session or exceeds the size threshold; stored values are marked with `v2:` prefix.
- Account deletion remains best-effort client-side; a server-side hard-delete/RPC is still recommended for full erasure (DB + storage).

## Files touched
- `lib/utils/encryption.ts` — new AEAD helper, legacy fallback.
- `lib/auth/sqliteStorageAdapter.ts` — session encryption/decryption, legacy fallback, helper utilities.
- `lib/supabase.ts` — HTTPS enforcement.
- `lib/storage/pdfStorage.ts` — cache/remote deletion helpers.
- `lib/state/authStore.ts` — uses PDF cleanup in deleteAccount.
- `package.json` — add `@noble/ciphers`.

## Follow-ups recommended
- Implement backend-assisted hard delete (tables + Supabase Storage) and invoke from client.
- Consider encrypting additional SQLite fields or adopting SQLCipher for full DB at rest protection.
- Audit remaining logging for PII in production and tighten log levels if needed.
- Run end-to-end tests of sign-in/restore/export/delete flows on device to confirm migrations and cleanup. 
