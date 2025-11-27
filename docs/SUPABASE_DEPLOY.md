# Supabase Deployment Guide

This project includes a Supabase schema, storage policies, and an Edge Function to enforce domain-restricted signups.

## Prerequisites
- Supabase project created (e.g., "Overtime +")
- Supabase CLI installed and logged in

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Find your project ref in the Supabase dashboard URL: `https://app.supabase.com/project/<project-ref>/settings/general`.

## Configure Auth
- In Supabase Dashboard → Authentication → Providers:
  - Email: **Enable "Confirm Email" requirement** (required)
  - SMTP: configure a verified sender (SES/Postmark/Resend)
- In Settings → API:
  - Use the new Publishable key in `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Critical: Configure "Confirm sign up" Template for OTP Codes**
  - Dashboard → Authentication → Email Templates → **Confirm sign up** tab
  - Edit the "Confirm sign up" template to show the OTP code instead of a link
  - **Subject heading:** `Your OTP Code`
  - **Message body (Source):** Replace the link with the OTP code:
    ```html
    <h2>Your Verification Code</h2>
    <p>Your one-time verification code is:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #2563EB;">{{ .Token }}</p>
    <p>Enter this 6-digit code in the app to verify your email.</p>
    <p>This code will expire in 1 hour.</p>
    ```
  - **Note:** If `{{ .Token }}` doesn't work, try `{{ .OTP }}`, `{{ .Code }}`, or `{{ .TokenHash }}` - check Supabase docs for your template engine
  - Save the template
 - In Authentication → URL Configuration:
  - Site URL: any valid https URL (can be your future web URL)
  - Additional Redirect URLs: add both `overtime-plus://` and `overtime-plus://auth-callback`
   - Save changes

## Environment
Set these in your app `.env` (or variables):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REDIRECT_SCHEME=overtime-plus`
- `EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=true`

## Deploy Database Schema & Policies
Apply the migration:

```bash
supabase db push
```

This will create tables, triggers, RLS policies, indexes, and RPC `public.ensure_profile()`.

## Create Storage Buckets
In the Dashboard → Storage → Create buckets:
- `attachments` (Private)
- `exports` (Private)

Apply storage policies:

```bash
supabase db query < supabase/storage-policies.sql
```

## Deploy Edge Function
The function rejects signups that are not in allowed domains.

**Important:** Generate a secure random secret for `SIGNUP_GUARD_SECRET`:
```bash
# Generate a secure random secret (32+ characters recommended)
openssl rand -hex 32
```

Deploy the function with environment variables:
```bash
cd supabase/functions/auth-signup-guard
supabase functions deploy auth-signup-guard \
  --no-verify-jwt \
  --env REQUIRE_DOMAIN=true \
  --env ALLOWED_DOMAINS=health.qld.gov.au \
  --env SIGNUP_GUARD_SECRET=<your-generated-secret>
```

**Alternative:** Set secrets via Supabase Dashboard:
1. Go to Dashboard → Edge Functions → `auth-signup-guard` → Settings
2. Add secrets:
   - `REQUIRE_DOMAIN=true`
   - `ALLOWED_DOMAINS=health.qld.gov.au`
   - `SIGNUP_GUARD_SECRET=<your-generated-secret>`

### Configure Auth Hook (OPTIONAL - Database Trigger Recommended)

**⚠️ IMPORTANT:** Due to limitations with Supabase Auth Hooks (they don't easily support custom headers), we recommend using the **Database Trigger** approach instead (see below). The edge function hook is kept for backwards compatibility but may have reliability issues.

If you still want to use the Auth Hook:

1. Go to Dashboard → Authentication → Hooks
2. Create a new hook:
   - **Event:** Pre-signup (if available), otherwise User Signed Up webhook
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/auth-signup-guard`
   - **HTTP Method:** POST
   - **Headers:** Add `Authorization: Bearer <SIGNUP_GUARD_SECRET>` if supported
   - **Body:** If headers aren't supported, you'll need to use a webhook transformer to add `"secret": "<SIGNUP_GUARD_SECRET>"` to the request body

**Note:** The function accepts the secret in multiple formats:
- Authorization header: `Authorization: Bearer <SIGNUP_GUARD_SECRET>` (preferred)
- Request body fields: `secret`, `SIGNUP_GUARD_SECRET`, `auth_secret`, or `webhook_secret`

### Database Trigger (RECOMMENDED)

A more reliable approach is to use a database trigger that validates email domains directly in the database. This doesn't require HTTP calls and is more reliable.

**Apply the migration:**
```bash
supabase db push
```

Or manually run the SQL in Supabase Dashboard → SQL Editor:
```sql
-- See: supabase/migrations/20250120000000_auth_signup_guard_trigger.sql
```

This creates a trigger on `auth.users` that validates email domains before allowing signup. If the domain is not allowed, the signup will be rejected with a clear error message.

**Benefits of Database Trigger:**
- ✅ More reliable (no HTTP calls, no network issues)
- ✅ Faster (runs synchronously in the database)
- ✅ Clearer error messages
- ✅ No secret management needed
- ✅ Works regardless of hook configuration

**Note:** If you use the database trigger, you can disable or remove the Auth Hook. The trigger provides the same protection at the database level.

## App Link Handling
- Ensure `scheme` in `app.config.ts` is `overtime-plus`
- Use `makeRedirectUri` or `Linking.createURL('/')` in the app
- `auth.signUp({ options: { emailRedirectTo } })` uses this URI

## Verification Troubleshooting
- If corporate filters block universal links, users can paste the full URL into the Verify screen
- Provide SMTP with SPF/DKIM/DMARC set on the sender domain

## After Deploy
- Test signup with an allowed domain and verify email flow on-device
- Confirm RLS: users only see their own rows
- Validate signed URL access to Storage is restricted to owners
