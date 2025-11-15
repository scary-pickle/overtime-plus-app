-- =====================================================
-- MANUAL FIX FOR SOFT DELETE RLS ISSUE
-- Copy and paste this entire file into Supabase SQL Editor and run it
-- =====================================================

-- Create functions that bypass RLS for soft deletes
-- These use SECURITY DEFINER to run with elevated permissions
-- but still verify user ownership before deleting

CREATE OR REPLACE FUNCTION soft_delete_overtime_log(log_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE overtime_logs
  SET deleted_at = now(), updated_at = now()
  WHERE id = log_uuid AND user_id = acting_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log not found or access denied';
  END IF;
END;
$$;

-- Function to soft delete shifts
CREATE OR REPLACE FUNCTION soft_delete_shift(shift_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE shifts
  SET deleted_at = now(), updated_at = now()
  WHERE id = shift_uuid AND user_id = acting_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found or access denied';
  END IF;
END;
$$;

-- Function to soft delete export batches
CREATE OR REPLACE FUNCTION soft_delete_export_batch(batch_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user uuid := auth.uid();
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE export_batches
  SET deleted_at = now(), updated_at = now()
  WHERE id = batch_uuid AND user_id = acting_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Export batch not found or access denied';
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_overtime_log(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_shift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_export_batch(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION soft_delete_overtime_log IS 'Soft deletes an overtime log by setting deleted_at timestamp while enforcing auth.uid() ownership.';
COMMENT ON FUNCTION soft_delete_shift IS 'Soft deletes a shift by setting deleted_at timestamp while enforcing auth.uid() ownership.';
COMMENT ON FUNCTION soft_delete_export_batch IS 'Soft deletes an export batch by setting deleted_at timestamp while enforcing auth.uid() ownership.';

-- Verify functions were created
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE 'soft_delete%'
ORDER BY p.proname;

-- SUCCESS! You should see 3 functions listed above.
-- Now reload your app and try deleting a log again.



