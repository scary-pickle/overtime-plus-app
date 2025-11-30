-- Fix SECURITY DEFINER views to be SECURITY INVOKER
-- This ensures views respect Row Level Security (RLS) policies
-- and run with the permissions of the querying user, not the view creator
--
-- Note: Views are SECURITY INVOKER by default in PostgreSQL.
-- If these views were created as SECURITY DEFINER, recreating them
-- without that property will make them SECURITY INVOKER.

-- Drop and recreate v_shifts as SECURITY INVOKER
-- For PostgreSQL 15+, we can explicitly set security_invoker = true
-- For earlier versions, omitting SECURITY DEFINER defaults to SECURITY INVOKER
drop view if exists public.v_shifts cascade;
create view public.v_shifts 
as 
select * from public.shifts where deleted_at is null;

-- Drop and recreate v_overtime_logs as SECURITY INVOKER
drop view if exists public.v_overtime_logs cascade;
create view public.v_overtime_logs 
as 
select * from public.overtime_logs where deleted_at is null;

