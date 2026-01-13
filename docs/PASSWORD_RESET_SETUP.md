# Password Reset Flow Setup Guide

## Overview
This guide explains how the password reset flow works and how to ensure it's properly configured.

## How It Works

1. **User requests password reset**: User enters email on `/auth/forgot-password` screen
2. **Email sent**: Supabase sends an email with a reset link containing tokens
3. **User clicks link**: Opens the app via deep link `overtime-plus://auth-callback#access_token=...&refresh_token=...&type=recovery`
4. **App detects reset**: Deep link handler recognizes `type=recovery` and routes to `/auth/reset-password`
5. **User sets new password**: Screen authenticates with tokens, then user enters new password
6. **Password updated**: App calls `updateUser({ password })` to complete the reset

## Configuration Required

### 1. App Configuration (`app.config.ts`)
✅ URL scheme is configured: `scheme: 'overtime-plus'`
✅ iOS URL scheme is registered in `infoPlist.CFBundleURLTypes`

### 2. Supabase Configuration

#### Local Development (`supabase/config.toml`)
```toml
[auth]
additional_redirect_urls = [
  "https://127.0.0.1:3000",
  "overtime-plus://auth-callback",
  "overtime-plus://auth/reset-password"
]
```

#### Production (Supabase Dashboard)
**CRITICAL**: You must add the redirect URLs in your production Supabase project:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add these redirect URLs:
   - `overtime-plus://auth-callback`
   - `overtime-plus://auth/reset-password`

### 3. Code Configuration

#### Redirect URI (`lib/auth/deeplinks.ts`)
```typescript
export function getRedirectUri(): string {
  return 'overtime-plus://auth-callback';
}
```

#### Deep Link Handler
The handler automatically:
- Detects password reset links (`type=recovery`)
- Parses tokens from URL fragments
- Routes to `/auth/reset-password` screen

## Troubleshooting

### Issue: "Safari cannot open the page because the address is invalid"

**Cause**: Safari doesn't recognize the custom URL scheme. This can happen if:
1. The app isn't installed on the device
2. The URL scheme isn't properly registered in the iOS app
3. The app needs to be rebuilt after adding URL scheme configuration

**Solutions**:

1. **Rebuild the app**: After adding URL scheme configuration, you must rebuild the app:
   ```bash
   # For development
   npx expo run:ios
   
   # For production
   eas build --platform ios
   ```

2. **Verify URL scheme is registered**: Check that `app.config.ts` has:
   ```typescript
   scheme: 'overtime-plus',
   ios: {
     infoPlist: {
       CFBundleURLTypes: [
         {
           CFBundleURLSchemes: ['overtime-plus'],
           CFBundleURLName: 'com.overtimeplus.app',
         },
       ],
     }
   }
   ```

3. **Test the deep link**: After rebuilding, test if the app opens with:
   ```bash
   # On iOS Simulator
   xcrun simctl openurl booted "overtime-plus://auth-callback?type=recovery&access_token=test&refresh_token=test"
   ```

4. **Check Supabase redirect URLs**: Ensure the redirect URLs are added in:
   - Local: `supabase/config.toml`
   - Production: Supabase Dashboard → Authentication → URL Configuration

### Issue: Link opens but app doesn't navigate to reset screen

**Cause**: Deep link handler might not be detecting the password reset flow.

**Solution**: Check that:
1. The URL contains `type=recovery` parameter
2. The `handlePasswordResetLink` function is being called
3. The router is navigating to `/auth/reset-password`

### Issue: Tokens are invalid or expired

**Cause**: Password reset tokens expire after a certain time (default: 1 hour).

**Solution**: Request a new password reset email.

## Testing

### Test Password Reset Flow

1. **Request reset**:
   - Go to `/auth/forgot-password`
   - Enter your email
   - Click "Send reset link"

2. **Check email**:
   - Open the email from Supabase
   - The link should look like: `https://[project].supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=overtime-plus://auth-callback`

3. **Click link**:
   - On iOS: Should open the app and navigate to reset password screen
   - If Safari error appears: App needs to be rebuilt with URL scheme

4. **Set new password**:
   - Enter new password
   - Confirm password
   - Click "Update password"

5. **Sign in**:
   - Should redirect to sign-in screen
   - Sign in with new password

## Production Checklist

Before deploying to production:

- [ ] URL scheme is configured in `app.config.ts`
- [ ] App has been rebuilt with URL scheme configuration
- [ ] Redirect URLs are added in Supabase Dashboard (production project)
- [ ] Test password reset flow on a physical device
- [ ] Verify email links work correctly
- [ ] Test on both iOS and Android (if applicable)

## Notes

- Password reset tokens expire after 1 hour (Supabase default)
- The deep link handler automatically detects password reset flows
- The reset password screen handles token validation and password update
- After password reset, user is redirected to sign-in screen
