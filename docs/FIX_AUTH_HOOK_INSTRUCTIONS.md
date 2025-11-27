# Fix Auth Signup Guard - Alternative Solutions

Since creating triggers on `auth.users` requires superuser privileges that aren't available in the SQL Editor, here are working alternatives:

## Solution 1: Fix the Auth Hook Configuration (EASIEST)

The edge function has been updated to be more flexible. Let's configure the Auth Hook properly:

### Steps:

1. **Get your SIGNUP_GUARD_SECRET**
   - Go to Dashboard → Edge Functions → `auth-signup-guard` → Settings
   - Find the `SIGNUP_GUARD_SECRET` environment variable
   - Copy the value (or generate a new one if needed)

2. **Configure the Auth Hook**
   - Go to Dashboard → Authentication → Hooks
   - Find the existing hook for `auth-signup-guard` or create a new one
   - **Event:** "User Signed Up" or "Pre-signup" (if available)
   - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
   - **Method:** POST

3. **Add the Secret**
   
   **Option A: If hook supports custom headers:**
   - Add header: `Authorization: Bearer <YOUR_SIGNUP_GUARD_SECRET>`
   
   **Option B: If hook doesn't support headers (most common):**
   - You'll need to use Supabase's webhook transformer feature
   - Or configure the hook to send the secret in the body
   - The edge function now accepts the secret in these body fields:
     - `secret`
     - `SIGNUP_GUARD_SECRET`
     - `auth_secret`
     - `webhook_secret`

4. **Test the hook**
   - Try signing up with `test@health.qld.gov.au` - should work
   - Try signing up with `test@gmail.com` - should fail

## Solution 2: Use Database Webhooks (MORE RELIABLE)

Database Webhooks can call the edge function with the secret in the request body:

1. **Go to Dashboard → Database → Webhooks**
2. **Create New Webhook:**
   - **Name:** `auth-signup-guard`
   - **Table:** `auth.users`
   - **Events:** `INSERT`
   - **HTTP Request:**
     - **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
     - **Method:** `POST`
     - **Headers:**
       - `Content-Type: application/json`
     - **Body (JSON):**
       ```json
       {
         "secret": "<YOUR_SIGNUP_GUARD_SECRET>",
         "user": {
           "email": "{{record.email}}",
           "id": "{{record.id}}"
         }
       }
       ```

3. **Note:** This runs AFTER user creation, so the edge function would need to delete the user if validation fails. You may need to update the edge function to handle this.

## Solution 3: Client-Side Validation (LEAST SECURE - NOT RECOMMENDED)

The function `public.validate_email_domain(email)` has been created and can be called from the client, but this is not secure as it can be bypassed. Only use for UX purposes, not security.

## Recommended Approach

**Use Solution 1** - Fix the Auth Hook configuration. The edge function has been updated to be more flexible and should work once the secret is properly configured.

If that doesn't work, **Solution 2** (Database Webhooks) is more reliable but requires updating the edge function to delete users if validation fails.

## Testing

After configuring, test signup:
- ✅ Allowed email: `test@health.qld.gov.au` - should succeed
- ❌ Disallowed email: `test@gmail.com` - should fail with error message

## Troubleshooting

**If you still get "Hook requires authorization token":**
- Check the edge function logs: Dashboard → Edge Functions → `auth-signup-guard` → Logs
- The function now logs more details about what it receives
- Make sure the secret is being sent in one of the accepted formats

**If signups are still failing:**
- Check the edge function is deployed: `supabase functions deploy auth-signup-guard --no-verify-jwt`
- Verify the `SIGNUP_GUARD_SECRET` is set in the function's environment variables
- Check the function logs for detailed error messages


