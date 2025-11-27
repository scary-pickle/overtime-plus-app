# Database & Infrastructure Verification Checklist

## Database Migrations

### Migration Files
The following migration files exist in `supabase/migrations/`:
- `20251103_init.sql` - Initial schema
- `20250108120000_add_exports_storage_policies.sql` - Storage policies
- `20250108120001_create_exports_bucket.sql` - Exports bucket
- `20250108120002_storage_setup_complete.sql` - Storage setup
- `20250110_fix_rls_for_soft_delete_v2.sql` - Soft delete RLS fixes
- `20250110_fix_soft_delete_policies.sql` - Soft delete policies
- `20250110_fix_soft_delete_rls.sql` - Soft delete RLS
- `20250110120000_fix_rls_for_soft_delete_v2.sql` - RLS fixes v2
- `20251111230508_create_pdf_templates.sql` - PDF templates table

### Verification Steps

1. **Check Migration Status**
   - ⚠️ Open Supabase Dashboard → Database → Migrations
   - ⚠️ Verify all migrations listed above are applied
   - ⚠️ Check for any failed migrations

2. **Manual SQL Scripts (Production Only)**
   These scripts need to be run manually in production Supabase SQL Editor:
   
   - ⚠️ `supabase/sql/pdf_templates_production.sql`
     - Creates `pdf_templates` table
     - Sets up RLS policies for public read access
     - Run in: Supabase Dashboard → SQL Editor
   
   - ⚠️ `supabase/sql/storage_policy_production.sql`
     - Creates public read policy for `pdf-templates` bucket
     - Run in: Supabase Dashboard → SQL Editor

## Supabase Configuration

### Production Project Verification

1. **Project Status**
   - ⚠️ Verify production Supabase project is active
   - ⚠️ Check project URL matches `EXPO_PUBLIC_SUPABASE_URL`
   - ⚠️ Verify API keys are correct

2. **Storage Buckets**
   - ⚠️ Verify `exports` bucket exists
   - ⚠️ Verify `pdf-templates` bucket exists (if using OTA templates)
   - ⚠️ Check bucket policies:
     - `exports` should be private with RLS policies
     - `pdf-templates` should have public read access

3. **RLS Policies**
   - ⚠️ Verify Row Level Security is enabled on:
     - `overtime_logs` table
     - `shifts` table
     - `export_batches` table
     - `profiles` table
     - `pdf_templates` table (if created)
   - ⚠️ Verify policies enforce `auth.uid()` ownership checks

4. **Edge Functions** (if applicable)
   - ⚠️ Verify `auth-signup-guard` function is deployed
   - ⚠️ Check function logs for errors
   - ⚠️ Verify function has correct environment variables

### OTA Template System (Optional)

If `EXPO_PUBLIC_TEMPLATE_OTA=true`:
- ⚠️ Verify `pdf-templates` storage bucket exists
- ⚠️ Verify `pdf_templates` table exists
- ⚠️ Test template download in app
- ⚠️ Verify templates are accessible via public URL

## Verification Commands

### Check Migration Status
```bash
# If using Supabase CLI locally
supabase db diff
supabase migration list
```

### Verify Storage Buckets
```sql
-- Run in Supabase SQL Editor
SELECT name, public FROM storage.buckets;
```

### Verify RLS Policies
```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Notes

- All migrations should be applied in order
- Production SQL scripts must be run manually (not via CLI)
- Storage buckets must exist before app can upload/download files
- RLS policies are critical for data security






