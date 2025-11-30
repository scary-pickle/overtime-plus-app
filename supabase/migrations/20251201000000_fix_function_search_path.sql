-- Fix function search_path security warnings
-- Sets immutable search_path to prevent search path manipulation attacks

-- Fix set_updated_at function
create or replace function public.set_updated_at()
returns trigger 
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Fix set_remote_flag_updated_at function
create or replace function public.set_remote_flag_updated_at()
returns trigger 
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Fix ensure_profile function
create or replace function public.ensure_profile()
returns void 
language plpgsql 
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, email)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  on conflict (user_id) do nothing;
end; $$;

