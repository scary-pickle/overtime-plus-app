# Local Development with Docker

This guide explains how to use Docker for local Supabase development, keeping your production database safe.

## Quick Start

### 1. Set Up Local Environment

Create a `.env.local` file (gitignored) for local Docker:

```bash
# Copy the example (if you want a template)
cp env.example .env.local

# Edit .env.local with local Docker values:
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54330
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key-from-docker
EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN=false
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_DISABLE_PAYWALL=true
```

### 2. Switch Between Environments

**Switch to LOCAL (Docker):**
```bash
npm run env:local
# or
./scripts/use-local-env.sh
```

**Switch to PRODUCTION:**
```bash
npm run env:production
# or
./scripts/use-production-env.sh
```

The scripts automatically:
- Backup your current `.env` before switching
- Copy the appropriate environment file
- Show you which Supabase URL you're using

## How It Works

- **`.env`** - Active environment file (used by Expo)
- **`.env.local`** - Local Docker configuration (gitignored)
- **`.env.production`** - Production configuration template (optional)
- **`.env.backup`** - Auto-created backup when switching (gitignored)

## Workflow

### Daily Development (Local Docker)

1. Start Docker: `docker-compose up -d`
2. Switch to local: `npm run env:local`
3. **For Release Builds in Xcode:** Run `npx expo prebuild --platform ios --clean`
4. Build in Xcode: Open Xcode and build/archive
5. Test safely - can't break production!

### Testing Production Connection

1. Switch to production: `npm run env:production`
2. **For Release Builds:** Run `npx expo prebuild --platform ios --clean`
3. Build in Xcode
4. Switch back to local: `npm run env:local`
5. Run prebuild again if needed

## Important: Xcode Release Builds

When building **release builds** in Xcode (not debug), environment variables are baked into the app at build time. This means:

1. **Switch environment FIRST** - `npm run env:local` or `npm run env:production`
2. **Run prebuild** - `npx expo prebuild --platform ios --clean`
   - This regenerates native code with the new environment variables
   - Only needed when switching environments, not for every build
3. **Build in Xcode** - Build/Archive as usual

**Why?** Expo reads `.env` when generating native code. For release builds, these values get compiled into the app, so you need to regenerate the native project after switching environments.

**Debug builds** (via `expo start` or Expo Go) read `.env` at runtime, so no prebuild needed.

## Benefits

✅ **No manual .env editing** - just run a script  
✅ **Automatic backups** - your current config is saved  
✅ **Clear warnings** - scripts tell you which environment you're using  
✅ **Safe testing** - local Docker is completely isolated  
✅ **Easy reset** - `docker-compose down -v` wipes local data  

## Docker Commands

```bash
# Start local Supabase
docker-compose up -d

# Stop local Supabase
docker-compose down

# Reset local database (WARNING: deletes all data)
docker-compose down -v

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Getting Local Supabase Credentials

After starting Docker, get your local anon key:

1. Open Supabase Studio: http://localhost:54332
2. Go to Settings > API
3. Copy the "anon" or "publishable" key
4. Add it to `.env.local`

## Notes

- **Xcode rebuilds are unaffected** - Docker runs independently
- **No impact on builds** - it's just a different URL
- **Production builds** - Use EAS Secrets, not `.env` file
- **Team members** - Each creates their own `.env.local`

