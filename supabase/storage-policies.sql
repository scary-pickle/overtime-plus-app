-- Storage buckets and RLS policies
-- Create buckets via dashboard or CLI; policies below restrict objects to owner folder.

-- Example policy for attachments bucket
-- Adjust bucket_id if different
create policy if not exists attachmentsreadown on storage.objects
for select using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists attachmentswriteown on storage.objects
for insert with check (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists attachmentsupdateown on storage.objects
for update using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy if not exists attachmentsdeleteown on storage.objects
for delete using (
  bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Similar policies can be created for an 'exports' private bucket.
