# Debugging "Hook requires authorization token" Error

## Current Status

The error "Hook requires authorization token" with status 500 is coming from Supabase's auth system, not our edge function. This suggests the hook configuration might be invalid.

## Steps to Debug

### 1. Verify Hook is Created

Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/auth/hooks

Check if the hook exists:
- If it doesn't exist, create it with the formatted secret
- If it exists, verify the configuration

### 2. Check Function Logs

After trying to sign up, check the function logs:
- Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/functions/auth-signup-guard/logs
- Look for recent log entries
- The function now logs all incoming requests with headers and body

### 3. Verify Secret Format

The hook secret must be in Standard Webhooks format:
```
v1,whsec_8uWRnZb68UxS74XeMFwmktTXlmmf1NW6mQTSHvi8PbWQ7D3cuqCN2ODm+rvn5FrPZQvVGy/ULjLmzlNH
```

### 4. Check What Supabase Actually Sends

The function logs will show:
- What headers are received
- What body is received
- Whether the secret is in the header or body
- What format the secret is in

## Possible Issues

1. **Hook not created**: The hook might not exist in the Dashboard
2. **Wrong secret format**: The secret might not be in `v1,whsec_<base64>` format
3. **Secret mismatch**: The secret in the hook might not match the one in the function's environment variables
4. **Hook not enabled**: The hook might be disabled

## Next Steps

1. Try signing up again
2. Immediately check the function logs
3. Share the log output so we can see what's actually being received
4. Verify the hook exists and is enabled in the Dashboard

