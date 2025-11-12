#!/bin/bash
# Deploy OTA template system to production Supabase
# Usage: ./scripts/deploy_to_production.sh <SERVICE_ROLE_KEY>

set -e

SERVICE_ROLE_KEY="${1:-}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Usage: $0 <SERVICE_ROLE_KEY>"
  echo ""
  echo "Get your service role key from:"
  echo "https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/settings/api"
  echo ""
  echo "⚠️  WARNING: Service role key has full database access. Keep it secret!"
  exit 1
fi

SUPABASE_URL="https://ethllesuiqlomdtctvdh.supabase.co"
SQL_FILE="supabase/sql/pdf_templates_production.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "Deploying to production Supabase..."
echo "URL: $SUPABASE_URL"
echo ""

# Execute SQL using Supabase Management API
echo "Step 1: Creating pdf_templates table and policies..."
SQL_CONTENT=$(cat "$SQL_FILE" | sed "s/'/''/g")

# Use psql via Supabase connection string
# First, let's try using the Supabase CLI db execute command
if command -v supabase &> /dev/null; then
  echo "Using Supabase CLI..."
  # We'll need to link the project first, but for now let's use direct API
  echo "Note: You may need to link your project first with: supabase link --project-ref ethllesuiqlomdtctvdh"
fi

# Alternative: Use direct PostgreSQL connection
# We can construct the connection string from the service role key
# But Supabase doesn't expose direct PostgreSQL access easily

# Best approach: Use the SQL Editor API if available, or guide user to use CLI
echo ""
echo "Since direct SQL execution via API is restricted, please use one of these methods:"
echo ""
echo "METHOD 1: Supabase CLI (Recommended)"
echo "  1. Run: supabase link --project-ref ethllesuiqlomdtctvdh"
echo "  2. When prompted, enter your service role key"
echo "  3. Then run: supabase db execute --file supabase/sql/pdf_templates_production.sql"
echo ""
echo "METHOD 2: Supabase Dashboard"
echo "  1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new"
echo "  2. Copy contents of: $SQL_FILE"
echo "  3. Paste and run"
echo ""

# But let's try to use the Management API if it supports SQL execution
echo "Attempting to execute SQL via Management API..."

# Note: Supabase Management API doesn't have a direct SQL execution endpoint
# We'll need to use psql or the CLI

echo ""
echo "For now, please run the SQL manually in the dashboard, then I'll help with the rest!"
echo "SQL file location: $SQL_FILE"

