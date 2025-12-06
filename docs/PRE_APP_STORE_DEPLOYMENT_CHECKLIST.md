# Pre-App Store Deployment Checklist (iOS via Xcode)

**Last Updated:** Based on comprehensive review of all deployment documentation  
**Purpose:** Final checklist before submitting iOS app to App Store using Xcode  
**Note:** This guide is for iOS App Store submission via Xcode only. Android/Google Play deployment will be handled separately with EAS later.

---

## 🔴 CRITICAL - Must Complete Before Submission

### 1. Environment Variables (Local .env File)

Since you're building with Xcode locally, you need to set environment variables in a `.env` file (not EAS Secrets).

#### Required Environment Variables
- [ ] **EXPO_PUBLIC_SUPABASE_URL** - Production Supabase URL
- [ ] **EXPO_PUBLIC_SUPABASE_ANON_KEY** - Production Supabase anon/publishable key
- [ ] **EXPO_PUBLIC_PRIVACY_POLICY_URL** - ⚠️ **CRITICAL** - Must be live, accessible URL
- [ ] **EXPO_PUBLIC_TERMS_URL** - ⚠️ **CRITICAL** - Must be live, accessible URL
- [ ] **EXPO_PUBLIC_REVENUECAT_API_KEY_IOS** - RevenueCat iOS public key (production)

#### Verify .env File
```bash
# Check your .env file exists and has correct values
cat .env | grep EXPO_PUBLIC
```

**Important:** 
- `.env` file should be in project root
- `.env` file is already in `.gitignore` (verify it's not committed)
- Use production values, not dev/staging

#### Critical Flags
- [ ] **EXPO_PUBLIC_DISABLE_PAYWALL** - Must be `false` for production (or not set, defaults to false)
- [ ] **EXPO_PUBLIC_DEBUG_MODE** - Must be `false` for production
- [ ] **EXPO_PUBLIC_LOG_LEVEL** - Must be `info` for production

---

### 2. App Store Connect Configuration

#### App Information (Required)
- [ ] **App Name**: "Overtime+" (matches `app.config.ts`)
- [ ] **Bundle Identifier**: `com.overtimeplus.app` (matches `app.config.ts`)
- [ ] **Version**: `1.0.0` (matches `app.config.ts`)
- [ ] **Build Number**: Verify first build number (EAS auto-increments, but check first)
- [ ] **Primary Language**: Set to English (or your preference)

#### App Store Listing (Required)
- [ ] **Description**: Compelling app description (required)
- [ ] **Keywords**: App Store search keywords (required)
- [ ] **Support URL**: Must be provided (required)
- [ ] **Marketing URL** (optional)
- [ ] **Privacy Policy URL**: ⚠️ **REQUIRED** - Must match `EXPO_PUBLIC_PRIVACY_POLICY_URL` exactly
- [ ] **App Icon**: 1024x1024px (verify `assets/icon.png` meets this requirement)

#### Screenshots (Required for App Store Review)
- [ ] iPhone 6.7" (iPhone 14 Pro Max, iPhone 15 Pro Max, etc.)
- [ ] iPhone 6.5" (iPhone 11 Pro Max, iPhone XS Max, etc.)
- [ ] iPhone 5.5" (iPhone 8 Plus, etc.)
- [ ] iPad Pro 12.9" (if supporting iPad - `supportsTablet: true` in config)
- [ ] iPad Pro 11" (if supporting iPad)

#### App Preview Video (Optional but Recommended)
- [ ] Create and upload app preview video

---

### 3. Xcode Configuration

**⚠️ You're using Xcode for building and submission, so no EAS submit config needed**

- [ ] Xcode is installed and up to date
- [ ] Apple Developer account is added in Xcode → Preferences → Accounts
- [ ] Native iOS project is generated: `npx expo prebuild --platform ios --clean`
- [ ] CocoaPods dependencies installed: `cd ios && pod install`
- [ ] Xcode project opens correctly: `open ios/Overtime.xcworkspace`
- [ ] Signing & Capabilities configured:
  - [ ] Team selected in Xcode
  - [ ] Bundle Identifier: `com.overtimeplus.app`
  - [ ] Automatically manage signing: ✅ Enabled

---

### 4. Database & Infrastructure

#### Supabase Production Database
- [ ] All database migrations applied to production
- [ ] RLS policies verified and tested
- [ ] Soft delete functions deployed (`soft_delete_overtime_log`, `soft_delete_shift`, `soft_delete_export_batch`)
- [ ] Delete-account edge function deployed and tested
- [ ] Auth signup guard edge function deployed with proper Authorization header

#### Storage Buckets
- [ ] `attachments` bucket exists with proper RLS policies
- [ ] `exports` bucket exists with proper RLS policies
- [ ] `pdf-templates` bucket exists (if using OTA templates) with public read access

#### PDF Templates (If Using OTA)
- [ ] PDF templates uploaded to Supabase storage
- [ ] Coordinate mappings seeded in `pdf_templates` table
- [ ] Templates are active and accessible

---

### 5. Security & Privacy

#### Security Hardening
- [ ] HTTPS enforcement enabled (non-localhost URLs must use HTTPS)
- [ ] Session storage uses SecureStore (not unencrypted SQLite)
- [ ] PII encryption uses XChaCha20-Poly1305 (not legacy XOR)
- [ ] Debug logging disabled in production (`__DEV__` checks in place)
- [ ] No PII visible in production logs
- [ ] Android `allowBackup` set to `false` in `app.config.ts` (already configured, not relevant for iOS builds)

#### Privacy Policy & Terms
- [ ] Privacy Policy URL is live and accessible
- [ ] Terms of Service URL is live and accessible
- [ ] Privacy Policy covers:
  - Data collection (Supabase, RevenueCat)
  - Data storage and security
  - User rights (data deletion)
  - Contact information
- [ ] URLs match exactly in:
  - `.env` file
  - App Store Connect
  - App code (`app/(tabs)/profile.tsx`, `app/subscription/paywall.tsx`)

#### Cross-Tenant Security
- [ ] Tested: User A cannot view User B's data
- [ ] Tested: User A cannot delete User B's data
- [ ] Tested: Soft delete RPCs reject unauthorized attempts

---

### 6. Code Quality & Build Configuration

#### Build Configuration
- [ ] `app.config.ts` version is correct (`1.0.0`)
- [ ] Bundle identifier matches App Store Connect (`com.overtimeplus.app`)
- [ ] EAS project ID is correct (`ab788c8c-812d-4a78-a620-4f1131f759de`)
- [ ] `.env` file has all production environment variables

#### Code Verification
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] All unit tests pass: `npm run test`
- [ ] No console.log statements in production code (use secure logger)
- [ ] Test files excluded from production bundle

#### Assets
- [ ] App icon: `assets/icon.png` is 1024x1024px
- [ ] Adaptive icon: `assets/adaptive-icon.png` exists
- [ ] Splash screen: `assets/splash.png` and `assets/splash-icon.png` exist
- [ ] Notification icon: `assets/notification-icon.png` exists
- [ ] Favicon: `assets/favicon.png` exists

---

### 7. Pre-Submission Testing

#### Functional Testing (On Physical Device)
- [ ] **Authentication Flow**
  - [ ] Sign up with allowed email domain works
  - [ ] Sign up with blocked email domain fails appropriately
  - [ ] Sign in with existing account works
  - [ ] **Session persists after app restart** (CRITICAL)
  - [ ] Email verification flow works
  - [ ] Password reset flow works
  - [ ] Logout clears session properly

- [ ] **Core Functionality**
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

- [ ] **Data Sync**
  - [ ] Data syncs to Supabase when online
  - [ ] Sync queue works when offline
  - [ ] Sync retries after network reconnection
  - [ ] No data loss during sync failures

- [ ] **Export & PDF**
  - [ ] Create export batch
  - [ ] View export preview
  - [ ] Generate PDF for export
  - [ ] Email export with PDF attachment
  - [ ] Delete export batch (soft delete)
  - [ ] Restore deleted batch

- [ ] **Subscription/Paywall**
  - [ ] Paywall displays correctly (not disabled)
  - [ ] Subscription purchase flow works
  - [ ] Subscription status updates correctly
  - [ ] Privacy Policy and Terms links work in paywall

#### Security Testing
- [ ] **No debug logs appear in production build** (CRITICAL)
- [ ] **All API calls use production URLs** (not dev/staging)
- [ ] Sensitive data is masked in any error logs
- [ ] No PII visible in console/logs
- [ ] Cross-tenant security tested (User A cannot access User B's data)

#### Edge Cases
- [ ] Test with no internet connection
- [ ] Test with slow/unstable connection
- [ ] Test with invalid credentials
- [ ] Test error scenarios (network failures, etc.)
- [ ] Test app restart after crash
- [ ] Test on minimum supported iOS version (iOS 12.0)
- [ ] Test on latest iOS version

#### Performance
- [ ] App startup time is acceptable (< 3 seconds)
- [ ] PDF generation completes in reasonable time
- [ ] Data sync doesn't block UI
- [ ] App works on lower-end devices
- [ ] No memory leaks during extended use

---

### 8. Build & Submission (Xcode Workflow)

#### Before Building
- [ ] Verify `.env` file has all required environment variables with production values
- [ ] Verify version number in `app.config.ts` is correct (`1.0.0`)
- [ ] Verify build number in Xcode (or set in `app.config.ts` → `ios.buildNumber`)
- [ ] Verify `EXPO_PUBLIC_DISABLE_PAYWALL=false` in `.env` (or not set)
- [ ] Verify Privacy Policy and Terms URLs are set in `.env` and are accessible
- [ ] Switch to production environment: `npm run env:production` (if using env scripts)
- [ ] Regenerate native project: `npx expo prebuild --platform ios --clean`

#### Xcode Build Process
- [ ] Open Xcode: `open ios/Overtime.xcworkspace`
- [ ] Select **Any iOS Device (arm64)** in device selector (not simulator)
- [ ] Set Build Configuration to **Release**: Product → Scheme → Edit Scheme → Archive → Release
- [ ] Clean build folder: **Product** → **Clean Build Folder** (Shift+Cmd+K)
- [ ] Create Archive: **Product** → **Archive**
- [ ] Wait for archive to complete (5-15 minutes)
- [ ] Archive appears in Organizer window

#### Xcode Submission Process
- [ ] In Organizer, select your archive
- [ ] Click **Distribute App**
- [ ] Select **App Store Connect**
- [ ] Click **Next**
- [ ] Select **Upload**
- [ ] Click **Next**
- [ ] Review distribution options:
  - [ ] ✅ **Upload your app's symbols** (recommended for crash reports)
  - [ ] ✅ **Manage Version and Build Number** (optional)
- [ ] Click **Next**
- [ ] Review summary
- [ ] Click **Upload**
- [ ] Wait for upload to complete (5-10 minutes)
- [ ] Wait for Apple processing (10-30 minutes)
- [ ] Verify build appears in App Store Connect → TestFlight

---

### 9. Post-Submission (App Store Connect)

#### TestFlight Configuration (If Using TestFlight First)
- [ ] Add test information (what to test, feedback email)
- [ ] Add beta app review information (contact info, demo account if needed)
- [ ] Add internal testers (up to 100)
- [ ] Add external testers (optional, up to 10,000, requires Beta App Review)
- [ ] Add release notes for testers

#### App Store Review Preparation
- [ ] Complete all App Store listing information
- [ ] Add screenshots for all required device sizes
- [ ] Add app description and keywords
- [ ] Set up pricing and availability
- [ ] Complete Export Compliance information
- [ ] Add App Review notes (if needed)
- [ ] Submit for App Store Review

---

### 10. Monitoring & Support

#### Setup Monitoring
- [ ] Configure crash reporting (if using service like Sentry)
- [ ] Set up analytics (if using service)
- [ ] Monitor App Store Connect for crash reports
- [ ] Set up email alerts for critical issues

#### Support Preparation
- [ ] Support email configured: `overtimeplusapp@proton.me`
- [ ] Support URL set in App Store Connect
- [ ] Prepare FAQ or support documentation
- [ ] Test feedback/contact flow in app

---

## 📋 Quick Reference Commands

### Verify Environment
```bash
# Check .env file has production values
cat .env | grep EXPO_PUBLIC

# Check TypeScript
npx tsc --noEmit

# Run tests
npm run test

# Check app config
cat app.config.ts | grep version
```

### Xcode Build Workflow
```bash
# Switch to production environment (if using env scripts)
npm run env:production

# Regenerate native iOS project with production env vars
npx expo prebuild --platform ios --clean

# Install CocoaPods dependencies
cd ios && pod install && cd ..

# Open in Xcode
open ios/Overtime.xcworkspace

# Then in Xcode:
# 1. Product → Archive
# 2. Organizer → Distribute App → App Store Connect → Upload
```

### Verify Environment Variables
```bash
# Check what's in your .env file
cat .env

# Verify production Supabase URL (should NOT be localhost)
cat .env | grep EXPO_PUBLIC_SUPABASE_URL

# Verify paywall is not disabled
cat .env | grep EXPO_PUBLIC_DISABLE_PAYWALL
```

---

## ⚠️ Common Pitfalls to Avoid

1. **Building with wrong environment** - Always verify `.env` file has production values before building
2. **Missing Privacy Policy/Terms URLs** - App Store will reject without these
3. **Paywall disabled in production** - Verify `EXPO_PUBLIC_DISABLE_PAYWALL=false` in `.env`
4. **Debug logs in production** - Check for `__DEV__` guards on all logging
5. **Wrong Supabase URL** - Verify production URL in `.env`, not dev/staging/localhost
6. **Missing screenshots** - App Store requires screenshots for all device sizes
7. **Version mismatch** - Ensure version in `app.config.ts` matches App Store Connect
8. **Test files in bundle** - Verify test files are excluded from production builds
9. **Not regenerating native project** - Must run `npx expo prebuild --clean` after changing `.env` file
10. **Selecting simulator instead of device** - Must select "Any iOS Device (arm64)" to enable Archive
11. **Opening .xcodeproj instead of .xcworkspace** - Always open `.xcworkspace` file (CocoaPods requirement)

---

## ✅ Final Sign-Off

Before submitting to App Store via Xcode, verify:

- [ ] All critical items above are checked
- [ ] `.env` file has all production environment variables
- [ ] Native iOS project regenerated with production env vars: `npx expo prebuild --platform ios --clean`
- [ ] App has been tested on physical iOS device
- [ ] Privacy Policy and Terms URLs are live and accessible
- [ ] App Store Connect listing is complete
- [ ] Screenshots are uploaded for all required device sizes
- [ ] Xcode archive created successfully
- [ ] Build uploaded to App Store Connect
- [ ] No debug logs or development features are enabled

---

## 📝 Notes

- This checklist is tailored for **iOS App Store submission via Xcode only**
- Android/Google Play deployment will be handled separately with EAS later
- This checklist consolidates requirements from:
  - `XCODE_ONLY_TESTFLIGHT_GUIDE.md`
  - `TESTFLIGHT_SUBMISSION.md` (Xcode method)
  - `PRODUCTION_DEPLOYMENT.md`
  - `RELEASE_CHECKLIST.md`
  - `PRODUCTION_TESTING_CHECKLIST.md`
  - `SECURITY_HARDENING_SUMMARY.md`

- For detailed Xcode workflow, see `XCODE_ONLY_TESTFLIGHT_GUIDE.md`
- For detailed information on any item, refer to the specific documentation file in the `docs/` directory

- **Remember**: 
  - App Store review can take 24-48 hours
  - Be patient and monitor App Store Connect for updates
  - Environment variables are baked into the app at build time, so regenerate native project after changing `.env`

---

**Good luck with your iOS App Store submission! 🚀**

