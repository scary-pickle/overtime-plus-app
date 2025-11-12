# Production Deployment Guide - OTA Template System

This guide walks you through deploying the OTA template system to your production Supabase database.

## Prerequisites

1. Production Supabase project URL and anon key
2. Access to Supabase Dashboard (SQL Editor)
3. PDF template files in `assets/pdf/`
4. Coordinate mapping JSON files (already generated in `supabase/sql/`)

## Step 1: Create the Database Table

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase/sql/pdf_templates_production.sql`
4. Click **Run** to execute

This will create:
- `pdf_templates` table
- Index for fast lookups
- RLS policy for public read access

## Step 2: Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Name: `pdf-templates`
4. **Public bucket**: ✅ Enable (templates need to be publicly accessible)
5. Click **Create bucket**

## Step 3: Set Up Storage Policies

1. In the `pdf-templates` bucket, go to **Policies**
2. Click **New policy**
3. Create these policies:

### Public Read Policy
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-templates');
```

### Service Role Write Policy (for uploads)
```sql
CREATE POLICY "Service role can upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'pdf-templates');
```

## Step 4: Upload PDF Templates

### Option A: Using the Script (Recommended)

```bash
# Make script executable
chmod +x scripts/upload_templates_to_production.sh

# Run the script
./scripts/upload_templates_to_production.sh \
  "https://your-project.supabase.co" \
  "your-anon-key-here"
```

### Option B: Using Supabase Dashboard

1. Go to **Storage** → **pdf-templates** bucket
2. Click **Upload file**
3. Create folder structure:
   - `avac_normal/v1.pdf` (upload `assets/pdf/AVAC template horizontal.pdf`)
   - `avac_smo/v1.pdf` (upload `assets/pdf/SMO AVAC Template.pdf`)

## Step 5: Seed Coordinate Mappings

### Option A: Using the Python Script (Recommended)

```bash
# Make script executable
chmod +x scripts/seed_production_templates.py

# Run the script
python3 scripts/seed_production_templates.py \
  "https://your-project.supabase.co" \
  "your-anon-key-here"
```

### Option B: Using Supabase SQL Editor

1. Load the coordinate JSON files:
   - `supabase/sql/avac_normal_coords.json`
   - `supabase/sql/avac_smo_coords.json`

2. Run this SQL (replace the JSON with actual content):

```sql
-- Seed normal AVAC template
INSERT INTO public.pdf_templates (template_type, version, pdf_storage_path, coordinate_mapping, is_active)
VALUES (
  'avac_normal',
  'v1',
  'pdf-templates/avac_normal/v1.pdf',
  '{"profile": {...}, "table": {...}}'::jsonb,  -- Replace with actual JSON
  true
)
ON CONFLICT (template_type, version) DO UPDATE SET
  pdf_storage_path = EXCLUDED.pdf_storage_path,
  coordinate_mapping = EXCLUDED.coordinate_mapping,
  is_active = EXCLUDED.is_active;

-- Seed SMO AVAC template
INSERT INTO public.pdf_templates (template_type, version, pdf_storage_path, coordinate_mapping, is_active)
VALUES (
  'avac_smo',
  'v1',
  'pdf-templates/avac_smo/v1.pdf',
  '{"profile": {...}, "table": {...}}'::jsonb,  -- Replace with actual JSON
  true
)
ON CONFLICT (template_type, version) DO UPDATE SET
  pdf_storage_path = EXCLUDED.pdf_storage_path,
  coordinate_mapping = EXCLUDED.coordinate_mapping,
  is_active = EXCLUDED.is_active;
```

## Step 6: Verify Setup

1. **Check table exists:**
```sql
SELECT template_type, version, is_active FROM pdf_templates;
```

2. **Check storage files:**
   - Go to Storage → pdf-templates
   - Verify both PDFs are uploaded

3. **Test API access:**
```bash
curl "https://your-project.supabase.co/rest/v1/pdf_templates?template_type=eq.avac_normal&is_active=is.true" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

## Step 7: Enable OTA in Production

1. Update your production environment variables:
   - `EXPO_PUBLIC_TEMPLATE_OTA=true`
   - Keep `EXPO_PUBLIC_SUPABASE_URL` pointing to production
   - Keep `EXPO_PUBLIC_SUPABASE_ANON_KEY` as production key

2. Rebuild your app with the new environment variables

3. Test with a small user group first

## Troubleshooting

### Templates not downloading
- Check RLS policies allow public read
- Verify storage bucket is public
- Check network connectivity from app

### Coordinate mappings not working
- Verify JSON is valid (use a JSON validator)
- Check coordinate mapping structure matches expected format
- Review app logs for parsing errors

### Upload fails
- Ensure service role key is used for uploads (not anon key)
- Check bucket permissions
- Verify file paths are correct

## Security Notes

- Templates are public (read-only) - this is intentional for OTA updates
- Only service role should have write access
- Coordinate mappings are read-only for users
- Consider rate limiting if needed

## Updating Templates in Production

When you need to update templates:

1. Upload new PDF to storage: `pdf-templates/avac_normal/v2.pdf`
2. Insert new row in database with `version='v2'` and `is_active=true`
3. Set old version `is_active=false`
4. Users will automatically download v2 on next app launch

