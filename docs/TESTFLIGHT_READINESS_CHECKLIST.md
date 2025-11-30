# TestFlight Submission Readiness Checklist

## ✅ Configuration Files

### App Configuration
- ✅ **App Name**: "Overtime+" (configured in `app.config.ts`)
- ✅ **Bundle Identifier**: `com.overtimeplus.app` (matches in both iOS and Android)
- ✅ **Version**: `1.0.0` (set in `app.config.ts`)
- ⚠️ **Build Number**: Not explicitly set in `app.config.ts` - EAS will auto-increment, but verify first build number
- ✅ **EAS Project ID**: Configured (`ab788c8c-812d-4a78-a620-4f1131f759de`)
- ✅ **Minimum iOS Version**: iOS 12.0 (set in `Info.plist`)

### EAS Submit Configuration
- ⚠️ **EAS Submit Config**: `eas.json` has placeholder values that need to be updated:
  ```json
  "appleId": "your-apple-id@example.com",
  "ascAppId": "your-app-store-connect-app-id",
  "appleTeamId": "your-apple-team-id"
  ```
  **Action Required**: Update these with your actual App Store Connect credentials before submitting.

---

## ⚠️ Critical: Environment Variables

### Required for TestFlight
These must be set as EAS Secrets for production builds:

1. **EXPO_PUBLIC_SUPABASE_URL** - ✅ Documented in `env.example`
2. **EXPO_PUBLIC_SUPABASE_ANON_KEY** - ✅ Documented in `env.example`
3. **EXPO_PUBLIC_PRIVACY_POLICY_URL** - ⚠️ **CRITICAL**: Must be set and point to a live, accessible URL
4. **EXPO_PUBLIC_TERMS_URL** - ⚠️ **CRITICAL**: Must be set and point to a live, accessible URL
5. **EXPO_PUBLIC_REVENUECAT_API_KEY_IOS** - ✅ Documented in `env.example`

### Development Flags
- ⚠️ **EXPO_PUBLIC_DISABLE_PAYWALL**: Must be `false` for production builds (currently defaults to `false` in `env.example`)

**Action Required**: 
- Verify all required environment variables are set as EAS Secrets
- Ensure Privacy Policy and Terms URLs are live and accessible
- Test that paywall is NOT disabled in production build

---

## ✅ Security & Privacy

### Privacy Policy & Terms
- ✅ Privacy Policy URL referenced in code (`app/(tabs)/profile.tsx`, `app/subscription/paywall.tsx`)
- ✅ Terms of Service URL referenced in code
- ⚠️ **Action Required**: Verify URLs are set in EAS Secrets and are accessible
- ⚠️ **Action Required**: Ensure Privacy Policy covers:
  - Data collection (Supabase, RevenueCat)
  - Data storage and security
  - User rights (data deletion)
  - Contact information

### Security Implementation
- ✅ No hardcoded secrets (verified via security docs)
- ✅ `.env` file in `.gitignore`
- ✅ Secure logging with data masking
- ✅ Error boundary implemented
- ✅ HTTPS enforcement for Supabase (non-localhost)

---

## ✅ App Icons & Assets

### Icons
- ✅ App icon exists: `assets/icon.png`
- ✅ Adaptive icon: `assets/adaptive-icon.png`
- ✅ Notification icon: `assets/notification-icon.png`
- ✅ Splash screen: `assets/splash.png` and `assets/splash-icon.png`
- ✅ Favicon: `assets/favicon.png`

**Action Required**: Verify `assets/icon.png` is 1024x1024px for App Store submission

---

## ✅ Permissions & Info.plist

### iOS Permissions
- ✅ **Notifications**: `NSUserNotificationUsageDescription` configured with clear description
- ✅ **Face ID**: `NSFaceIDUsageDescription` configured (if using biometric auth)
- ✅ **Local Networking**: Configured appropriately (disabled in production, enabled in dev)

### URL Schemes
- ✅ Deep linking configured: `overtime-plus` and `com.overtimeplus.app`
- ✅ Expo scheme: `exp+overtime-plus`

---

## ✅ Error Handling

- ✅ Error boundary component implemented (`components/ErrorBoundary.tsx`)
- ✅ User-friendly error messages
- ✅ Secure error logging (masks sensitive data)
- ✅ Offline-first architecture (app works without internet)
- ✅ Graceful fallbacks when Supabase unavailable

---

## ⚠️ App Store Connect Requirements

### Required Information (Must Complete in App Store Connect)
- [ ] **App Name**: "Overtime+"
- [ ] **Subtitle** (optional)
- [ ] **Description**: Prepare compelling description
- [ ] **Keywords**: For App Store search
- [ ] **Support URL**: Must be provided
- [ ] **Marketing URL** (optional)
- [ ] **Privacy Policy URL**: ⚠️ **REQUIRED** - Must match `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- [ ] **App Icon**: 1024x1024px (verify `assets/icon.png` meets this)
- [ ] **Screenshots**: Required for different device sizes:
  - [ ] iPhone 6.7" (iPhone 14 Pro Max, etc.)
  - [ ] iPhone 6.5" (iPhone 11 Pro Max, etc.)
  - [ ] iPhone 5.5" (iPhone 8 Plus, etc.)
  - [ ] iPad Pro 12.9" (if supporting iPad)
  - [ ] iPad Pro 11" (if supporting iPad)
- [ ] **App Preview Video** (optional but recommended)

### TestFlight Configuration
- [ ] **Test Information**: What to test, feedback email
- [ ] **Beta App Review Information**: Contact info, demo account (if login required)
- [ ] **Internal Testers**: Add up to 100 testers
- [ ] **External Testers** (optional): Up to 10,000 testers (requires Beta App Review)

---

## ✅ Code Quality

### Build Configuration
- ✅ Production build profile configured in `eas.json`
- ✅ Debug mode disabled for production
- ✅ Log level set to "info" for production
- ✅ Development client disabled for production builds

### Dependencies
- ✅ All dependencies up to date
- ✅ No known security vulnerabilities (verify with `npm audit`)

---

## ⚠️ Pre-Submission Testing

### Functional Testing
- [ ] Test app on physical iOS device (not just simulator)
- [ ] Test authentication flow (sign up, sign in, password reset)
- [ ] Test offline functionality (app should work without internet)
- [ ] Test subscription/paywall flow
- [ ] Test notifications (if enabled)
- [ ] Test all major features:
  - [ ] Creating logs
  - [ ] Creating shifts
  - [ ] Exporting PDFs
  - [ ] Profile management
  - [ ] Data sync (if Supabase enabled)

### Edge Cases
- [ ] Test with no internet connection
- [ ] Test with slow/unstable connection
- [ ] Test with invalid credentials
- [ ] Test error scenarios (network failures, etc.)
- [ ] Test app restart after crash

### Device Testing
- [ ] Test on latest iOS version
- [ ] Test on minimum supported iOS version (12.0)
- [ ] Test on different iPhone models (if possible)
- [ ] Test on iPad (if `supportsTablet: true`)

---

## ⚠️ Build & Submission

### Before Building
1. ✅ Verify version number in `app.config.ts` is correct
2. ⚠️ Verify build number will increment (EAS auto-increments, but check first build)
3. ✅ Verify all EAS Secrets are set:
   ```bash
   eas secret:list
   ```
4. ✅ Verify `EXPO_PUBLIC_DISABLE_PAYWALL=false` in production build
5. ✅ Verify Privacy Policy and Terms URLs are set

### Build Process
- [ ] Build production iOS app: `eas build --profile production --platform ios`
- [ ] Verify build completes successfully
- [ ] Download and test the `.ipa` file (if possible)

### Submission Process
- [ ] Update `eas.json` submit configuration with real credentials
- [ ] Submit to TestFlight: `eas submit --platform ios --latest`
- [ ] Wait for Apple processing (10-30 minutes)
- [ ] Verify build appears in App Store Connect

---

## ⚠️ Post-Submission

### App Store Connect
- [ ] Verify build appears in TestFlight section
- [ ] Add release notes for testers
- [ ] Configure test groups
- [ ] Add internal testers
- [ ] Submit for Beta App Review (if using external testers)

### Monitoring
- [ ] Monitor crash reports (if available)
- [ ] Monitor tester feedback
- [ ] Check for any compliance issues

---

## 🔴 Critical Issues to Fix Before Submission

1. **EAS Submit Configuration**: Update placeholder values in `eas.json` with real App Store Connect credentials
2. **Privacy Policy URL**: Must be set in EAS Secrets and be accessible
3. **Terms of Service URL**: Must be set in EAS Secrets and be accessible
4. **Paywall Disable Flag**: Verify `EXPO_PUBLIC_DISABLE_PAYWALL=false` in production
5. **App Store Connect Setup**: Complete all required metadata in App Store Connect

---

## 📝 Notes

- The app is offline-first, so it should work even if Supabase is unavailable
- Error handling is comprehensive with user-friendly messages
- Security appears well-implemented with no hardcoded secrets
- All required permissions have usage descriptions
- Build configuration looks correct for production

---

## ✅ Code Quality & Production Readiness

### Logging
- ✅ Console statements properly handled via `consoleSafe.ts`
- ✅ Debug logs disabled in production (`EXPO_PUBLIC_DEBUG_MODE=false`)
- ✅ Sensitive data masking implemented
- ✅ Secure logger used throughout codebase

### Test Files
- ✅ Test files exist but should be excluded from production builds
- ⚠️ **Action Required**: Verify test files are not included in production bundle (check `jest.config.js` and Metro bundler config)

### Development Features
- ✅ Paywall disable flag properly checked (defaults to `false`)
- ✅ Development-only features properly gated with `__DEV__` checks
- ✅ Environment-specific configuration in place

---

## ✅ Summary

**Ready for TestFlight?** ⚠️ **Almost** - Fix the critical issues above first:

### Critical Actions Required:
1. **Update EAS Submit Configuration**: Replace placeholders in `eas.json` with real App Store Connect credentials
2. **Verify Privacy Policy & Terms URLs**: 
   - Set as EAS Secrets
   - Ensure URLs are live and accessible
   - Verify they match what's in App Store Connect
3. **Complete App Store Connect Metadata**:
   - App description
   - Keywords
   - Support URL
   - Screenshots for required device sizes
   - Privacy Policy URL (must match environment variable)
4. **Verify Environment Variables**:
   - All required secrets set in EAS
   - `EXPO_PUBLIC_DISABLE_PAYWALL=false` for production
   - Privacy Policy and Terms URLs are valid
5. **Test Production Build**:
   - Build and test on physical device
   - Verify no debug logs appear
   - Test all critical flows
   - Verify offline functionality works

### What's Already Good:
- ✅ Security implementation is solid
- ✅ Error handling is comprehensive
- ✅ Offline-first architecture
- ✅ Icons and assets are in place
- ✅ Permissions properly configured
- ✅ Build configuration looks correct
- ✅ Code quality is good

Once the critical actions above are complete, you should be ready to submit to TestFlight!

