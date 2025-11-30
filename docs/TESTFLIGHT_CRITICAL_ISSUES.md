# TestFlight Submission - Critical Issues

## 🔴 Must Fix Before Submission

### 1. EAS Submit Configuration (ONLY IF USING EAS SUBMIT)
**File**: `eas.json`

**Note**: ⚠️ **SKIP THIS** if you're submitting via Xcode (Method 1). This is only needed if using `eas submit` command (Method 2).

**If using EAS Submit (Method 2)**, placeholder values need to be replaced with real App Store Connect credentials:

**Current**:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@example.com",
      "ascAppId": "your-app-store-connect-app-id",
      "appleTeamId": "your-apple-team-id"
    }
  }
}
```

**Action Required** (only if using EAS submit):
1. Get your Apple ID from App Store Connect
2. Get ASC App ID from: App Store Connect → Your App → App Information → Apple ID (numeric)
3. Get Apple Team ID from: App Store Connect → Users and Access → Your Name → Team ID (10 characters)
4. Update `eas.json` with real values

**Alternative**: Use App Store Connect API Key (recommended for security):
- Create API key in App Store Connect → Users and Access → Keys
- Download `.p8` file (only downloadable once!)
- Update `eas.json` to use API key instead of credentials

**If using Xcode (Method 1)**: You can ignore this section. Xcode handles submission directly.

---

### 2. Privacy Policy & Terms URLs (CRITICAL)
**Files**: `app/(tabs)/profile.tsx`, `app/subscription/paywall.tsx`

**Issue**: These URLs are required by App Store and must be:
- Set as EAS Secrets
- Live and accessible
- Match what's entered in App Store Connect

**Environment Variables**:
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`

**Action Required**:
1. Create/host Privacy Policy page
2. Create/host Terms of Service page
3. Set as EAS Secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://your-domain.com/privacy"
   eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value "https://your-domain.com/terms"
   ```
4. Verify URLs are accessible in browser
5. Enter same URLs in App Store Connect → App Information → Privacy Policy URL

**Privacy Policy Must Include**:
- What data is collected
- How data is used
- Data storage and security
- Third-party services (Supabase, RevenueCat)
- User rights (data deletion, etc.)
- Contact information

---

### 3. App Store Connect Metadata (REQUIRED)
**Location**: App Store Connect → Your App

**Missing Required Fields**:
- [ ] App Description
- [ ] Keywords
- [ ] Support URL
- [ ] Privacy Policy URL (must match environment variable)
- [ ] Screenshots (required for different device sizes):
  - iPhone 6.7"
  - iPhone 6.5"
  - iPhone 5.5"
  - iPad Pro 12.9" (if supporting iPad)
  - iPad Pro 11" (if supporting iPad)

**Action Required**: Complete all required fields in App Store Connect before submitting build.

---

### 4. Environment Variables Verification
**Action Required**: Verify all required environment variables are set as EAS Secrets:

```bash
eas secret:list
```

**Required Secrets**:
- ✅ `EXPO_PUBLIC_SUPABASE_URL`
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- ⚠️ `EXPO_PUBLIC_PRIVACY_POLICY_URL` (must be set)
- ⚠️ `EXPO_PUBLIC_TERMS_URL` (must be set)
- ✅ `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- ⚠️ `EXPO_PUBLIC_DISABLE_PAYWALL` (must be `false` for production)

**Action Required**:
1. List all secrets: `eas secret:list`
2. Verify all required secrets are present
3. Verify `EXPO_PUBLIC_DISABLE_PAYWALL` is NOT set to `true` (or is set to `false`)

---

### 5. Build Number
**File**: `app.config.ts`

**Issue**: Build number not explicitly set. EAS will auto-increment, but verify first build number.

**Action Required**:
- Option 1: Let EAS auto-increment (recommended)
- Option 2: Set manually in `app.config.ts`:
  ```typescript
  ios: {
    buildNumber: '1',
    // ...
  }
  ```

---

## ⚠️ Important Pre-Submission Checks

### Before Building
- [ ] All EAS Secrets are set correctly
- [ ] Privacy Policy and Terms URLs are live
- [ ] `EXPO_PUBLIC_DISABLE_PAYWALL=false` (or not set)
- [ ] Version number is correct in `app.config.ts`

### Before Submitting
- [ ] Build completes successfully
- [ ] Test build on physical device
- [ ] Verify no debug logs appear
- [ ] Test critical flows (auth, offline, subscriptions)
- [ ] EAS submit configuration updated with real credentials

### After Submission
- [ ] Build appears in App Store Connect
- [ ] Add release notes for testers
- [ ] Configure test groups
- [ ] Add internal testers

---

## ✅ What's Already Good

- ✅ Security: No hardcoded secrets
- ✅ Error handling: Comprehensive with user-friendly messages
- ✅ Offline support: App works without internet
- ✅ Icons & assets: All required assets present
- ✅ Permissions: All properly configured with descriptions
- ✅ Build config: Production profile correctly configured
- ✅ Code quality: Good structure and error handling

---

## Quick Command Reference

```bash
# List EAS Secrets
eas secret:list

# Create Privacy Policy URL secret
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://your-domain.com/privacy"

# Create Terms URL secret
eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value "https://your-domain.com/terms"

# Build for production (works for both methods)
eas build --profile production --platform ios

# Submit to TestFlight (ONLY if using EAS submit method)
eas submit --platform ios --latest
```

**Note**: If using Xcode, you'll download the `.ipa` from EAS and then use Xcode Organizer to submit.

---

## Next Steps

### If Submitting via Xcode (Method 1):
1. **Set Privacy Policy & Terms URLs** (30 minutes - if you need to create pages)
2. **Complete App Store Connect Metadata** (1-2 hours - screenshots take time)
3. **Verify Environment Variables** (5 minutes)
4. **Build with EAS** (or build locally): `eas build --profile production --platform ios`
5. **Download and Archive in Xcode** (follow TESTFLIGHT_SUBMISSION.md Method 1)
6. **Submit via Xcode Organizer** (10 minutes)

### If Submitting via EAS (Method 2):
1. **Fix EAS Submit Configuration** (5 minutes)
2. **Set Privacy Policy & Terms URLs** (30 minutes - if you need to create pages)
3. **Complete App Store Connect Metadata** (1-2 hours - screenshots take time)
4. **Verify Environment Variables** (5 minutes)
5. **Build and Submit**: `eas build --profile production --platform ios` then `eas submit --platform ios --latest`

**Total Estimated Time**: 2-3 hours (mostly for App Store Connect setup and screenshots)

Once these are complete, you're ready to submit! 🚀

