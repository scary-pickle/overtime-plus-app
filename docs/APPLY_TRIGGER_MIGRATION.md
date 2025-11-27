# Apply Auth Signup Guard Database Trigger

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh
   - Or navigate to your project in the Supabase dashboard

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the SQL**
   - Open the file: `supabase/migrations/20250120000000_auth_signup_guard_trigger.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the SQL**
   - Click the "Run" button (or press Cmd+Enter / Ctrl+Enter)
   - You should see a success message

5. **Verify it worked**
   - Go to Database → Functions
   - Look for `auth.validate_signup_email()` function
   - Go to Database → Triggers  
   - Look for `validate_signup_email_trigger` on `auth.users` table

6. **Test signup**
   - Try signing up with an allowed email (e.g., `test@health.qld.gov.au`) - should work
   - Try signing up with a disallowed email (e.g., `test@gmail.com`) - should fail with error: "Email domain 'gmail.com' is not allowed..."

## What This Does

- Creates a database trigger that validates email domains **before** a user is created
- Only allows signups from `health.qld.gov.au` email addresses
- Rejects signups from other domains with a clear error message
- More reliable than edge function hooks (no network calls, no timeouts)

## After Applying

Once the trigger is working, you can optionally:
- Disable the Auth Hook in Dashboard → Authentication → Hooks (the trigger handles validation now)
- The edge function `auth-signup-guard` can remain deployed but won't be called if the hook is disabled

## Troubleshooting

If you get permission errors:
- Make sure you're running the SQL in the Supabase Dashboard SQL Editor (it has elevated privileges)
- The SQL must be run as a user with access to the `auth` schema

If the trigger doesn't work:
- Check the function exists: `SELECT * FROM pg_proc WHERE proname = 'validate_signup_email';`
- Check the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'validate_signup_email_trigger';`


