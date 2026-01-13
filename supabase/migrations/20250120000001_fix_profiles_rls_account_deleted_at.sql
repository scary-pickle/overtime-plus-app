-- Fix RLS policy for profiles to exclude accounts marked for deletion
-- The delete account function sets account_deleted_at, but the RLS policy only checked deleted_at
-- This allows deleted accounts to still be visible, which is a security/privacy issue

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'profiles_select'
  ) THEN
    -- Drop existing policy
    DROP POLICY IF EXISTS profiles_select ON public.profiles;
    
    -- Recreate with proper check for both deleted_at and account_deleted_at
    CREATE POLICY profiles_select ON public.profiles 
      FOR SELECT 
      USING (
        user_id = auth.uid() 
        AND deleted_at IS NULL 
        AND account_deleted_at IS NULL
      );
  END IF;
END $$;
