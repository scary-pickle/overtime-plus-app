-- Fix RLS policies to allow soft deletes
-- The issue is that the WITH CHECK clause needs to allow rows even when deleted_at is set

-- Only proceed if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- Drop existing update policies
    DROP POLICY IF EXISTS profiles_update ON public.profiles;
    DROP POLICY IF EXISTS logs_update ON public.overtime_logs;
    DROP POLICY IF EXISTS shifts_update ON public.shifts;
    DROP POLICY IF EXISTS exports_update ON public.export_batches;

    -- Recreate with proper WITH CHECK clause
    CREATE POLICY profiles_update ON public.profiles FOR UPDATE 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

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
