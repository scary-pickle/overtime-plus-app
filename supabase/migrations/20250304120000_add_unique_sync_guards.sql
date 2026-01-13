-- Enforce per-user uniqueness for client-generated IDs stored in JSON extras/params
-- These partial unique indexes block resurrection/duplication when using extras->>id markers.

-- Overtime logs: unique per user by extras.id when not deleted
create unique index if not exists ux_overtime_logs_user_extras_id
  on public.overtime_logs (user_id, (extras->>'id'))
  where deleted_at is null;

-- Shifts used for usual shift patterns: unique per user by extras.id when not deleted
create unique index if not exists ux_shifts_user_extras_id_usual
  on public.shifts (user_id, (extras->>'id'))
  where deleted_at is null and notes = 'usual_shift_pattern';

-- Shifts used for log templates: unique per user by extras.id when not deleted
create unique index if not exists ux_shifts_user_extras_id_log_template
  on public.shifts (user_id, (extras->>'id'))
  where deleted_at is null and notes = 'log_template';

-- Export batches: unique per user by params.id when not deleted
create unique index if not exists ux_export_batches_user_params_id
  on public.export_batches (user_id, (params->>'id'))
  where deleted_at is null;
