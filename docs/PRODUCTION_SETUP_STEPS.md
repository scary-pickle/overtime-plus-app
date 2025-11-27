# Production Setup - Step by Step

## Your Production Credentials
- **URL**: https://ethllesuiqlomdtctvdh.supabase.co
- **Anon Key**: sb_publishable_7D7j2G1eLsZjQV9zWTBJcQ_zc5TtUFu

## Step 1: Create the Database Table

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new
2. Copy and paste this SQL:

```sql
-- pdf_templates schema for OTA AVAC templates (PRODUCTION)
create table if not exists public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('avac_normal','avac_smo')),
  version text not null,
  pdf_storage_path text not null,
  coordinate_mapping jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_type, version)
);

-- Index for quick lookups
create index if not exists pdf_templates_active_idx
  on public.pdf_templates (template_type, is_active);

-- RLS: allow public read (templates should be accessible to all users)
alter table public.pdf_templates enable row level security;

-- Drop existing policy if it exists
drop policy if exists "pdf_templates_read" on public.pdf_templates;

-- Create policy for public read access
create policy "pdf_templates_read"
  on public.pdf_templates
  for select
  to anon, authenticated
  using (true);
```

3. Click **Run** (or press Cmd+Enter)
4. You should see "Success. No rows returned"

## Step 2: Create Storage Bucket

1. Go to: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/storage/buckets
2. Click **New bucket**
3. Name: `pdf-templates`
4. **Public bucket**: ✅ Enable (check this box!)
5. Click **Create bucket**

## Step 3: Set Up Storage Policies

1. Click on the `pdf-templates` bucket
2. Go to **Policies** tab
3. Click **New policy**
4. Select **For full customization**, then paste this SQL:

```sql
-- Public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-templates');
```

5. Click **Review** then **Save policy**

## Step 4: Upload PDF Templates

I'll help you with this next - we'll use the upload script.

## Step 5: Seed Coordinate Mappings

I'll help you with this after the uploads complete.

---

**Once you've completed Steps 1-3, let me know and I'll proceed with Steps 4-5!**

