-- Migration: Add storage policies for exports bucket
-- This migration adds RLS policies for the exports bucket to allow users
-- to access only their own PDF export batches.

-- Policies for exports bucket (PDF export batches)
-- Drop existing policies if they exist (idempotent)
drop policy if exists exportsreadown on storage.objects;
drop policy if exists exportswriteown on storage.objects;
drop policy if exists exportsupdateown on storage.objects;
drop policy if exists exportsdeleteown on storage.objects;

-- Create new policies
create policy exportsreadown on storage.objects
for select using (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy exportswriteown on storage.objects
for insert with check (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy exportsupdateown on storage.objects
for update using (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy exportsdeleteown on storage.objects
for delete using (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);

