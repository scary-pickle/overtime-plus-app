# Critical Pre-Deployment Items - Quick Reference (iOS via Xcode)

**⚠️ These items MUST be completed before iOS App Store submission**

**Note:** This guide is for iOS App Store submission via Xcode only. Android/Google Play deployment will be handled separately with EAS later.

This is a condensed list of the most critical items. For the full checklist, see `PRE_APP_STORE_DEPLOYMENT_CHECKLIST.md`.

---

## 🔴 TOP PRIORITY (Do These First)

### 1. Privacy Policy & Terms URLs ⚠️ **CRITICAL**
**Why:** App Store will reject your app without these.

**Action Required:**
1. Create/host Privacy Policy page (must be live and accessible)
2. Create/host Terms of Service page (must be live and accessible)
3. Add to `.env` file in project root:
   ```bash
   EXPO_PUBLIC_PRIVACY_POLICY_URL=https://your-domain.com/privacy
   EXPO_PUBLIC_TERMS_URL=https://your-domain.com/terms
   ```
4. Enter same URLs in App Store Connect → App Information → Privacy Policy URL

**Privacy Policy Must Include:**
- Data collection (Supabase, RevenueCat)
- Data storage and security
- User rights (data deletion)
- Contact information

**Where Used:**
- `app/(tabs)/profile.tsx` - Links in settings
- `app/subscription/paywall.tsx` - Links in paywall screen

---

### 2. Environment Variables (.env File) ⚠️ **CRITICAL**
**Why:** App won't work without these. Since you're building with Xcode, use `.env` file (not EAS Secrets).

**Verify all required variables are in `.env` file:**
```bash
cat .env | grep EXPO_PUBLIC
```

**Required Variables in `.env`:**
- ✅ `EXPO_PUBLIC_SUPABASE_URL` - Production Supabase URL (NOT localhost)
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Production Supabase key
- ⚠️ `EXPO_PUBLIC_PRIVACY_POLICY_URL` - **MUST BE SET**
- ⚠️ `EXPO_PUBLIC_TERMS_URL` - **MUST BE SET**
- ✅ `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` - RevenueCat iOS key
- ⚠️ `EXPO_PUBLIC_DISABLE_PAYWALL` - Must be `false` or not set (defaults to false)
- ✅ `EXPO_PUBLIC_DEBUG_MODE` - Must be `false`
- ✅ `EXPO_PUBLIC_LOG_LEVEL` - Must be `info`

**Important:** 
- `.env` file should be in project root
- `.env` file is already in `.gitignore` (verify it's not committed)
- After changing `.env`, regenerate native project: `npx expo prebuild --platform ios --clean`

---

### 3. App Store Connect Setup ⚠️ **REQUIRED**
**Why:** Can't submit without completing this.

**Required Fields:**
- [ ] App Description
- [ ] Keywords
- [ ] Support URL
- [ ] Privacy Policy URL (must match EAS secret)
- [ ] Screenshots for all required device sizes:
  - iPhone 6.7"
  - iPhone 6.5"
  - iPhone 5.5"
  - iPad Pro 12.9" (if supporting iPad)
  - iPad Pro 11" (if supporting iPad)

---

### 4. Xcode Setup & Configuration
**Why:** You're using Xcode for building and submission, so this is required.

**Action Required:**
- [ ] Xcode is installed and up to date
- [ ] Apple Developer account added in Xcode → Preferences → Accounts
- [ ] Native iOS project generated: `npx expo prebuild --platform ios --clean`
- [ ] CocoaPods dependencies installed: `cd ios && pod install`
- [ ] Xcode project opens: `open ios/Overtime.xcworkspace`
- [ ] Signing configured in Xcode:
  - [ ] Team selected
  - [ ] Bundle Identifier: `com.overtimeplus.app`
  - [ ] Automatically manage signing: ✅ Enabled

---

## ⚠️ HIGH PRIORITY (Do Before Building)

### 5. Paywall Disable Flag
**Why:** Don't want to accidentally disable paywall in production.

**Check in `.env` file:**
- `EXPO_PUBLIC_DISABLE_PAYWALL` should be `false` or not set
- Default in `env.example` is `false` ✅
- Code checks: `process.env.EXPO_PUBLIC_DISABLE_PAYWALL === 'true'` to disable
- So if not set or `false`, paywall is enabled ✅

**Verify:**
```bash
cat .env | grep EXPO_PUBLIC_DISABLE_PAYWALL
# Should show: EXPO_PUBLIC_DISABLE_PAYWALL=false
# OR should not appear at all (defaults to false)
```

---

### 6. Production Build Configuration
**Why:** Need correct environment for production.

**Verify in `.env` file:**
- `EXPO_PUBLIC_DEBUG_MODE=false` ✅
- `EXPO_PUBLIC_LOG_LEVEL=info` ✅
- All production URLs (not localhost/dev/staging)

**Verify in `app.config.ts`:**
- Version: `1.0.0` ✅
- Bundle ID: `com.overtimeplus.app` ✅
- EAS Project ID: `ab788c8c-812d-4a78-a620-4f1131f759de` ✅

**After changing `.env`, regenerate native project:**
```bash
npx expo prebuild --platform ios --clean
```

---

### 7. Database & Infrastructure
**Why:** App won't work if database isn't set up correctly.

**Check:**
- [ ] All database migrations applied to production
- [ ] RLS policies verified
- [ ] Soft delete functions deployed
- [ ] Delete-account edge function deployed
- [ ] Auth signup guard edge function deployed

---

## ✅ MEDIUM PRIORITY (Do Before Submission)

### 8. Pre-Submission Testing
**Critical Tests:**
- [ ] **Session persists after app restart** (CRITICAL)
- [ ] **Offline functionality works** (create log without internet)
- [ ] **PDF generation works** (all template types)
- [ ] **Email export works** (sends email with PDF)
- [ ] **No debug logs appear in production build**
- [ ] **Paywall displays correctly** (not disabled)
- [ ] **Privacy Policy and Terms links work**

**Test on Physical Device:**
- [ ] Test on latest iOS version
- [ ] Test on minimum iOS version (iOS 12.0)
- [ ] Test with no internet connection
- [ ] Test with slow/unstable connection

---

### 9. Assets Verification
**Check:**
- [ ] App icon: `assets/icon.png` is 1024x1024px
- [ ] All other assets exist (splash, adaptive icon, etc.)

---

## 📋 Quick Command Reference

```bash
# Check .env file has production values
cat .env | grep EXPO_PUBLIC

# Switch to production environment (if using env scripts)
npm run env:production

# Regenerate native iOS project with production env vars
npx expo prebuild --platform ios --clean

# Install CocoaPods dependencies
cd ios && pod install && cd ..

# Open in Xcode
open ios/Overtime.xcworkspace

# Then in Xcode:
# 1. Select "Any iOS Device (arm64)" in device selector
# 2. Product → Archive
# 3. Organizer → Distribute App → App Store Connect → Upload
```

---

## 🎯 Estimated Time to Complete

- **Privacy Policy & Terms URLs**: 30-60 minutes (if you need to create pages)
- **Environment Variables Setup (.env file)**: 5-10 minutes
- **Xcode Setup & Configuration**: 10-15 minutes (first time only)
- **App Store Connect Metadata**: 1-2 hours (screenshots take time)
- **Testing**: 1-2 hours (depending on thoroughness)

**Total: 3-5 hours** (mostly for App Store Connect setup and screenshots)

---

## ✅ What's Already Good

- ✅ Security: No hardcoded secrets
- ✅ Error handling: Comprehensive
- ✅ Offline support: App works without internet
- ✅ Icons & assets: All present
- ✅ Permissions: Properly configured
- ✅ Build config: Production profile correct
- ✅ Code quality: Good structure
- ✅ No console.log statements (using secure logger)
- ✅ Paywall disable flag defaults to false

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Forgetting Privacy Policy/Terms URLs** - App Store will reject
2. ❌ **Building with wrong environment** - Always verify `.env` file has production values
3. ❌ **Not regenerating native project** - Must run `npx expo prebuild --clean` after changing `.env`
4. ❌ **Using localhost/dev URLs in production** - Verify Supabase URL is production, not localhost
5. ❌ **Paywall disabled in production** - Verify `EXPO_PUBLIC_DISABLE_PAYWALL=false` in `.env`
6. ❌ **Missing screenshots** - App Store requires them
7. ❌ **Version mismatch** - Ensure version in `app.config.ts` matches App Store Connect
8. ❌ **Selecting simulator instead of device** - Must select "Any iOS Device (arm64)" to enable Archive
9. ❌ **Opening .xcodeproj instead of .xcworkspace** - Always open `.xcworkspace` file (CocoaPods requirement)

---

## 📝 Next Steps

1. **Create Privacy Policy & Terms pages** (if not done)
2. **Add URLs to `.env` file** for Privacy Policy and Terms
3. **Verify all environment variables** in `.env` are production values
4. **Regenerate native project**: `npx expo prebuild --platform ios --clean`
5. **Complete App Store Connect metadata** (description, keywords, screenshots)
6. **Build and archive in Xcode**
7. **Test on physical device** (if possible before submission)
8. **Submit to App Store via Xcode Organizer**

---

**For the complete detailed checklist, see `PRE_APP_STORE_DEPLOYMENT_CHECKLIST.md`**

**For detailed Xcode workflow, see `XCODE_ONLY_TESTFLIGHT_GUIDE.md`**

