# Production Environment Variables Checklist

## Required Variables

All production environment variables must be set before building. Use EAS Secrets for production builds.

### Critical (Required)
- ✅ `EXPO_PUBLIC_SUPABASE_URL` - Production Supabase project URL
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Production Supabase anon/publishable key
- ✅ `EXPO_PUBLIC_REDIRECT_SCHEME` - Deep link scheme (default: `overtime-plus`)

### Optional but Recommended
- `EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN` - Set to `true` to restrict signups to @health.qld.gov.au
- `EXPO_PUBLIC_TEMPLATE_OTA` - Set to `true` to enable OTA template updates
- `EXPO_PUBLIC_APP_NAME` - App name (default: `Overtime+`)
- `EXPO_PUBLIC_APP_VERSION` - App version (default: `1.0.0`)

### Development Only
- `EXPO_PUBLIC_DEBUG_MODE` - Set to `false` for production
- `EXPO_PUBLIC_LOG_LEVEL` - Set to `info` for production

## Verification Steps

1. **Local Development (.env file)**
   - ✅ `.env` file exists (gitignored)
   - ⚠️ Verify `.env` contains production values for testing
   - ⚠️ Never commit `.env` to git

2. **EAS Build (EAS Secrets)**
   - ⚠️ Set `EXPO_PUBLIC_SUPABASE_URL` as EAS secret
   - ⚠️ Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS secret
   - ⚠️ Verify secrets are set: `eas secret:list`

3. **Production Build Verification**
   - ⚠️ Test build with production profile
   - ⚠️ Verify app connects to production Supabase
   - ⚠️ Verify no development URLs are used

## Notes

- All variables are documented in `env.example`
- Use `eas secret:create` to set production secrets
- Production builds should use EAS Secrets, not `.env` file
- Local development uses `.env` file (gitignored)





