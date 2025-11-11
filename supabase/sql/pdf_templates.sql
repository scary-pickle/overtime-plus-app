-- pdf_templates schema for OTA AVAC templates (local Supabase only)
create table if not exists public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('avac_normal','avac_smo')),
  version text not null,
  pdf_storage_path text not null,
  coordinate_mapping jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index for quick lookups
create index if not exists pdf_templates_active_idx
  on public.pdf_templates (template_type, is_active);

-- RLS: allow read for authenticated users; write restricted (adjust locally only)
alter table public.pdf_templates enable row level security;
do $$ begin
  create policy "pdf_templates_read"
    on public.pdf_templates
    for select
    to authenticated
    using (true);
exception when duplicate_object then null; end $$;


