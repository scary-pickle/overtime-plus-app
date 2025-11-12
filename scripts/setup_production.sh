#!/bin/bash
# Complete production setup script
# Usage: ./scripts/setup_production.sh <SERVICE_ROLE_KEY>

set -e

SERVICE_ROLE_KEY="${1:-}"
PROJECT_REF="ethllesuiqlomdtctvdh"
SUPABASE_URL="https://ethllesuiqlomdtctvdh.supabase.co"
ANON_KEY="sb_publishable_7D7j2G1eLsZjQV9zWTBJcQ_zc5TtUFu"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Usage: $0 <SERVICE_ROLE_KEY>"
  echo ""
  echo "Get your service role key from:"
  echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
  echo ""
  echo "⚠️  WARNING: Service role key has full database access. Keep it secret!"
  exit 1
fi

echo "🚀 Setting up OTA templates in production..."
echo "Project: $PROJECT_REF"
echo ""

# Step 1: Link project (if not already linked)
echo "Step 1: Linking Supabase project..."
if supabase link --project-ref "$PROJECT_REF" --password "$SERVICE_ROLE_KEY" 2>/dev/null; then
  echo "✓ Project linked"
else
  echo "⚠ Project may already be linked or linking failed"
  echo "Continuing..."
fi

# Step 2: Execute SQL
echo ""
echo "Step 2: Creating pdf_templates table..."
if supabase db execute --file supabase/sql/pdf_templates_production.sql --project-ref "$PROJECT_REF" 2>/dev/null; then
  echo "✓ Table created successfully"
else
  echo "⚠ SQL execution via CLI failed"
  echo "Please run the SQL manually in the dashboard:"
  echo "https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
  echo ""
  echo "SQL file: supabase/sql/pdf_templates_production.sql"
  read -p "Press Enter after you've run the SQL..."
fi

# Step 3: Create storage bucket (via API)
echo ""
echo "Step 3: Creating storage bucket..."
BUCKET_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pdf-templates",
    "public": true,
    "file_size_limit": 52428800,
    "allowed_mime_types": ["application/pdf"]
  }')

if echo "$BUCKET_RESPONSE" | grep -q "already exists\|created"; then
  echo "✓ Storage bucket created or already exists"
else
  echo "⚠ Bucket creation response: $BUCKET_RESPONSE"
  echo "You may need to create it manually in the dashboard"
fi

# Step 4: Set storage policies
echo ""
echo "Step 4: Setting up storage policies..."
POLICY_SQL="CREATE POLICY IF NOT EXISTS \"Public read access\"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-templates');"

# Note: Storage policies need to be set via SQL or dashboard
echo "⚠ Storage policies need to be set manually"
echo "Go to: https://supabase.com/dashboard/project/$PROJECT_REF/storage/buckets/pdf-templates/policies"
echo "Add policy: Public read access"

# Step 5: Upload PDFs
echo ""
echo "Step 5: Uploading PDF templates..."
if [ -f "assets/pdf/AVAC template horizontal.pdf" ] && [ -f "assets/pdf/SMO AVAC Template.pdf" ]; then
  echo "Uploading normal AVAC template..."
  curl -X POST \
    "$SUPABASE_URL/storage/v1/object/pdf-templates/avac_normal/v1.pdf" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/pdf" \
    --data-binary "@assets/pdf/AVAC template horizontal.pdf" \
    -w "\n" -s -o /dev/null && echo "✓ Normal AVAC uploaded" || echo "✗ Upload failed"
  
  echo "Uploading SMO AVAC template..."
  curl -X POST \
    "$SUPABASE_URL/storage/v1/object/pdf-templates/avac_smo/v1.pdf" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/pdf" \
    --data-binary "@assets/pdf/SMO AVAC Template.pdf" \
    -w "\n" -s -o /dev/null && echo "✓ SMO AVAC uploaded" || echo "✗ Upload failed"
else
  echo "⚠ PDF files not found in assets/pdf/"
fi

# Step 6: Seed coordinate mappings
echo ""
echo "Step 6: Seeding coordinate mappings..."
python3 scripts/seed_production_templates.py "$SUPABASE_URL" "$ANON_KEY"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify table exists: Check Supabase Dashboard → Table Editor → pdf_templates"
echo "2. Verify storage: Check Storage → pdf-templates bucket"
echo "3. Test in app: Set EXPO_PUBLIC_TEMPLATE_OTA=true and test template download"

