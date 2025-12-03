# Security Review Prompt for Codex

Use this prompt with Codex (GitHub Copilot, Cursor AI, or similar) to perform a comprehensive security review of the Overtime+ React Native/Expo application.

---

## Prompt

You are a security expert reviewing a React Native/Expo mobile application called "Overtime+" that tracks employee overtime and shift data. The app uses:

- **Frontend**: React Native with Expo Router, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Local Storage**: SQLite (expo-sqlite) for offline-first data
- **Authentication**: Supabase Auth with PKCE flow
- **Secure Storage**: Expo SecureStore for tokens and sensitive data
- **State Management**: Zustand
- **Key Libraries**: @supabase/supabase-js, expo-secure-store, expo-sqlite, pdf-lib

**Your task**: Perform a comprehensive security audit and identify vulnerabilities, security weaknesses, and areas for improvement. Focus on:

### 1. Authentication & Authorization

- [ ] **Session Management**: Review how JWT tokens and refresh tokens are stored, validated, and refreshed. Check for:
  - Token storage security (SecureStore vs plain storage)
  - Token expiration handling and automatic refresh
  - Session persistence across app restarts
  - Token caching and cache invalidation
  - Session hijacking prevention

- [ ] **Authentication Flow**: Review sign-in, sign-up, password reset flows:
  - Password strength validation
  - Email verification requirements
  - Rate limiting on auth endpoints
  - Protection against brute force attacks
  - OTP/2FA implementation (if any)

- [ ] **Authorization Checks**: Verify that:
  - User can only access their own data (user_id checks)
  - API requests include proper authorization headers
  - Row Level Security (RLS) policies are enforced on backend
  - No privilege escalation vulnerabilities

**Key Files to Review**:
- `lib/supabase.ts` (auth functions, token management)
- `lib/state/authStore.ts` (authentication state)
- `lib/auth/storageAdapter.ts` (session storage)
- `lib/auth/sqliteStorageAdapter.ts` (SQLite-based session storage)
- `app/auth/*.tsx` (auth UI screens)

### 2. Data Storage Security

- [ ] **Local Database (SQLite)**: Review data encryption:
  - Is sensitive data encrypted before storing in SQLite?
  - Are encryption keys stored securely (SecureStore)?
  - Is the encryption algorithm strong (AES-GCM, not XOR)?
  - Are user IDs properly scoped to prevent data leakage?

- [ ] **SecureStore Usage**: Verify:
  - All tokens, keys, and sensitive data use SecureStore
  - No sensitive data in AsyncStorage or plain SQLite
  - SecureStore keys are properly namespaced
  - Chunked storage implementation for large values (2048 byte limit)

- [ ] **Data Isolation**: Check:
  - Multi-user data separation (user_id filtering)
  - Soft delete implementation (deleted_at timestamps)
  - Data cleanup on account deletion
  - Legacy data handling (pre-auth data)

**Key Files to Review**:
- `lib/db/sqlite.ts` (database operations)
- `lib/utils/encryption.ts` (encryption utilities)
- `lib/storage/profile.ts` (profile storage)
- `lib/auth/storageAdapter.ts` (SecureStore adapter)

### 3. API & Network Security

- [ ] **API Communication**: Review:
  - All API calls use HTTPS (no HTTP except localhost)
  - Supabase URL validation (HTTPS enforcement)
  - API key exposure (anon key in client is acceptable, but verify RLS)
  - Request/response validation
  - Error handling doesn't leak sensitive info

- [ ] **Data Sync**: Review sync operations:
  - Conflict resolution logic
  - Data integrity checks
  - Sync queue implementation
  - Offline data handling

- [ ] **Supabase Integration**: Verify:
  - RLS policies are properly configured (server-side)
  - Direct REST API calls include proper auth headers
  - Token refresh on 401/403 errors
  - Rate limiting considerations

**Key Files to Review**:
- `lib/supabase.ts` (API client, sync functions)
- `lib/sync/queue.ts` (sync queue)
- All files making `fetch()` or Supabase client calls

### 4. Input Validation & Sanitization

- [ ] **User Input Validation**: Check:
  - Email format validation
  - Password strength requirements
  - SQL injection prevention (parameterized queries)
  - XSS prevention in any web views
  - Input length limits
  - Type validation (numbers, dates, etc.)

- [ ] **Data Validation**: Review:
  - Profile data validation
  - Log entry validation
  - Shift template validation
  - Export batch validation

**Key Files to Review**:
- `lib/validation.ts`
- `lib/auth/validation.ts`
- `app/log/new.tsx` (log creation)
- `app/(tabs)/profile.tsx` (profile editing)
- `lib/state/logsStore.ts` (log validation)

### 5. Secrets & Credentials Management

- [ ] **Environment Variables**: Verify:
  - No hardcoded API keys, tokens, or secrets
  - `.env` file is in `.gitignore`
  - `env.example` documents required variables
  - Production secrets use EAS Secrets (not committed)
  - No secrets in logs or error messages

- [ ] **Key Storage**: Check:
  - Encryption keys stored in SecureStore
  - Keys are generated per-install (not hardcoded)
  - Key rotation strategy (if any)

**Key Files to Review**:
- `.env` (should not exist or be gitignored)
- `env.example`
- `lib/supabase.ts` (environment variable usage)
- `lib/utils/encryption.ts` (key generation)

### 6. Logging & Error Handling

- [ ] **Sensitive Data in Logs**: Verify:
  - No PII (emails, names, user IDs) in production logs
  - No tokens or secrets in logs
  - Debug logs only in development mode
  - Error messages don't leak sensitive info
  - Secure logger implementation with masking

- [ ] **Error Handling**: Review:
  - Error boundaries prevent crashes
  - Error messages are user-friendly
  - Stack traces not exposed to users
  - Sensitive errors logged securely

**Key Files to Review**:
- `lib/utils/logger.ts` (logging utility)
- `components/ErrorBoundary.tsx`
- All files using `console.log` or `console.error`

### 7. File & PDF Security

- [ ] **PDF Generation**: Review:
  - PDF content validation
  - File path security (no directory traversal)
  - Cached PDF cleanup
  - PDF sharing security

- [ ] **File Storage**: Check:
  - Cloud storage access controls
  - Local file permissions
  - File deletion on account deletion
  - Storage quota management

**Key Files to Review**:
- `lib/pdf/*.ts` (PDF generation)
- `lib/storage/pdfStorage.ts` (PDF storage)
- `app/export/*.tsx` (export functionality)

### 8. Third-Party Dependencies

- [ ] **Dependency Security**: Check:
  - Known vulnerabilities in `package.json` dependencies
  - Outdated packages with security fixes
  - Trusted package sources
  - License compliance

- [ ] **Third-Party Services**: Review:
  - Supabase security configuration
  - RevenueCat integration security
  - Any other external service integrations

**Key Files to Review**:
- `package.json`
- `lib/subscription/revenuecat.ts`
- Supabase configuration files

### 9. Platform-Specific Security

- [ ] **iOS Security**: Review:
  - Keychain usage
  - App Transport Security (ATS) configuration
  - Background modes security
  - App Store Connect API credentials storage

- [ ] **Android Security**: Review:
  - Keystore usage
  - Network security configuration
  - Backup security (prevent data in backups)
  - ProGuard/R8 obfuscation

**Key Files to Review**:
- `ios/Overtime/Info.plist`
- `android/app/src/main/AndroidManifest.xml`
- `app.config.ts` (Expo config)

### 10. Data Privacy & Compliance

- [ ] **PII Handling**: Verify:
  - Minimal data collection
  - Data retention policies
  - Account deletion completeness
  - Data export functionality
  - Privacy policy compliance

- [ ] **GDPR/Privacy**: Check:
  - User consent mechanisms
  - Right to deletion implementation
  - Data portability
  - Privacy policy links

**Key Files to Review**:
- `app/delete-account.tsx`
- `app/export/*.tsx`
- Data deletion functions in stores

---

## Output Format

For each category, provide:

1. **Critical Issues** (P0): Immediate security risks requiring urgent fixes
2. **High Priority** (P1): Significant security weaknesses that should be addressed soon
3. **Medium Priority** (P2): Security improvements that enhance overall security posture
4. **Low Priority** (P3): Best practice recommendations

For each issue, include:
- **Location**: File path and line numbers
- **Description**: What the issue is
- **Impact**: Potential security consequences
- **Recommendation**: How to fix it
- **Code Example**: If applicable, show before/after code

---

## Additional Context

The app handles sensitive employee data including:
- Work hours and overtime logs
- Personal information (names, emails, payroll numbers)
- Shift patterns and schedules
- PDF exports containing PII

The app must:
- Work offline-first (local SQLite database)
- Sync data with Supabase backend
- Support multiple users (authentication required)
- Generate PDFs for export
- Handle account deletion securely

**Known Security Concerns** (from previous reviews):
- XOR-based encryption for PII (should be upgraded to AES-GCM)
- Some sensitive data may be logged in development
- SQLite data is not encrypted (consider SQLCipher)

---

## Review Instructions

1. Start by examining the authentication and session management code
2. Review data storage and encryption implementations
3. Check API communication and network security
4. Validate input handling and sanitization
5. Audit logging and error handling
6. Review third-party integrations
7. Check platform-specific security configurations
8. Assess data privacy and compliance measures

Provide a prioritized list of security issues with specific recommendations for each.


