# Auth Signup Guard - Configuration Steps

## Generated Secret

A secure secret has been generated for you. Use this same secret in both places below.

**Secret:** (Check the terminal output above, or generate a new one with: `openssl rand -hex 32`)

## Step 1: Set Secret in Edge Function

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/settings

2. In the "Environment Variables" section, add or update:
   - **Name:** `SIGNUP_GUARD_SECRET`
   - **Value:** (paste the secret from above)

3. Also ensure these environment variables are set:
   - `REQUIRE_DOMAIN` = `true`
   - `ALLOWED_DOMAINS` = `health.qld.gov.au`

4. Click **"Save"** or **"Update"**

## Step 2: Configure Auth Hook

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/auth/hooks

2. Find the existing hook for `auth-signup-guard` OR create a new one:
   - Click **"Create a new hook"** if none exists
   - Or click **"Edit"** on the existing hook

3. Configure the hook:
   - **Event:** Select "User Signed Up" (or "Pre-signup" if available)
   - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
     - ⚠️ **CRITICAL:** Use this exact format: `<project-ref>.supabase.co/functions/v1/<function-name>`
     - ❌ **WRONG:** `<project-ref>.functions.supabase.co/<function-name>`
   - **HTTP Method:** `POST`
   - **Secret:** `v1,whsec_<YOUR_SECRET_HERE>` (get this from your environment variables or generate a new one)
     - This is the Standard Webhooks format secret
     - Must match the `SIGNUP_GUARD_SECRET` environment variable exactly

4. Click **"Save"** or **"Update"**

## Step 3: Verify Configuration

1. Check the edge function logs:
   - Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/logs

2. Test signup:
   - Try signing up with `test@health.qld.gov.au` - should succeed ✅
   - Try signing up with `test@gmail.com` - should fail with "Email domain not allowed" ❌

3. If signup fails, check the function logs for detailed error messages

## Troubleshooting

**If you get "Unauthorized" error:**
- Verify the secret in the hook matches the secret in the edge function settings
- Check the function logs to see what headers/body were received
- Ensure the hook is configured to send the secret

**If signups are blocked for allowed domains:**
- Check `ALLOWED_DOMAINS` includes the domain you're testing
- Verify `REQUIRE_DOMAIN=true` is set correctly
- Check function logs for email validation errors

**If the hook doesn't have a "Secret" field:**
- Some Supabase projects may not expose this field in the UI
- You may need to use the Supabase Management API or contact support
- Alternative: Use Database Webhooks (see PROPER_AUTH_HOOK_SETUP.md)

## Next Steps

Once configured, the auth-signup-guard will:
- ✅ Validate email domains before allowing signup
- ✅ Only allow `health.qld.gov.au` email addresses
- ✅ Reject signups from other domains with a clear error message
- ✅ Work securely with proper secret validation

