<!-- 89dda120-3ecd-46a6-be29-3e31fa969685 0780ffe4-b56d-4556-9677-8315e926679e -->
# Production Readiness Build Plan

## Overview

Prepare the Overtime+ app for production deployment by addressing critical configuration, security, error handling, and build setup requirements.

## Recommended Execution Order

**IMPORTANT:** Follow this sequence to avoid rework. Each phase builds on the previous one.

### Phase 1: Foundation & Configuration (Do First - Blocks Everything Else)

**Why first:** You cannot build or test without proper configuration. These are prerequisites.

1. **Environment Variables Setup**

   - Verify production `.env` file exists with correct values
   - Ensure `EXPO_PUBLIC_SUPABASE_URL` points to production
   - Ensure `EXPO_PUBLIC_SUPABASE_ANON_KEY` is production key
   - Document any missing variables

2. **EAS Project Setup**

   - Get EAS project ID: `eas project:info` or from Expo dashboard
   - Update `app.config.ts` line 58: replace `'your-project-id'` with actual ID
   - Create `eas.json` with build profiles (development, preview, production)
   - Configure environment variable handling per profile

**Why this order:** Without EAS config, you can't build. Without env vars, builds will fail or use wrong endpoints.

### Phase 2: Code Quality & Error Handling (Do Before Building)

**Why second:** You want error handling in place before testing. Code cleanup prevents issues during builds.

3. **Error Boundary Implementation**

   - Create `components/ErrorBoundary.tsx`
   - Wrap `app/_layout.tsx` with ErrorBoundary
   - Test error boundary works (intentionally trigger an error)

4. **Code Cleanup**

   - Document or remove TODOs:
     - `lib/widget/widgetStatusUpdater.ts` (line 36)
     - `lib/supabase.ts` (lines 2161-2162)
     - `lib/email/emailService.ts` (line 43)
   - Verify test files (`testAVAC.ts`, `testSMOAVAC.ts`) are excluded from builds
   - Check `jest.config.js` excludes test files

**Why this order:** Error boundary catches issues during testing. Cleanup prevents surprises during builds.

### Phase 3: Security & Infrastructure Verification (Do Before Building)

**Why third:** Security issues are harder to fix after builds. Infrastructure must be correct before testing.

5. **Security Final Checks**

   - Search for hardcoded secrets: `grep -r "sk-" lib/ app/`
   - Verify no API keys in code
   - Test production build: verify no debug logs appear
   - Verify sensitive data masking works

6. **Database & Infrastructure Verification**

   - Verify all migrations in `supabase/migrations/` are applied to production
   - Run production SQL scripts:
     - `supabase/sql/pdf_templates_production.sql`
     - `supabase/sql/storage_policy_production.sql`
   - Verify production Supabase project is active
   - Verify storage buckets exist with correct policies
   - Test OTA template system (if enabled)

**Why this order:** Security issues discovered after builds require rebuilds. Infrastructure issues cause test failures.

### Phase 4: Build & Testing (Do After Configuration is Complete)

**Why fourth:** Only build after everything is configured correctly. Testing validates the configuration.

7. **Create Production Builds**

   - Build iOS: `eas build --platform ios --profile production`
   - Build Android: `eas build --platform android --profile production`
   - Verify builds complete successfully

8. **Production Testing**

   - Test on real devices (not simulators)
   - Complete production testing checklist:
     - [ ] Session persists after app restart
     - [ ] Offline functionality works
     - [ ] PDF generation works correctly
     - [ ] Email export works
     - [ ] No debug logs in production build
     - [ ] All API calls use production URLs
     - [ ] Error handling works gracefully
     - [ ] No crashes on startup

**Why this order:** Building before configuration is complete wastes time. Testing validates everything works together.

### Phase 5: Final Preparation (Do After Testing Passes)

**Why last:** These are final touches that don't affect functionality.

9. **App Store Preparation**

   - Prepare app store descriptions
   - Prepare screenshots
   - Prepare privacy policy URL
   - Prepare terms of service URL
   - Update version in `app.config.ts` if needed

10. **Documentation**

    - Update `README.md` with production deployment instructions
    - Document environment variables
    - Add troubleshooting section

**Why this order:** These don't affect app functionality, so they can be done last.

## Critical Tasks (Must Complete Before Launch)

### 1. Configuration & Build Setup

**Update EAS Project ID**

- File: `app.config.ts` (line 58)
- Replace placeholder `'your-project-id'` with actual EAS project ID
- Get ID from: `eas project:info` or Expo dashboard

**Create EAS Build Configuration**

- Create `eas.json` in project root
- Define build profiles: development, preview, production
- Configure iOS and Android build settings
- Set environment variable handling for each profile

**Environment Variables Verification**

- Verify `env.example` is complete (already exists)
- Ensure production `.env` has:
  - `EXPO_PUBLIC_SUPABASE_URL` → production URL
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` → production anon key
  - `EXPO_PUBLIC_TEMPLATE_OTA=true` (if using OTA templates)
- Document required variables in README

### 2. Error Handling & Resilience

**Add React Error Boundary**

- Create `components/ErrorBoundary.tsx`
- Implement `componentDidCatch` to handle React errors
- Add fallback UI for production errors
- Wrap root layout in `app/_layout.tsx` with ErrorBoundary
- Log errors to secure logger (masked)

**Add Crash Reporting (Optional but Recommended)**

- Integrate Sentry or Bugsnag
- Configure for production builds only
- Ensure sensitive data is masked in crash reports
- Set up error alerting/notifications

### 3. Code Cleanup

**Remove or Document TODOs**

- `lib/widget/widgetStatusUpdater.ts` (line 36): Native module bridge
- `lib/supabase.ts` (lines 2161-2162): Network status detection, auto-sync
- `lib/email/emailService.ts` (line 43): Supabase lookup
- Either implement or document as future enhancements

**Verify Test Files Excluded**

- Ensure test files (`testAVAC.ts`, `testSMOAVAC.ts`, etc.) are not included in production bundle
- Verify `jest.config.js` excludes test files from builds

### 4. Database & Infrastructure

**Verify Database Migrations**

- Confirm all migrations in `supabase/migrations/` are applied to production
- Run production SQL scripts:
  - `supabase/sql/pdf_templates_production.sql`
  - `supabase/sql/storage_policy_production.sql`
- Verify RLS policies are correct for production

**Verify Supabase Configuration**

- Confirm production Supabase project is active
- Verify storage buckets exist and have correct policies
- Test OTA template system if enabled
- Verify edge functions are deployed (if applicable)

### 5. Security Final Checks

**Verify No Hardcoded Secrets**

- Search codebase for hardcoded API keys, tokens, or credentials
- Ensure all secrets come from environment variables
- Verify `.env` is in `.gitignore` (already done)

**Verify Logging Security**

- Confirm all debug logs use secure logger
- Test production build: verify no debug logs appear
- Verify sensitive data masking works correctly
- Check that `NODE_ENV=production` disables debug logs

### 6. Build & Testing

**Create Production Build**

- Run: `eas build --platform ios --profile production`
- Run: `eas build --platform android --profile production`
- Verify builds complete successfully
- Test on real devices (not simulators)

**Production Testing Checklist**

- [ ] Session persists after app restart
- [ ] Offline functionality works
- [ ] PDF generation works correctly
- [ ] Email export works
- [ ] No debug logs in production build
- [ ] All API calls use production URLs
- [ ] Error handling works gracefully
- [ ] No crashes on startup

### 7. App Store Preparation

**App Metadata**

- Prepare app store descriptions (iOS App Store, Google Play)
- Prepare screenshots for both platforms
- Prepare app icons (verify `assets/icon.png` exists)
- Prepare privacy policy URL
- Prepare terms of service URL

**Version Management**

- Update version in `app.config.ts` (currently `1.0.0`)
- Consider semantic versioning for future updates
- Document version in CHANGELOG.md

## High Priority Tasks (Should Complete)

### 8. Monitoring & Analytics

**Add Error Tracking**

- Integrate Sentry or similar service
- Configure for production only
- Set up alerts for critical errors
- Ensure PII masking in error reports

**Add Basic Analytics (Optional)**

- Consider adding usage analytics
- Ensure compliance with privacy requirements
- Document what data is collected

### 9. Documentation

**Update README**

- Add production deployment instructions
- Document environment variables
- Add troubleshooting section
- Link to production setup docs

**Create Production Runbook**

- Document rollback procedures
- Document monitoring procedures
- Document incident response
- Document database backup/restore

### 10. Performance Verification

**Bundle Size Check**

- Verify production bundle size is reasonable
- Check for unnecessary dependencies
- Optimize images/assets if needed

**Performance Testing**

- Test app startup time
- Test data sync performance
- Test PDF generation performance
- Test on lower-end devices

## Medium Priority Tasks (Nice to Have)

### 11. Additional Improvements

**Migrate Remaining console.log**

- Review `app/` directory for remaining `console.log` calls
- Migrate to secure logger where appropriate
- Focus on production-critical paths

**Add Performance Monitoring**

- Monitor app performance in production
- Track slow operations
- Identify bottlenecks

## Files to Create/Modify

**New Files:**

- `eas.json` - EAS build configuration
- `components/ErrorBoundary.tsx` - React error boundary
- `CHANGELOG.md` - Version history (optional)

**Files to Update:**

- `app.config.ts` - Update EAS project ID
- `app/_layout.tsx` - Wrap with ErrorBoundary
- `README.md` - Add production deployment section
- `env.example` - Verify completeness (already exists)

## Verification Steps

1. **Configuration Check**
   ```bash
   # Verify EAS project ID is set
   grep -r "your-project-id" app.config.ts
   # Should return nothing if fixed
   ```

2. **Build Test**
   ```bash
   # Test production build locally
   eas build --platform ios --profile production --local
   ```

3. **Environment Check**
   ```bash
   # Verify production env vars are set
   # Check that .env has production values
   ```

4. **Security Check**
   ```bash
   # Verify no hardcoded secrets
   grep -r "sk-" lib/ app/
   grep -r "eyJ" lib/ app/
   # Should return nothing
   ```

5. **Logging Check**
   ```bash
   # Build with NODE_ENV=production
   # Verify no debug logs appear
   ```


## Dependencies

- EAS CLI installed and configured
- Production Supabase project set up
- App store developer accounts (iOS/Android)
- Production environment variables configured

## Notes

- All logging has been secured (completed)
- Session persistence is working (verified)
- Database migrations need manual verification
- Error boundary is missing and should be added
- EAS configuration is missing and required for builds

### To-dos

- [ ] Update EAS project ID in app.config.ts (replace 'your-project-id' placeholder)
- [ ] Create eas.json with build profiles (development, preview, production) for iOS and Android
- [ ] Verify all production environment variables are set correctly (.env file)
- [ ] Create components/ErrorBoundary.tsx with React error boundary implementation
- [ ] Wrap app/_layout.tsx with ErrorBoundary component
- [ ] Verify all Supabase migrations are applied to production database
- [ ] Verify production Supabase project, storage buckets, and RLS policies are correct
- [ ] Create and test production builds for both iOS and Android platforms
- [ ] Complete production testing checklist (session persistence, offline mode, PDF generation, etc.)
- [ ] Verify no debug logs appear in production build and sensitive data is masked
- [ ] Document or implement remaining TODOs in codebase
- [ ] Update README.md with production deployment instructions and environment variable documentation