-- Fix RLS to allow soft deletes by using a function with SECURITY DEFINER
-- This bypasses RLS for the soft delete operation while still maintaining security

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

-- Add comment explaining the functions
COMMENT ON FUNCTION soft_delete_overtime_log IS 'Soft deletes an overtime log by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION soft_delete_shift IS 'Soft deletes a shift by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION soft_delete_export_batch IS 'Soft deletes an export batch by setting deleted_at timestamp. Uses SECURITY DEFINER to bypass RLS.';

