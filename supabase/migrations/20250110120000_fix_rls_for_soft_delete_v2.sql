-- Fix RLS policies to properly allow soft deletes
-- The issue: UPDATE USING clause needs to allow access to rows regardless of deleted_at status
-- The user owns the row whether it's deleted or not

-- Only proceed if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overtime_logs') THEN
    -- Drop existing update policies
    DROP POLICY IF EXISTS logs_update ON public.overtime_logs;
    DROP POLICY IF EXISTS shifts_update ON public.shifts;
    DROP POLICY IF EXISTS exports_update ON public.export_batches;

    -- Recreate UPDATE policies - USING clause should NOT check deleted_at
    -- This allows users to update their own rows even when setting deleted_at
    CREATE POLICY logs_update ON public.overtime_logs FOR UPDATE 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY shifts_update ON public.shifts FOR UPDATE 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY exports_update ON public.export_batches FOR UPDATE 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- The SELECT policies already properly filter deleted_at IS NULL for reads
-- So this is safe - users can update (soft delete) their rows, but won't see them in SELECT queries
