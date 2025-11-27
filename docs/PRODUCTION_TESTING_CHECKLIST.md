# Production Testing Checklist

Use this checklist when testing production builds before release.

## Pre-Build Verification

- [ ] EAS project is linked (`eas project:info` works)
- [ ] EAS project ID is updated in `app.config.ts`
- [ ] EAS Secrets are set for production:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `EXPO_PUBLIC_TEMPLATE_OTA` (if using OTA templates)
- [ ] All database migrations are applied to production
- [ ] Production SQL scripts are run:
  - [ ] `pdf_templates_production.sql`
  - [ ] `storage_policy_production.sql`

## Build Process

### iOS Build
```bash
eas build --platform ios --profile production
```
- [ ] Build completes successfully
- [ ] Download and install on test device
- [ ] Verify app launches without crashes

### Android Build
```bash
eas build --platform android --profile production
```
- [ ] Build completes successfully
- [ ] Download and install on test device
- [ ] Verify app launches without crashes

## Functional Testing

### Authentication
- [ ] Sign up with allowed email domain works
- [ ] Sign up with blocked email domain fails appropriately
- [ ] Sign in with existing account works
- [ ] **Session persists after app restart** (CRITICAL)
- [ ] Email verification flow works
- [ ] Password reset flow works
- [ ] Logout clears session properly

### Core Functionality
- [ ] **Offline functionality works** (create log without internet)
- [ ] **PDF generation works correctly** (all template types)
- [ ] **Email export works** (sends email with PDF attachment)
- [ ] Create new overtime log
- [ ] Update existing log
- [ ] Delete log (soft delete)
- [ ] Restore deleted log from Recently Deleted
- [ ] Permanently delete log
- [ ] Create shift pattern
- [ ] Update shift pattern
- [ ] Delete shift pattern (soft delete)

### Data Sync
- [ ] Data syncs to Supabase when online
- [ ] Sync queue works when offline
- [ ] Sync retries after network reconnection
- [ ] No data loss during sync failures

### Export & PDF
- [ ] Create export batch
- [ ] View export preview
- [ ] Generate PDF for export
- [ ] Email export with PDF attachment
- [ ] Delete export batch (soft delete)
- [ ] Restore deleted batch

## Security Testing

### Logging
- [ ] **No debug logs appear in production build** (CRITICAL)
- [ ] **All API calls use production URLs** (not dev/staging)
- [ ] Sensitive data is masked in any error logs
- [ ] No PII visible in console/logs

### Data Security
- [ ] User A cannot view User B's logs (cross-tenant security)
- [ ] User A cannot delete User B's logs
- [ ] User A cannot restore User B's deleted items
- [ ] Soft delete RPCs reject unauthorized attempts

### Error Handling
- [ ] **Error handling works gracefully** (no crashes)
- [ ] **No crashes on startup**
- [ ] Error boundary displays fallback UI for React errors
- [ ] Network errors are handled gracefully
- [ ] Database errors are handled gracefully

## Performance Testing

- [ ] App startup time is acceptable (< 3 seconds)
- [ ] PDF generation completes in reasonable time
- [ ] Data sync doesn't block UI
- [ ] App works on lower-end devices
- [ ] No memory leaks during extended use

## Platform-Specific Testing

### iOS
- [ ] App works on latest iOS version
- [ ] App works on older iOS versions (if supporting)
- [ ] Notifications work correctly
- [ ] Deep links work correctly
- [ ] App Groups configured (if using widgets)

### Android
- [ ] App works on latest Android version
- [ ] App works on older Android versions (if supporting)
- [ ] Notifications work correctly
- [ ] Deep links work correctly
- [ ] SharedPreferences configured (if using widgets)

## OTA Template System (If Enabled)

- [ ] Templates download from Supabase storage
- [ ] Template updates work without app update
- [ ] Fallback to bundled templates if download fails
- [ ] Template versioning works correctly

## Notes

- Test on real devices, not simulators
- Test with production Supabase project
- Test both online and offline scenarios
- Test error scenarios (network failures, invalid data, etc.)






