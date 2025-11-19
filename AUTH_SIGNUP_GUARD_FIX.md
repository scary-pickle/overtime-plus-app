# Auth Signup Guard Fix

## Problem
The auth-signup-guard was failing with "Hook requires authorization token" or "Network request failed" errors when trying to sign up new users.

## Root Cause
Supabase Auth Hooks have limitations:
1. They don't easily support custom headers (like `Authorization: Bearer <secret>`)
2. They may timeout or fail if the edge function takes too long
3. The hook configuration may not properly pass the secret to the edge function

## Solution: Database Trigger (Recommended)

We've implemented a **database trigger** that validates email domains directly in the database. This is more reliable than edge function hooks.

### Steps to Fix

1. **Apply the database migration:**
   ```bash
   supabase db push
   ```
   
   Or manually run the SQL in Supabase Dashboard → SQL Editor:
   - Open `supabase/migrations/20250120000000_auth_signup_guard_trigger.sql`
   - Copy the contents
   - Paste into SQL Editor and run

2. **Verify the trigger is created:**
   - Go to Supabase Dashboard → Database → Functions
   - Look for `auth.validate_signup_email()`
   - Go to Database → Triggers
   - Look for `validate_signup_email_trigger` on `auth.users`

3. **Test signup:**
   - Try signing up with an allowed email (e.g., `test@health.qld.gov.au`) - should succeed
   - Try signing up with a disallowed email (e.g., `test@gmail.com`) - should fail with clear error

4. **Optional: Disable Auth Hook**
   - If you're using the database trigger, you can disable the Auth Hook
   - Go to Dashboard → Authentication → Hooks
   - Disable or delete the hook for `auth-signup-guard`
   - The database trigger will handle validation

## Alternative: Fix Edge Function Hook

If you prefer to keep using the edge function hook:

1. **Redeploy the edge function** (with improved error handling):
   ```bash
   cd supabase/functions/auth-signup-guard
   supabase functions deploy auth-signup-guard --no-verify-jwt
   ```

2. **Configure the hook properly:**
   - Go to Dashboard → Authentication → Hooks
   - Edit the existing hook or create a new one
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/auth-signup-guard`
   - **Method:** POST
   - **Headers:** If supported, add `Authorization: Bearer <SIGNUP_GUARD_SECRET>`
   - **Body Transformer:** If headers aren't supported, configure a transformer to add:
     ```json
     {
       "secret": "<SIGNUP_GUARD_SECRET>",
       ...existing_body
     }
     ```

3. **Check edge function logs:**
   - Go to Dashboard → Edge Functions → `auth-signup-guard` → Logs
   - Look for error messages that indicate what's wrong
   - The function now logs more details about failed secret validation

## Why Database Trigger is Better

- ✅ **More reliable:** No network calls, no timeouts
- ✅ **Faster:** Runs synchronously in the database
- ✅ **Clearer errors:** Direct database exceptions with clear messages
- ✅ **No secrets needed:** No need to manage `SIGNUP_GUARD_SECRET` for the trigger
- ✅ **Always works:** Doesn't depend on hook configuration

## Configuration

The database trigger currently allows only `health.qld.gov.au` emails. To change this:

1. Edit `supabase/migrations/20250120000000_auth_signup_guard_trigger.sql`
2. Update the `allowed_domains` array:
   ```sql
   allowed_domains := array['health.qld.gov.au', 'example.com'];
   ```
3. Re-run the migration

Or update the function directly in SQL Editor:
```sql
-- Update the function to allow multiple domains
create or replace function auth.validate_signup_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_email text;
  email_domain text;
  allowed_domains text[];
  require_domain boolean := true;
begin
  user_email := lower(coalesce(new.email, ''));
  if user_email = '' then
    raise exception 'Email is required for signup';
  end if;
  
  email_domain := substring(user_email from '@(.+)$');
  allowed_domains := array['health.qld.gov.au', 'your-other-domain.com']; -- Update here
  
  if not require_domain then
    return new;
  end if;
  
  if email_domain is null or email_domain = '' then
    raise exception 'Invalid email format';
  end if;
  
  if not (email_domain = any(allowed_domains)) then
    raise exception 'Email domain "%" is not allowed. Only the following domains are permitted: %', 
      email_domain, array_to_string(allowed_domains, ', ');
  end if;
  
  return new;
end;
$$;
```

