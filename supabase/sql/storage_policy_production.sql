-- Storage policy for pdf-templates bucket (PRODUCTION)
-- Run this in your production Supabase SQL editor

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- Create public read policy for pdf-templates bucket
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-templates');

