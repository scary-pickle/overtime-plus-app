-- Buckets must remain private; signed URLs are used for sharing
select storage.create_bucket('attachments', false);
select storage.create_bucket('exports', false);
