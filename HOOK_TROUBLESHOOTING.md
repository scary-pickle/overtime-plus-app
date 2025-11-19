# Troubleshooting "Hook requires authorization token" Error

## Current Issue

The error "Hook requires authorization token" with status 500 is coming from **Supabase's auth system**, not our edge function. This means the request isn't even reaching our function.

## Diagnosis Steps

### 1. Check if Request Reaches Function

After trying to sign up, check the function logs:
- Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/logs
- Look for any logs starting with `[auth-signup-guard]`
- **If NO logs appear**: The request isn't reaching the function (hook configuration issue)
- **If logs appear**: The request is reaching the function (authentication issue)

### 2. Verify Hook Configuration

Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/auth/hooks

Check:
- ✅ Hook exists and is **enabled**
- ✅ Event is set to "User Signed Up" or "Pre-signup"
- ✅ URL is: `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
- ✅ Method is: `POST`
- ✅ Secret is set to: `v1,whsec_8uWRnZb68UxS74XeMFwmktTXlmmf1NW6mQTSHvi8PbWQ7D3cuqCN2ODm+rvn5FrPZQvVGy/ULjLmzlNH`

### 3. Verify Secret in Environment Variables

The secret in the edge function environment variables should match the hook secret:
- Secret: `v1,whsec_8uWRnZb68UxS74XeMFwmktTXlmmf1NW6mQTSHvi8PbWQ7D3cuqCN2ODm+rvn5FrPZQvVGy/ULjLmzlNH`
- This is what we set via CLI (Standard Webhooks format)

### 4. Possible Issues

**Issue 1: Hook Not Created**
- If the hook doesn't exist, create it with the formatted secret above

**Issue 2: Hook Disabled**
- Make sure the hook is enabled (not disabled)

**Issue 3: Wrong Secret Format**
- The hook secret must be: `v1,whsec_<base64_encoded_secret>`
- The environment variable secret should match: `v1,whsec_8uWRnZb68UxS74XeMFwmktTXlmmf1NW6mQTSHvi8PbWQ7D3cuqCN2ODm+rvn5FrPZQvVGy/ULjLmzlNH`

**Issue 4: Hook URL Wrong**
- Must be: `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
- Not: `https://ethllesuiqlomdtctvdh.functions.supabase.co/auth-signup-guard`

## Next Steps

1. **Check function logs** - Do you see any `[auth-signup-guard]` logs?
2. **Verify hook exists and is enabled** in the Dashboard
3. **Try deleting and recreating the hook** with the correct secret format
4. **Check Supabase status** - Is there a known issue with Auth Hooks?

If the request still doesn't reach the function, the issue is with Supabase's hook system itself, not our code.

