-- Fix RLS policies to allow soft deletes
-- The issue is that the WITH CHECK clause needs to allow rows even when deleted_at is set

-- Drop existing update policies
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS shifts_update ON public.shifts;
DROP POLICY IF EXISTS logs_update ON public.overtime_logs;
DROP POLICY IF EXISTS exports_update ON public.export_batches;
DROP POLICY IF EXISTS attachments_update ON public.attachments;

-- Recreate update policies with relaxed WITH CHECK that allows deleted_at to be set
-- USING clause: can only update your own rows
-- WITH CHECK clause: after update, row must still belong to you (allows deleted_at to be any value)
CREATE POLICY profiles_update ON public.profiles FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY shifts_update ON public.shifts FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY logs_update ON public.overtime_logs FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY exports_update ON public.export_batches FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY attachments_update ON public.attachments FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- Add indexes on deleted_at for better query performance
CREATE INDEX IF NOT EXISTS idx_overtime_logs_deleted_at ON public.overtime_logs(user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_deleted_at ON public.shifts(user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_batches_deleted_at ON public.export_batches(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

