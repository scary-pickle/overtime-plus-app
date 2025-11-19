# Fix Auth Hook Configuration - Step by Step

## Problem
Supabase is rejecting signups with "Hook requires authorization token" (500 error) **before** the request even reaches our edge function. This happens because the Auth Hook isn't properly configured with the secret.

## Solution: Configure the Hook with Standard Webhooks Secret

### Step 1: Get the Correct Secret

The secret you need to configure in the hook should be in Standard Webhooks format:
```
v1,whsec_<YOUR_BASE64_ENCODED_SECRET>
```

This is the **base64-encoded bytes** format (not the hex string). Get this value from your environment variables or generate a new one.

### Step 2: Configure the Hook in Supabase Dashboard

1. **Go to Auth Hooks:**
   - Navigate to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/auth/hooks
   - Or: Dashboard → Authentication → Hooks

2. **Edit or Create the Hook:**
   - If a hook exists for `auth-signup-guard`, click "Edit"
   - If no hook exists, click "Create Hook" or "Add Hook"

3. **Configure the Hook:**
   - **Hook Type:** Select "HTTPS" or "HTTP Webhook" (NOT PostgreSQL)
   - **Event:** Select "User Signed Up" or "Before User Created" (if available)
   - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
     - ⚠️ **IMPORTANT:** Use this exact format: `<project-ref>.supabase.co/functions/v1/<function-name>`
     - ❌ **WRONG:** `<project-ref>.functions.supabase.co/<function-name>`
   - **HTTP Method:** `POST`
   - **Secret:** `v1,whsec_<YOUR_SECRET_HERE>` (get from environment variables)
     - This is the Standard Webhooks format secret
     - Supabase will use this to sign the webhook requests
     - Must match the `SIGNUP_GUARD_SECRET` environment variable exactly

4. **Save the Hook:**
   - Click "Save" or "Create"
   - Make sure the hook is **enabled** (toggle should be ON)

### Step 3: Verify the Configuration

1. **Check Hook Status:**
   - The hook should show as "Active" or "Enabled"
   - Verify the URL is correct
   - Verify the secret is set (it may be masked/redacted in the UI)

2. **Verify Edge Function Secret:**
   - The edge function's `SIGNUP_GUARD_SECRET` environment variable should be set to the same value as the hook secret
   - Format: `v1,whsec_<YOUR_SECRET_HERE>`
   - Must match the hook secret exactly

### Step 4: Test the Signup

1. **Wait 1-2 minutes** for the hook configuration to propagate
2. **Try signing up** with an allowed email (e.g., `test@health.qld.gov.au`)
3. **Check the function logs:**
   - Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/logs
   - You should see:
     - "REQUEST RECEIVED" log
     - "Using secret for signature verification" log
     - "Webhook signature verified successfully" log (if working)
     - Or detailed error logs if still failing

## How It Works

1. **User signs up** → Supabase Auth receives the signup request
2. **Supabase checks hook configuration** → If hook is configured with a secret, Supabase signs the request using Standard Webhooks format
3. **Supabase calls your edge function** → With signed request (includes `webhook-signature`, `webhook-timestamp`, `webhook-id` headers)
4. **Edge function verifies signature** → Uses the same secret to verify the signature matches
5. **Edge function validates email domain** → If signature is valid, checks if email domain is allowed
6. **Edge function returns response** → `{ ok: true }` allows signup, error rejects it

## Troubleshooting

### If you still get "Hook requires authorization token":

1. **Verify the hook secret is set:**
   - Go back to the hook configuration
   - Make sure the secret field has the format: `v1,whsec_<base64_encoded_secret>`
   - The secret must be in this exact format (Standard Webhooks format)
   - Must match the `SIGNUP_GUARD_SECRET` environment variable

2. **Check if the hook is enabled:**
   - Make sure the hook toggle is ON/Enabled

3. **Verify the URL is correct:**
   - Must be: `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
   - Not: `https://ethllesuiqlomdtctvdh.functions.supabase.co/auth-signup-guard`

4. **Check function logs:**
   - If you see "REQUEST RECEIVED" logs, the hook is calling the function (good!)
   - If you don't see any logs, Supabase is rejecting before calling (hook config issue)

### If signature verification fails:

1. **Check the function logs** for signature previews
2. **Verify both secrets match:**
   - Hook secret: `v1,whsec_<YOUR_SECRET_HERE>`
   - Function env var: `v1,whsec_<YOUR_SECRET_HERE>` (must be identical)
   - Both should be in Standard Webhooks format
3. **Wait for propagation** - secrets may take 1-2 minutes to propagate

## Alternative: Database Trigger (If Hook Still Fails)

If the hook configuration continues to fail, you can use a database trigger instead:

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new
2. Run the SQL from: `supabase/migrations/20250120000000_auth_signup_guard_trigger.sql`
3. Disable or delete the Auth Hook
4. The database trigger will handle validation without needing webhook secrets

