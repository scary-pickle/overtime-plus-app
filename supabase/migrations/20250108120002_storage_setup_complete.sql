-- Migration: Complete storage setup - buckets and policies
-- This migration ensures both buckets exist and all storage policies are in place
-- with proper WITH CHECK clauses to prevent user_id reassignment

-- Create buckets if they don't exist (idempotent)
-- Buckets must remain private; signed URLs are used for sharing
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do update set public = false;

-- Drop existing policies if they exist (idempotent)
drop policy if exists attachmentsreadown on storage.objects;
drop policy if exists attachmentswriteown on storage.objects;
drop policy if exists attachmentsupdateown on storage.objects;
drop policy if exists attachmentsdeleteown on storage.objects;

drop policy if exists exportsreadown on storage.objects;
drop policy if exists exportswriteown on storage.objects;
drop policy if exists exportsupdateown on storage.objects;
drop policy if exists exportsdeleteown on storage.objects;

-- Create policies for attachments bucket with WITH CHECK clauses
create policy attachmentsreadown on storage.objects
for select using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy attachmentswriteown on storage.objects
for insert with check (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy attachmentsupdateown on storage.objects
for update using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy attachmentsdeleteown on storage.objects
for delete using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policies for exports bucket with WITH CHECK clauses
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
)
with check (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy exportsdeleteown on storage.objects
for delete using (
  bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text
);






