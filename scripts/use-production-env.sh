#!/bin/bash
# Switch to production environment
# This restores .env from .env.production or .env.backup
# For Xcode release builds, you'll need to run prebuild after switching

set -e

# Check if we have a backup
if [ -f ".env.backup" ]; then
  cp .env.backup .env
  rm .env.backup
  echo "✅ Switched to PRODUCTION environment (from backup)"
elif [ -f ".env.production" ]; then
  cp .env.production .env
  echo "✅ Switched to PRODUCTION environment (from .env.production)"
else
  echo "⚠️  No production environment file found!"
  echo ""
  echo "Options:"
  echo "  1. Create .env.production with your production values"
  echo "  2. Or manually update .env with production Supabase URL"
  echo ""
  echo "Current .env file exists - make sure it has production values:"
  if [ -f ".env" ]; then
    grep "EXPO_PUBLIC_SUPABASE_URL" .env | head -1 || echo "  (no SUPABASE_URL found)"
  fi
  exit 1
fi

echo ""
echo "Current Supabase URL:"
grep "EXPO_PUBLIC_SUPABASE_URL" .env | head -1 || echo "  (not found in .env)"
echo ""
echo "⚠️  WARNING: You are now connected to PRODUCTION!"
echo ""
echo "⚠️  IMPORTANT for Xcode Release Builds:"
echo "   After switching environments, run:"
echo "   npx expo prebuild --platform ios --clean"
echo ""
echo "   This regenerates native code with the new environment variables."
echo "   Then build in Xcode as usual."
echo ""
echo "To switch back to local Docker, run: ./scripts/use-local-env.sh"

