#!/bin/bash
# Execute SQL in production using service role key via Supabase CLI
# Usage: ./scripts/run_production_sql.sh <SERVICE_ROLE_KEY>

set -e

SERVICE_ROLE_KEY="${1:-}"
PROJECT_REF="ethllesuiqlomdtctvdh"
SQL_FILE="supabase/sql/pdf_templates_production.sql"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Usage: $0 <SERVICE_ROLE_KEY>"
  echo ""
  echo "Get your service role key from:"
  echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "Executing SQL in production..."
echo "Project: $PROJECT_REF"
echo ""

# Method 1: Try using Supabase CLI with db push
# First check if project is linked
if supabase projects list 2>/dev/null | grep -q "$PROJECT_REF"; then
  echo "Project is linked. Executing SQL..."
  supabase db execute --file "$SQL_FILE" --project-ref "$PROJECT_REF"
else
  echo "Project not linked. Linking now..."
  echo "You'll be prompted for your database password or service role key"
  echo ""
  echo "Please run these commands manually:"
  echo "  1. supabase link --project-ref $PROJECT_REF"
  echo "     (When prompted, use your service role key)"
  echo "  2. supabase db execute --file $SQL_FILE --project-ref $PROJECT_REF"
  echo ""
  echo "Or use the Supabase Dashboard SQL Editor:"
  echo "  https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
fi

