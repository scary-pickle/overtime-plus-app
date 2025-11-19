-- Auth signup guard: Database function to validate email domains
-- 
-- NOTE: Creating triggers on auth.users requires superuser privileges which may not be
-- available in Supabase Dashboard SQL Editor. This function can be used with:
-- 1. Database Webhooks (recommended - see instructions below)
-- 2. Edge function hooks (configured properly)
-- 3. Client-side validation (less secure, but works)
--
-- For the most reliable solution, use Database Webhooks to call the edge function
-- with the secret in the request body.

-- Function to validate email domain (in public schema - no special permissions needed)
create or replace function public.validate_email_domain(email_address text)
returns boolean
language plpgsql
security definer
as $$
declare
  user_email text;
  email_domain text;
  allowed_domains text[];
  require_domain boolean := true;
begin
  -- Get email
  user_email := lower(coalesce(email_address, ''));
  
  -- If no email, reject
  if user_email = '' then
    return false;
  end if;
  
  -- Extract domain using regex
  email_domain := substring(user_email from '@(.+)$');
  
  -- Define allowed domains
  allowed_domains := array['health.qld.gov.au'];
  
  -- If domain validation is disabled, allow all
  if not require_domain then
    return true;
  end if;
  
  -- Check if email domain is in allowed list
  if email_domain is null or email_domain = '' then
    return false;
  end if;
  
  return email_domain = any(allowed_domains);
end;
$$;

-- Grant execute permission
grant execute on function public.validate_email_domain(text) to anon, authenticated, service_role;

-- ============================================================================
-- ALTERNATIVE: Database Webhook Configuration (RECOMMENDED)
-- ============================================================================
-- Since we can't create triggers on auth.users without superuser privileges,
-- use Database Webhooks instead:
--
-- 1. Go to Supabase Dashboard → Database → Webhooks
-- 2. Create a new webhook:
--    - Name: "auth-signup-guard"
--    - Table: auth.users
--    - Events: INSERT
--    - HTTP Request:
--      - URL: https://<project-ref>.supabase.co/functions/v1/auth-signup-guard
--      - Method: POST
--      - Headers: 
--        - Content-Type: application/json
--      - Body (JSON):
--        {
--          "secret": "<YOUR_SIGNUP_GUARD_SECRET>",
--          "user": {
--            "email": "{{record.email}}",
--            "id": "{{record.id}}"
--          }
--        }
-- 3. The edge function will validate the email domain and return an error if not allowed
-- 4. Note: This runs AFTER user creation, so you may need to delete the user if validation fails
--
-- ============================================================================
-- BETTER ALTERNATIVE: Fix the Auth Hook Configuration
-- ============================================================================
-- The edge function has been updated to accept the secret in multiple formats.
-- Configure the Auth Hook properly:
--
-- 1. Go to Dashboard → Authentication → Hooks
-- 2. Edit the existing hook or create new one
-- 3. URL: https://<project-ref>.supabase.co/functions/v1/auth-signup-guard
-- 4. Method: POST
-- 5. If the hook supports custom headers, add: Authorization: Bearer <SIGNUP_GUARD_SECRET>
-- 6. If not, you'll need to use a webhook transformer to add the secret to the body
--
-- The edge function now checks for the secret in:
-- - Authorization header
-- - body.secret
-- - body.SIGNUP_GUARD_SECRET
-- - body.auth_secret
-- - body.webhook_secret

