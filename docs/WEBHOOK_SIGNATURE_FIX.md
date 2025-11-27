# Webhook Signature Verification Failure - Root Cause & Fix

## Problem Summary

Sign-ups are failing with the error: **"Hook requires authorization token"**

This happens because:
1. Supabase Auth Hook sends a webhook signature with the request
2. The edge function tries to verify this signature using the `SIGNUP_GUARD_SECRET` environment variable
3. **The signature verification fails** because the secrets don't match
4. The function rejects the request with a 401 error

## Root Cause

The webhook signature verification is failing because **the secret configured in the Auth Hook doesn't match the secret in the edge function's environment variable**.

From the logs:
- `signaturePreview: "OgsPG5mpi4..."`
- `computedPreview: "8IdIyJ2jBy..."`
- These don't match, indicating the secrets are different

## Solution: Ensure Secrets Match

You need to ensure **both** of these use the **exact same secret**:

### 1. Auth Hook Secret
- Location: Supabase Dashboard → Authentication → Hooks → auth-signup-guard
- Should be: `v1,whsec_<YOUR_SECRET_HERE>` (get this from your Supabase dashboard or generate a new one)

### 2. Edge Function Environment Variable
- Location: Supabase Dashboard → Edge Functions → auth-signup-guard → Settings → Environment Variables
- Variable name: `SIGNUP_GUARD_SECRET`
- Should be: `v1,whsec_<YOUR_SECRET_HERE>` (must match the hook secret exactly)

## Step-by-Step Fix

### Step 1: Verify Auth Hook Configuration

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/auth/hooks
2. Find the hook for `auth-signup-guard`
3. Click "Edit"
4. Check the **Secret** field:
   - It should be in format: `v1,whsec_<base64_encoded_secret>`
   - If it's different or empty, generate a new secret or use the one from your environment variables
5. Verify the URL is: `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
6. Make sure the hook is **enabled**
7. Click "Save"

### Step 2: Verify Edge Function Environment Variable

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/settings
2. Scroll to "Environment Variables"
3. Find `SIGNUP_GUARD_SECRET`
4. Check the value:
   - It should be in format: `v1,whsec_<base64_encoded_secret>` (must match the hook secret exactly)
   - If it's different or missing, add/update it to match the hook secret
5. Click "Save"

### Step 3: Redeploy the Edge Function (if you made code changes)

If you've updated the edge function code, redeploy it:

```bash
cd supabase/functions/auth-signup-guard
supabase functions deploy auth-signup-guard --no-verify-jwt
```

### Step 4: Test

1. Wait 1-2 minutes for configuration to propagate
2. Try signing up with an allowed email (e.g., `test@health.qld.gov.au`)
3. Check the function logs:
   - Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/logs
   - You should see: `[auth-signup-guard] Webhook signature verified successfully`
   - If you still see signature verification failures, the secrets still don't match

## How It Works

1. **User signs up** → Supabase Auth receives the signup request
2. **Supabase checks hook configuration** → If hook has a secret, Supabase signs the request using Standard Webhooks format
3. **Supabase calls edge function** → With signed request (includes `webhook-signature`, `webhook-timestamp`, `webhook-id` headers)
4. **Edge function verifies signature** → Uses `SIGNUP_GUARD_SECRET` to compute the expected signature and compares it
5. **If signatures match** → Function validates email domain and allows/rejects signup
6. **If signatures don't match** → Function returns 401 error

## Troubleshooting

### If signature verification still fails:

1. **Double-check both secrets are identical:**
   - Copy the secret from the Auth Hook
   - Paste it into the edge function's `SIGNUP_GUARD_SECRET` environment variable
   - Make sure there are no extra spaces or characters

2. **Check the function logs for detailed error messages:**
   - Look for `signaturePreview` and `computedPreview` values
   - If they're different, the secrets don't match

3. **Try regenerating the secret:**
   - Generate a new secret: `openssl rand -base64 32`
   - Format it as: `v1,whsec_<base64_value>`
   - Update both the Auth Hook and edge function with the new secret

4. **Verify the hook is enabled:**
   - Make sure the hook toggle is ON in the Dashboard

## Alternative: Use Database Trigger (If Hook Continues to Fail)

If the webhook signature verification continues to be problematic, you can use a database trigger instead:

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new
2. Run the SQL from: `supabase/migrations/20250120000000_auth_signup_guard_trigger.sql`
3. Disable or delete the Auth Hook
4. The database trigger will handle validation without needing webhook secrets

## Important: REQUIRE_DOMAIN and ALLOWED_DOMAINS

**These are NOT secrets** - they are configuration values for email domain validation:
- `REQUIRE_DOMAIN`: Set to `true` or `false` (whether to enforce domain restrictions)
- `ALLOWED_DOMAINS`: Comma-separated list of allowed email domains (e.g., `health.qld.gov.au`)

They do NOT need to match any secret. They are separate configuration options.

## Code Changes Made

The edge function has been updated to:
- **Try multiple secret formats**:
  - Format 1: Base64-decoded bytes from `v1,whsec_<base64>` (Standard Webhooks spec)
  - Format 2: Full secret string as UTF-8 (including `v1,whsec_` prefix)
  - Format 3: Just the base64 part as UTF-8 (without decoding)
- **Try multiple signature payload formats**: 
  - Format 1: `timestamp.body` (Standard Webhooks)
  - Format 2: `webhookId.timestamp.body` (Alternative format)
- This means we try **6 different combinations** (3 secret formats × 2 payload formats) to find the correct one
- Provide better error messages when signature verification fails
- Include detailed debugging information showing which combinations were tried
- Support fallback authentication methods in development mode

