#!/bin/bash

# Script to properly configure the auth-signup-guard hook
# This ensures the secret is properly configured in both the edge function and the hook

set -e

PROJECT_REF="ethllesuiqlomdtctvdh"
FUNCTION_NAME="auth-signup-guard"
HOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"

echo "=========================================="
echo "Auth Signup Guard Hook Configuration"
echo "=========================================="
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

echo "Step 1: Generate or use existing secret"
echo "----------------------------------------"
read -p "Do you want to generate a new secret? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SECRET=$(openssl rand -hex 32)
    echo "✅ Generated new secret: ${SECRET:0:20}..."
else
    read -p "Enter your existing SIGNUP_GUARD_SECRET: " SECRET
fi

if [ -z "$SECRET" ]; then
    echo "❌ Secret cannot be empty"
    exit 1
fi

echo ""
echo "Step 2: Set secrets in Supabase"
echo "----------------------------------------"
echo "Setting secrets via Supabase CLI..."

supabase secrets set --project-ref ${PROJECT_REF} --yes \
  "SIGNUP_GUARD_SECRET=${SECRET}" \
  "REQUIRE_DOMAIN=true" \
  "ALLOWED_DOMAINS=health.qld.gov.au"

if [ $? -eq 0 ]; then
    echo "✅ Secrets set successfully!"
else
    echo "❌ Failed to set secrets. Please set them manually:"
    echo "   1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/functions/${FUNCTION_NAME}/settings"
    echo "   2. Add/update environment variables:"
    echo "      SIGNUP_GUARD_SECRET=${SECRET}"
    echo "      REQUIRE_DOMAIN=true"
    echo "      ALLOWED_DOMAINS=health.qld.gov.au"
    read -p "Press Enter after you've set the secrets..."
fi

echo ""
echo "Step 3: Configure Auth Hook"
echo "----------------------------------------"
echo "⚠️  Manual step required:"
echo "   1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/hooks"
echo "   2. Find or create a hook for 'User Signed Up' event"
echo "   3. Configure:"
echo "      URL: ${HOOK_URL}"
echo "      Method: POST"
echo "      Secret: ${SECRET}"
echo "   4. Save the hook"
echo ""

read -p "Press Enter after you've configured the hook..."

echo ""
echo "Step 4: Deploy edge function"
echo "----------------------------------------"
read -p "Do you want to redeploy the edge function now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying edge function..."
    cd "$(dirname "$0")/.."
    supabase functions deploy ${FUNCTION_NAME} --no-verify-jwt
    echo "✅ Function deployed"
fi

echo ""
echo "=========================================="
echo "✅ Configuration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test signup with allowed email: test@health.qld.gov.au"
echo "2. Test signup with disallowed email: test@gmail.com (should fail)"
echo "3. Check function logs: https://supabase.com/dashboard/project/${PROJECT_REF}/functions/${FUNCTION_NAME}/logs"
echo ""
echo "If you encounter issues:"
echo "- Check the function logs for detailed error messages"
echo "- Verify the secret matches in both the function and hook"
echo "- See PROPER_AUTH_HOOK_SETUP.md for troubleshooting"

