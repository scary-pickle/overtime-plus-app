# Xcode Release Build Workflow

Quick reference for building release builds in Xcode with environment switching.

## The Problem

When building **release builds** in Xcode, environment variables (`EXPO_PUBLIC_*`) are **baked into the app at build time**. This means:

- You can't change them after building
- You need to regenerate native code when switching environments
- The `.env` file must be correct **before** building

## Quick Workflow

### Switch to Local Docker (for safe testing)

```bash
# 1. Switch environment
npm run env:local

# 2. Regenerate native code with new env vars
npm run prebuild:ios

# 3. Build in Xcode
# Open Xcode → Product → Archive
```

### Switch to Production (for real builds)

```bash
# 1. Switch environment
npm run env:production

# 2. Regenerate native code with new env vars
npm run prebuild:ios

# 3. Build in Xcode
# Open Xcode → Product → Archive
```

## Step-by-Step

### Before Building

1. **Check your environment:**
   ```bash
   cat .env | grep EXPO_PUBLIC_SUPABASE_URL
   ```
   - Should show `http://localhost:54330` for local
   - Should show `https://your-project.supabase.co` for production

2. **Switch if needed:**
   ```bash
   npm run env:local      # or
   npm run env:production
   ```

3. **Regenerate native code:**
   ```bash
   npm run prebuild:ios
   ```
   - This reads your `.env` file and bakes values into native code
   - Only needed when **switching environments**, not every build

### Building in Xcode

1. Open Xcode: `open ios/Overtime.xcworkspace`
2. Select **Any iOS Device (arm64)** in device selector
3. **Product → Archive**
4. Wait for build to complete
5. Submit to TestFlight/App Store

## When Do You Need Prebuild?

✅ **Run prebuild when:**
- Switching from local to production (or vice versa)
- First time setting up
- After changing environment variables

❌ **Skip prebuild when:**
- Building multiple times with same environment
- Just changing code (not env vars)
- Using debug builds via `expo start`

## Verification

After switching and prebuilding, verify the values are correct:

```bash
# Check what's in your .env
cat .env | grep EXPO_PUBLIC_SUPABASE_URL

# Check what got baked into native code
grep -r "localhost:54330" ios/ || echo "Not using local (good for production)"
grep -r "supabase.co" ios/ | head -1 || echo "Not using production"
```

## Common Mistakes

❌ **Building with wrong environment:**
- Forgot to switch before building
- Solution: Always check `.env` before building

❌ **Not running prebuild after switching:**
- Switched `.env` but didn't regenerate native code
- Solution: Always run `npm run prebuild:ios` after switching

❌ **Building production with local env:**
- Accidentally testing on production database
- Solution: Scripts warn you, but double-check the URL

## Tips

- **Set up `.env.production`** once with production values
- **Set up `.env.local`** once with Docker values
- Scripts automatically backup your current `.env` before switching
- Use `npm run env:local` / `npm run env:production` - don't manually edit `.env`

## Full Example

```bash
# Morning: Test locally with Docker
docker-compose up -d
npm run env:local
npm run prebuild:ios
# Build in Xcode → Test on device

# Afternoon: Build for TestFlight
npm run env:production
npm run prebuild:ios
# Build in Xcode → Archive → Submit
```


