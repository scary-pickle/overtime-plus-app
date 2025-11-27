# Proper Auth Signup Guard Configuration

This guide provides the **correct, secure** way to configure the auth-signup-guard.

## The Problem

Supabase Auth Hooks have limitations:
- They don't easily support custom headers
- The hook configuration UI may not expose all options
- The secret needs to be sent securely

## Solution: Use Database Webhooks (RECOMMENDED)

Database Webhooks are more reliable and support custom headers/body transformations.

### Step 1: Get Your Secret

1. Go to **Dashboard → Edge Functions → auth-signup-guard → Settings**
2. Find or set the `SIGNUP_GUARD_SECRET` environment variable
3. Copy the secret value (or generate a new one: `openssl rand -hex 32`)

### Step 2: Configure Database Webhook

1. Go to **Dashboard → Database → Webhooks**
2. Click **"Create a new webhook"**
3. Configure:
   - **Name:** `auth-signup-guard`
   - **Table:** `auth.users`
   - **Events:** Select `INSERT` only
   - **HTTP Request:**
     - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
     - **Method:** `POST`
     - **Headers:**
       ```
       Content-Type: application/json
       Authorization: Bearer <YOUR_SIGNUP_GUARD_SECRET>
       ```
     - **Body (JSON):**
       ```json
       {
         "user": {
           "email": "{{record.email}}",
           "id": "{{record.id}}"
         }
       }
       ```

4. Click **"Save"**

### Step 3: Update Edge Function to Handle Post-Creation

Since Database Webhooks fire AFTER user creation, we need to update the edge function to delete the user if validation fails.

**However, there's a better approach:** Use the webhook to call the function, and if it returns an error, we can handle it. But actually, for a PRE-signup check, we need to prevent creation.

## Better Solution: Use Supabase Auth Hook with Secret Field

Supabase Auth Hooks DO support a "Secret" field in the Dashboard. Let's use that properly:

### Step 1: Configure Auth Hook with Secret

1. Go to **Dashboard → Authentication → Hooks**
2. Find or create the hook for `auth-signup-guard`
3. Configure:
   - **Event:** "User Signed Up" (or "Pre-signup" if available)
   - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
   - **HTTP Method:** `POST`
   - **Secret:** Enter your `SIGNUP_GUARD_SECRET` value here
     - This field exists in Supabase's Auth Hook configuration
     - Supabase will automatically send this as `Authorization: Bearer <secret>`

4. Save the hook

### Step 2: Verify the Secret is Set

1. Go to **Dashboard → Edge Functions → auth-signup-guard → Settings**
2. Ensure `SIGNUP_GUARD_SECRET` is set to the same value as in the hook
3. Ensure `REQUIRE_DOMAIN=true` and `ALLOWED_DOMAINS=health.qld.gov.au` are set

### Step 3: Test

1. Try signing up with `test@health.qld.gov.au` - should succeed
2. Try signing up with `test@gmail.com` - should fail with "Email domain not allowed"

## Alternative: Use Supabase CLI to Configure Hook

If the Dashboard doesn't expose the secret field, you can use the Supabase Management API or CLI:

```bash
# Get your project's access token from Dashboard → Settings → API
export SUPABASE_ACCESS_TOKEN="your-access-token"
export PROJECT_REF="ethllesuiqlomdtctvdh"
export SECRET="your-signup-guard-secret"

# Create/update the hook via API
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/auth/hooks" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_signed_up",
    "url": "https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard",
    "secret": "'"${SECRET}"'"
  }'
```

## Verification

After configuration, check the edge function logs:
1. Go to **Dashboard → Edge Functions → auth-signup-guard → Logs**
2. Try a signup
3. You should see logs showing the request was received and validated
4. If secret validation fails, you'll see detailed logs about what was received

## Troubleshooting

**If you still get "Unauthorized":**
1. Check the edge function logs to see what headers/body were received
2. Verify the secret in the hook matches the secret in the function's environment variables
3. Ensure the hook is sending the secret in the `Authorization` header

**If signups are blocked even for allowed domains:**
1. Check the function logs for email validation errors
2. Verify `ALLOWED_DOMAINS` includes the domain you're testing
3. Check `REQUIRE_DOMAIN` is set correctly


