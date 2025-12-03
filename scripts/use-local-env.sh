#!/bin/bash
# Switch to local Docker environment
# This copies .env.local to .env (if .env.local exists)
# For Xcode release builds, you'll need to run prebuild after switching

set -e

if [ ! -f ".env.local" ]; then
  echo "❌ .env.local not found!"
  echo ""
  echo "To set up local development:"
  echo "  1. Create .env.local with your local Supabase Docker credentials:"
  echo "     EXPO_PUBLIC_SUPABASE_URL=http://localhost:54330"
  echo "     EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key"
  echo "  2. Run this script again"
  exit 1
fi

# Backup current .env if it exists
if [ -f ".env" ]; then
  cp .env .env.backup
  echo "✅ Backed up current .env to .env.backup"
fi

# Copy .env.local to .env
cp .env.local .env
echo "✅ Switched to LOCAL environment (Docker)"
echo ""
echo "Current Supabase URL:"
grep "EXPO_PUBLIC_SUPABASE_URL" .env | head -1 || echo "  (not found in .env)"
echo ""
echo "⚠️  IMPORTANT for Xcode Release Builds:"
echo "   After switching environments, run:"
echo "   npx expo prebuild --platform ios --clean"
echo ""
echo "   This regenerates native code with the new environment variables."
echo "   Then build in Xcode as usual."
echo ""
echo "To switch back to production, run: ./scripts/use-production-env.sh"

