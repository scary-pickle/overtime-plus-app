# Deployment Guide - Overtime+

This guide covers deployment procedures for the Overtime+ app, including EAS Build configuration and environment variable setup.

## EAS Build Setup

### Prerequisites

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to your Expo account:
```bash
eas login
```

3. Link your project (if not already linked):
```bash
eas build:configure
```

### Environment Variables (EAS Secrets)

**IMPORTANT:** Never commit production credentials to git. Use EAS Secrets for all sensitive environment variables.

#### Required Secrets

1. **EXPO_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Format: `https://your-project-id.supabase.co`
   - Get from: Supabase Dashboard → Settings → API → Project URL

2. **EXPO_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/publishable key
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Get from: Supabase Dashboard → Settings → API → Project API keys → `anon` / `public` key

#### Setting EAS Secrets

Set secrets for your project:

```bash
# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project-id.supabase.co"

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key-here"
```

#### Viewing Secrets

List all secrets:
```bash
eas secret:list
```

#### Updating Secrets

Update an existing secret:
```bash
eas secret:update --name EXPO_PUBLIC_SUPABASE_URL --value "https://new-url.supabase.co"
```

#### Deleting Secrets

Remove a secret:
```bash
eas secret:delete --name EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Build Profiles

EAS Build uses build profiles defined in `eas.json`. Create or update this file:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-dev-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-dev-anon-key"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

**Note:** For production builds, prefer using EAS Secrets instead of hardcoding values in `eas.json`.

### Building the App

#### Development Build
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

#### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

#### Production Build
```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

#### Build for Both Platforms
```bash
eas build --profile production --platform all
```

### Local Development

For local development, create a `.env` file in the project root (this file is gitignored):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** 
- Never commit `.env` files to git
- Use `env.example` as a template
- For production builds, use EAS Secrets instead

## Security Checklist

Before deploying to production:

- [ ] All environment variables are set in EAS Secrets (not hardcoded)
- [ ] `.env` file is in `.gitignore`
- [ ] No credentials are committed to git history
- [ ] Supabase storage buckets are private with proper RLS policies
- [ ] Rate limits and CAPTCHA are enabled in Supabase Dashboard
- [ ] HTTPS validation is enabled (validates Supabase URL uses HTTPS)
- [ ] Field-level encryption is enabled for PII (initials, email)
- [ ] PDF cache cleanup is configured (30-day TTL)

## Troubleshooting

### Build Fails with "Missing Environment Variable"

If your build fails because environment variables are missing:

1. Check that secrets are set:
   ```bash
   eas secret:list
   ```

2. Verify the secret names match exactly (case-sensitive):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. For local builds, ensure `.env` file exists with the required variables

### Supabase Connection Issues

If the app can't connect to Supabase:

1. Verify the Supabase URL is correct and uses HTTPS
2. Check that the anon key is valid (not expired or rotated)
3. Ensure RLS policies allow access for authenticated users
4. Check Supabase Dashboard logs for authentication errors

### Encryption Errors

If encryption/decryption fails:

1. Check that SecureStore is accessible (device permissions)
2. Verify encryption key exists in SecureStore
3. Check for corrupted encrypted data (may need to clear and re-encrypt)

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Supabase Documentation](https://supabase.com/docs)





