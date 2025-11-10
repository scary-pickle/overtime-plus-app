-- Schema: profiles, shifts, overtime_logs, export_batches, attachments
-- Enable extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz null,
  department text,
  hospital text,
  notes text,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.overtime_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid null references public.shifts(id) on delete set null,
  date date not null,
  hours numeric(6,2) not null,
  rate numeric(10,2) null,
  notes text,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.export_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  result_url text null,
  error text null,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  related_type text,
  related_id uuid,
  filename text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- Triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger set_shifts_updated_at before update on public.shifts
for each row execute function public.set_updated_at();
create trigger set_logs_updated_at before update on public.overtime_logs
for each row execute function public.set_updated_at();
create trigger set_export_batches_updated_at before update on public.export_batches
for each row execute function public.set_updated_at();
create trigger set_attachments_updated_at before update on public.attachments
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.overtime_logs enable row level security;
alter table public.export_batches enable row level security;
alter table public.attachments enable row level security;

-- Policies (owners only, exclude soft-deleted by default for reads)
create policy profiles_select on public.profiles for select using (user_id = auth.uid() and deleted_at is null);
create policy profiles_insert on public.profiles for insert with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy shifts_select on public.shifts for select using (user_id = auth.uid() and deleted_at is null);
create policy shifts_insert on public.shifts for insert with check (user_id = auth.uid());
create policy shifts_update on public.shifts for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy logs_select on public.overtime_logs for select using (user_id = auth.uid() and deleted_at is null);
create policy logs_insert on public.overtime_logs for insert with check (user_id = auth.uid());
create policy logs_update on public.overtime_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy exports_select on public.export_batches for select using (user_id = auth.uid() and deleted_at is null);
create policy exports_insert on public.export_batches for insert with check (user_id = auth.uid());
create policy exports_update on public.export_batches for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attachments_select on public.attachments for select using (user_id = auth.uid() and deleted_at is null);
create policy attachments_insert on public.attachments for insert with check (user_id = auth.uid());
create policy attachments_update on public.attachments for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indexes
create index if not exists idx_shifts_user_start_at on public.shifts(user_id, start_at);
create index if not exists idx_logs_user_date on public.overtime_logs(user_id, date);
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_attachments_user on public.attachments(user_id);

-- Optional views to hide soft-deleted
create or replace view public.v_shifts as select * from public.shifts where deleted_at is null;
create or replace view public.v_overtime_logs as select * from public.overtime_logs where deleted_at is null;

-- Upsert profile on first login can be done from client or via RPC; placeholder RPC:
create or replace function public.ensure_profile()
returns void language plpgsql security definer as $$
begin
  insert into public.profiles(user_id, email)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  on conflict (user_id) do nothing;
end; $$;
