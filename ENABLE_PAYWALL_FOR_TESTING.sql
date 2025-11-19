-- Enable paywall for testing
-- Run this in Supabase SQL Editor to enable the paywall feature flag

UPDATE remote_feature_flags
SET value = jsonb_build_object(
  'enabled', true,
  'cohort_percentage', 100,
  'target_group', 'testing'
)
WHERE key = 'enable_paywall';

-- Optional: Disable legacy_free_access for a specific test user
-- Replace 'your-test-user-id' with the actual user ID from auth.users
-- UPDATE profiles
-- SET legacy_free_access = false
-- WHERE user_id = 'your-test-user-id';

