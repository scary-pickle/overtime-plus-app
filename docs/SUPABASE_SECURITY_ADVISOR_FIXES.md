# Supabase Security Advisor Warnings - Review & Fixes

This document reviews and addresses the security warnings from Supabase Security Advisor.

## Summary of Warnings

1. **Function Search Path Mutable** (3 warnings)
   - `set_remote_flag_updated_at`
   - `set_updated_at`
   - `ensure_profile`

2. **Leaked Password Protection Disabled** (1 warning)
   - Auth configuration issue

---

## 1. Function Search Path Mutable

### Issue
Functions without a fixed `search_path` are vulnerable to search path manipulation attacks. An attacker could potentially manipulate the search path to execute malicious code by creating functions or objects in schemas that appear earlier in the search path.

### Risk Level
**WARN** - External facing security issue

### Functions Affected

1. **`public.set_updated_at()`**
   - Location: `supabase/migrations/20251103_init.sql`
   - Purpose: Trigger function to update `updated_at` timestamp
   - Used by: Multiple tables (profiles, shifts, overtime_logs, export_batches, attachments)

2. **`public.set_remote_flag_updated_at()`**
   - Location: `supabase/migrations/20251115235959_add_subscription_and_paywall_support.sql`
   - Purpose: Trigger function to update `updated_at` timestamp for remote_feature_flags
   - Used by: `remote_feature_flags` table

3. **`public.ensure_profile()`**
   - Location: `supabase/migrations/20251103_init.sql`
   - Purpose: RPC function to ensure a profile exists for the authenticated user
   - Used by: Client applications for profile creation

### Fix Applied

Created migration: `supabase/migrations/20251201000000_fix_function_search_path.sql`

All three functions have been updated to include `SET search_path = ''` which:
- Prevents search path manipulation attacks
- Forces explicit schema qualification for all objects
- Maintains existing functionality (functions use built-in `now()` and qualified `auth.uid()`)

### Migration Details

```sql
-- All functions now include: set search_path = ''
-- This ensures the search path cannot be manipulated by callers
```

### Verification

After applying the migration, verify:
1. Functions still work correctly (triggers fire, RPC calls succeed)
2. Security Advisor warnings are resolved
3. No regressions in application functionality

---

## 2. Leaked Password Protection Disabled

### Issue
Supabase Auth's leaked password protection (HaveIBeenPwned integration) is currently disabled. This feature prevents users from using passwords that have been compromised in data breaches.

### Risk Level
**WARN** - External facing security issue

### Impact
- Users can set passwords that are known to be compromised
- Increased risk of account compromise if users reuse breached passwords
- Reduced security posture

### Fix Required

**Manual configuration in Supabase Dashboard:**

1. Navigate to: **Authentication → Settings → Password**
2. Enable: **"Leaked password protection"** or **"HaveIBeenPwned integration"**
3. Save changes

### Documentation
- [Supabase Password Security Guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### Additional Recommendations

While enabling leaked password protection, also consider:
- **Password strength requirements**: Ensure minimum complexity rules are configured
- **Password history**: Prevent reuse of recent passwords
- **Rate limiting**: Already handled by Supabase Auth, but verify it's enabled

---

## Implementation Steps

### 1. Apply Database Migration

```bash
# If using Supabase CLI locally
supabase db push

# Or apply directly in production
supabase db push --db-url <production-connection-string>
```

### 2. Verify Functions

After migration, test that:
- Triggers still update `updated_at` timestamps correctly
- `ensure_profile()` RPC still works for new users
- No errors in application logs

### 3. Enable Leaked Password Protection

1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Password" section
3. Enable "Leaked password protection"
4. Save changes

### 4. Re-run Security Advisor

After fixes:
1. Go to Supabase Dashboard → Database → Security Advisor
2. Re-run the security scan
3. Verify warnings are resolved

---

## Security Best Practices

### Function Security

When creating new database functions:
- Always include `SET search_path = ''` or `SET search_path = 'public'`
- Use `security definer` only when necessary (e.g., `ensure_profile`)
- Fully qualify schema references (e.g., `public.profiles`, `auth.uid()`)
- Document why `security definer` is needed if used

### Example Safe Function Pattern

```sql
create or replace function public.example_function()
returns void 
language plpgsql 
security definer  -- Only if needed
set search_path = ''  -- Always include this
as $$
begin
  -- Use fully qualified names
  insert into public.some_table(...)
  values (...);
end; $$;
```

---

## References

- [Supabase Database Linter - Function Search Path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [PostgreSQL Search Path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)

---

## Status

- ✅ **Function Search Path Fixes**: Migration created (`20251201000000_fix_function_search_path.sql`)
- ⚠️ **Leaked Password Protection**: Requires manual dashboard configuration

---

**Last Updated**: 2025-12-01




