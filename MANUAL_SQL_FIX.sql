-- =====================================================
-- MANUAL FIX FOR SOFT DELETE RLS ISSUE
-- Copy and paste this entire file into Supabase SQL Editor and run it
-- =====================================================

-- Create functions that bypass RLS for soft deletes
-- These use SECURITY DEFINER to run with elevated permissions
-- but still verify user ownership before deleting

-- Function to soft delete overtime logs
CREATE OR REPLACE FUNCTION soft_delete_overtime_log(log_uuid uuid, user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership before deleting
  IF NOT EXISTS (
    SELECT 1 FROM overtime_logs 
    WHERE id = log_uuid AND user_id = user_uuid
  ) THEN
    RAISE EXCEPTION 'Log not found or access denied';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE overtime_logs
  SET deleted_at = now(), updated_at = now()
  WHERE id = log_uuid AND user_id = user_uuid;
END;
$$;

-- Function to soft delete shifts
CREATE OR REPLACE FUNCTION soft_delete_shift(shift_uuid uuid, user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership before deleting
  IF NOT EXISTS (
    SELECT 1 FROM shifts 
    WHERE id = shift_uuid AND user_id = user_uuid
  ) THEN
    RAISE EXCEPTION 'Shift not found or access denied';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE shifts
  SET deleted_at = now(), updated_at = now()
  WHERE id = shift_uuid AND user_id = user_uuid;
END;
$$;

-- Function to soft delete export batches
CREATE OR REPLACE FUNCTION soft_delete_export_batch(batch_uuid uuid, user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership before deleting
  IF NOT EXISTS (
    SELECT 1 FROM export_batches 
    WHERE id = batch_uuid AND user_id = user_uuid
  ) THEN
    RAISE EXCEPTION 'Export batch not found or access denied';
  END IF;
  
  -- Soft delete by setting deleted_at
  UPDATE export_batches
  SET deleted_at = now(), updated_at = now()
  WHERE id = batch_uuid AND user_id = user_uuid;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_overtime_log(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_shift(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_export_batch(uuid, uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION soft_delete_overtime_log IS 'Soft deletes an overtime log by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION soft_delete_shift IS 'Soft deletes a shift by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION soft_delete_export_batch IS 'Soft deletes an export batch by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';

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

