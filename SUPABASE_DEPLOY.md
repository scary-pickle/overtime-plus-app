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

```bash
cd supabase/functions/auth-signup-guard
supabase functions deploy auth-signup-guard \
  --no-verify-jwt \
  --env REQUIRE_DOMAIN=true \
  --env ALLOWED_DOMAINS=health.qld.gov.au
```

Hook it to Auth events (Dashboard → Authentication → Hooks):
- Pre-signup (if available), otherwise User Signed Up webhook → URL:
  - `https://<project-ref>.functions.supabase.co/auth-signup-guard`

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
