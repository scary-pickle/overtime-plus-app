# Domain Restriction Status

## ⚠️ Current Status: DISABLED (Testing Mode)

**Date Set:** November 20, 2025  
**Current Values:**
- Server-side: `REQUIRE_DOMAIN=false` (Supabase secret)
- Client-side: `EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false` (in `.env` file)

**Status:** Domain restriction is **DISABLED** - signups from any email domain are currently allowed.

## 🚨 CRITICAL: Before Production Release

**You MUST re-enable domain restriction before releasing to production!**

When `REQUIRE_DOMAIN=false`, anyone with any email address can sign up for your app. This is only acceptable during testing.

## How to Re-enable Domain Restriction

### Step 1: Set server-side REQUIRE_DOMAIN back to true

Run this command in your terminal:

```bash
supabase secrets set REQUIRE_DOMAIN=true --project-ref ethllesuiqlomdtctvdh
```

### Step 2: Set client-side EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN back to true

Update your `.env` file:

```bash
# In your .env file, change:
EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false
# to:
EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=true
```

Or use this command:
```bash
sed -i '' 's/^EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false$/EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=true/' .env
```

**Important:** After changing the `.env` file, you must restart your development server for the change to take effect.

### Step 3: Verify the changes

Check that the server-side secret is set correctly:

```bash
supabase secrets list --project-ref ethllesuiqlomdtctvdh
```

You should see `REQUIRE_DOMAIN` with a recent timestamp.

Verify the client-side variable:
```bash
grep EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN .env
```

### Step 3: Test with a disallowed email

After re-enabling, test that domain restriction works:
- Try signing up with `test@gmail.com` - should **fail** with "Email domain not allowed" ❌
- Try signing up with `test@health.qld.gov.au` - should **succeed** ✅

## How Domain Restriction Works

When `REQUIRE_DOMAIN=true`:
- ✅ Only emails from `@health.qld.gov.au` domain can sign up
- ❌ All other email domains are rejected

When `REQUIRE_DOMAIN=false`:
- ✅ Any email domain can sign up (testing mode only)

## Related Configuration

The allowed domains are configured in the `ALLOWED_DOMAINS` secret:
- Current value: `health.qld.gov.au`
- To change allowed domains, update this secret:
  ```bash
  supabase secrets set ALLOWED_DOMAINS="health.qld.gov.au,example.com" --project-ref ethllesuiqlomdtctvdh
  ```

## Quick Reference Commands

```bash
# Disable domain restriction (testing only)
# Server-side:
supabase secrets set REQUIRE_DOMAIN=false --project-ref ethllesuiqlomdtctvdh
# Client-side:
sed -i '' 's/^EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=true$/EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false/' .env
# Then restart your dev server

# Enable domain restriction (production)
# Server-side:
supabase secrets set REQUIRE_DOMAIN=true --project-ref ethllesuiqlomdtctvdh
# Client-side:
sed -i '' 's/^EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false$/EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=true/' .env
# Then restart your dev server

# View all secrets
supabase secrets list --project-ref ethllesuiqlomdtctvdh

# Check if logged in to Supabase CLI
supabase projects list
```

## Pre-Production Checklist

Before releasing to production, verify:

- [ ] Server-side: `REQUIRE_DOMAIN` secret is set to `true`
- [ ] Client-side: `EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN` in `.env` is set to `true`
- [ ] `ALLOWED_DOMAINS` is set to `health.qld.gov.au`
- [ ] Development server has been restarted after changing `.env`
- [ ] Test signup with allowed email succeeds
- [ ] Test signup with disallowed email fails
- [ ] Check edge function logs to confirm domain validation is working

## Notes

- **Server-side secrets** take effect immediately (no redeploy needed)
- **Client-side environment variables** require restarting the development server
- Secrets are project-wide and apply to all Edge Functions
- Make sure you're logged in to Supabase CLI: `supabase login`
- There are **two separate places** to configure domain restriction:
  1. Server-side: Supabase secret `REQUIRE_DOMAIN` (validates in edge function)
  2. Client-side: Environment variable `EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN` (validates in app before sending request)

