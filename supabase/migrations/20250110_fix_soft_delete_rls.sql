-- Fix RLS to allow soft deletes by using a function with SECURITY DEFINER
-- This bypasses RLS for the soft delete operation while still maintaining security

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

-- Add comment explaining the functions
COMMENT ON FUNCTION soft_delete_overtime_log IS 'Soft deletes an overtime log owned by auth.uid(). Uses SECURITY DEFINER but enforces ownership server-side.';
COMMENT ON FUNCTION soft_delete_shift IS 'Soft deletes a shift owned by auth.uid(). Uses SECURITY DEFINER but enforces ownership server-side.';
COMMENT ON FUNCTION soft_delete_export_batch IS 'Soft deletes an export batch owned by auth.uid(). Uses SECURITY DEFINER but enforces ownership server-side.';
