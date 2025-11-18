-- Adds subscription/trial tracking fields and remote feature-flag storage

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'subscription_status'
  ) then
    create type public.subscription_status as enum ('none', 'trial', 'active', 'expired', 'cancelled');
  end if;
end $$;

alter table public.profiles
  add column if not exists subscription_status public.subscription_status not null default 'none';

alter table public.profiles
  add column if not exists subscription_expires_at timestamptz null;

alter table public.profiles
  add column if not exists trial_started_at timestamptz null;

alter table public.profiles
  add column if not exists trial_expires_at timestamptz null;

alter table public.profiles
  add column if not exists trial_consumed boolean not null default false;

alter table public.profiles
  add column if not exists subscription_product_id text null;

alter table public.profiles
  add column if not exists subscription_cancelled_at timestamptz null;

alter table public.profiles
  add column if not exists grace_period_until timestamptz null;

alter table public.profiles
  add column if not exists data_retention_until timestamptz null;

alter table public.profiles
  add column if not exists account_deleted_at timestamptz null;

alter table public.profiles
  add column if not exists legacy_free_access boolean not null default false;

alter table public.profiles
  add column if not exists paywall_acknowledged_at timestamptz null;

create index if not exists idx_profiles_subscription_status on public.profiles(subscription_status);
create index if not exists idx_profiles_subscription_expires_at on public.profiles(subscription_expires_at);
create index if not exists idx_profiles_trial_expires_at on public.profiles(trial_expires_at);
create index if not exists idx_profiles_grace_period_until on public.profiles(grace_period_until);
create index if not exists idx_profiles_legacy_free_access on public.profiles(legacy_free_access);

update public.profiles
set legacy_free_access = true
where legacy_free_access is distinct from true;

update public.profiles
set subscription_status = 'none'
where subscription_status is null;

-- Remote feature flag storage for staged paywall rollout
create table if not exists public.remote_feature_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_remote_flag_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_remote_flag_updated_at on public.remote_feature_flags;
create trigger set_remote_flag_updated_at
before update on public.remote_feature_flags
for each row
execute function public.set_remote_flag_updated_at();

alter table public.remote_feature_flags enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'remote_feature_flags'
      and policyname = 'remote_flags_read'
  ) then
    create policy remote_flags_read on public.remote_feature_flags
      for select
      using (auth.role() in ('authenticated', 'service_role'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'remote_feature_flags'
      and policyname = 'remote_flags_maintainers'
  ) then
    create policy remote_flags_maintainers on public.remote_feature_flags
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

insert into public.remote_feature_flags (key, value, description)
values (
  'enable_paywall',
  jsonb_build_object(
    'enabled', false,
    'cohort_percentage', 0,
    'target_group', 'internal',
    'notes', 'Controls staged rollout for the RevenueCat paywall'
  ),
  'Controls staged rollout for the RevenueCat subscription paywall'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;
