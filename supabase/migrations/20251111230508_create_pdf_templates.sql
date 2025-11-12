-- pdf_templates schema for OTA AVAC templates (PRODUCTION)
-- Run this in your production Supabase SQL editor

-- Create table
create table if not exists public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('avac_normal','avac_smo')),
  version text not null,
  pdf_storage_path text not null,
  coordinate_mapping jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure one active version per template type
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

-- Note: Write access should be restricted to service role only
-- Templates should be updated via Supabase Dashboard or service role API calls

