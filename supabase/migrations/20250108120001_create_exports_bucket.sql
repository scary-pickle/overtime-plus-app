-- Migration: Create exports bucket if it doesn't exist
-- This migration creates the exports bucket for storing PDF export batches

-- Create the exports bucket if it doesn't exist
-- Note: This requires the bucket to not exist already
-- If the bucket already exists, you'll see an error which can be ignored
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;






