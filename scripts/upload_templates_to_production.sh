#!/bin/bash
# Script to upload PDF templates to production Supabase Storage
# Usage: ./scripts/upload_templates_to_production.sh <SUPABASE_URL> <SUPABASE_ANON_KEY>

set -e

SUPABASE_URL="${1:-}"
SUPABASE_ANON_KEY="${2:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Usage: $0 <SUPABASE_URL> <SUPABASE_ANON_KEY>"
  echo "Example: $0 https://your-project.supabase.co eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

# Check if files exist
NORMAL_TEMPLATE="assets/pdf/AVAC template horizontal.pdf"
SMO_TEMPLATE="assets/pdf/SMO AVAC Template.pdf"

if [ ! -f "$NORMAL_TEMPLATE" ]; then
  echo "Error: Normal AVAC template not found at $NORMAL_TEMPLATE"
  exit 1
fi

if [ ! -f "$SMO_TEMPLATE" ]; then
  echo "Error: SMO AVAC template not found at $SMO_TEMPLATE"
  exit 1
fi

echo "Uploading templates to production Supabase Storage..."
echo "URL: $SUPABASE_URL"

# Upload normal AVAC template
echo "Uploading normal AVAC template..."
curl -X POST \
  "${SUPABASE_URL}/storage/v1/object/pdf-templates/avac_normal/v1.pdf" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary "@${NORMAL_TEMPLATE}"

if [ $? -eq 0 ]; then
  echo "✓ Normal AVAC template uploaded successfully"
else
  echo "✗ Failed to upload normal AVAC template"
  exit 1
fi

# Upload SMO AVAC template
echo "Uploading SMO AVAC template..."
curl -X POST \
  "${SUPABASE_URL}/storage/v1/object/pdf-templates/avac_smo/v1.pdf" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary "@${SMO_TEMPLATE}"

if [ $? -eq 0 ]; then
  echo "✓ SMO AVAC template uploaded successfully"
else
  echo "✗ Failed to upload SMO AVAC template"
  exit 1
fi

echo ""
echo "✓ All templates uploaded successfully!"
echo "Next: Seed coordinate mappings in the database"

