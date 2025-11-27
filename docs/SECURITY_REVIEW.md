# Security Review – Current Findings

## Critical Issues

### 1. Supabase credentials committed to source control
- **Location:** `.env:1-15`
- **Details:** The repository contains the live Supabase project URL plus multiple publishable keys. Anyone with repo access can hit the real backend anonymously, replay auth flows, or scrape metadata. Because publishable keys are not secret-proof, exposing them publicly defeats the point of rotating keys referenced throughout `SECURITY_RECOMMENDATIONS.md`.
- **Impact:** Attackers can script brute-force sign-up/login attempts, enumerate storage buckets, or build phishing flows against the real project without touching your infra. If the publishable key permissions are widened later, the blast radius grows further.
- **Recommendation:** Remove `.env` from git history, rely on `env.example` for defaults, and inject deploy-time secrets via EAS/CI. Rotate both the Supabase publishable key and any other keys that were ever committed once the file is excised.

### 2. XOR-based “encryption” for PII is easily reversible
- **Location:** `lib/utils/encryption.ts:26-93`
- **Details:** Profile initials and email addresses are “encrypted” using a deterministic XOR cipher seeded via `Math.random()` and padded text. Anyone who recovers a single plaintext/ciphertext pair (or dumps the SecureStore key) can instantly decrypt every saved profile value. XOR plus predictable keys does not provide confidentiality.
- **Impact:** Compromise of SecureStore or even a single profile record allows recovery of all locally stored PII. This defeats the stated goal of encrypting profile data before persisting it to storage.
- **Recommendation:** Replace the XOR routine with a vetted algorithm (AES-GCM/ChaCha20) via `expo-crypto`, `tweetnacl`, or a native module. Derive the key from the OS keychain or Secure Enclave, incorporate an IV per record, and include authentication tags so tampering is detected.

### 3. Encryption failures silently store plaintext profile data
- **Location:** `lib/storage/profile.ts:32-49`
- **Details:** When `encrypt()` throws, the code logs the error and continues saving the unhashed `employeeInitial` and `email` strings. There is no user feedback, no retry, and no marker indicating the record is now plaintext. A transient SecureStore or permissions issue permanently downgrades the record’s security.
- **Impact:** Users believe their data is encrypted even when it is not, and the app cannot distinguish which entries were stored safely. Attackers who gain file-system access can target those plaintext records immediately.
- **Recommendation:** Fail-fast on encryption errors: surface a user-visible error, abort the write, and retry once SecureStore is available. Track an “encryption version” flag per record so you can migrate or refuse to process plaintext records later.

### 4. AVAC generator logs raw names, locations, and log details
- **Location:** `lib/pdf/buildAVAC.ts:132-175`, `lib/pdf/buildAVAC.ts:1600-1750`
- **Details:** The PDF builder spam-logs every text draw call (`console.log("📝 Drawing text \"${sanitizedText}\"...")`) plus the user’s full name, department, hospital, and each log row ID. These `console.log` statements execute even in production builds, meaning `logcat`, iOS Console, and any crash reporter will contain unmasked PHI/PII.
- **Impact:** Anyone with device log access (other apps on Android, MDM tooling, crash reporting vendors) can capture sensitive payroll data. On regulated deployments this is typically considered a reportable leak.
- **Recommendation:** Remove the raw `console.log` statements or wrap them with the masked `createScopedLogger` that no-ops in production. If logging is required for support, mask text fields (`maskName`, `maskEmail`) and gate behind a runtime debug flag.

### 5. Local SQLite + cached PDFs remain unencrypted at rest
- **Location:** `lib/db/sqlite.ts:1-139`, `lib/storage/pdfStorage.ts:98-160`
- **Details:** All overtime logs, shift templates, export batches, and cached PDF files live in plaintext under `overtime_plus.db` (Expo SQLite) and `Paths.cache`. There is no per-user wipe on sign-out, no SQLCipher, and no secure file wrapper. Export PDFs are cached indefinitely using predictable names (`${batchId}.pdf`) so a new user on the same device inherits the prior user’s historical exports.
- **Impact:** Lost or rooted devices expose complete overtime histories and payroll artifacts. Shared devices (clinic iPads) can leak a previous clinician’s exports to the next login because files remain on disk.
- **Recommendation:** Encrypt local data at rest (SQLCipher, WatermelonDB + libsodium, or manually encrypt/decrypt payloads with a SecureStore-managed key). For PDFs, either decrypt-on-use into memory only, or store them using `expo-file-system` encrypted directories plus a scheduled purge (on sign-out, app backgrounding, or TTL). Add a migration that wipes cached PDFs when the active user changes.

---

Addressing the above items will eliminate the most pressing confidentiality gaps. Follow up with regression tests (e.g., failing unit tests when a console log is reintroduced or when encryption helpers return plaintext) to prevent these patterns from coming back.
