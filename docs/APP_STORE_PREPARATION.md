# App Store Preparation Checklist

Use this checklist to prepare for app store submission.

## App Metadata

### Required Information

#### iOS App Store
- [ ] App name: "Overtime+"
- [ ] Subtitle (optional)
- [ ] Description (prepare compelling description)
- [ ] Keywords (for App Store search)
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL (REQUIRED)
- [ ] App icon (1024x1024px) - verify `assets/icon.png` exists
- [ ] Screenshots for different device sizes:
  - [ ] iPhone 6.7" (iPhone 14 Pro Max, etc.)
  - [ ] iPhone 6.5" (iPhone 11 Pro Max, etc.)
  - [ ] iPhone 5.5" (iPhone 8 Plus, etc.)
  - [ ] iPad Pro 12.9"
  - [ ] iPad Pro 11"
- [ ] App preview video (optional but recommended)

#### Google Play Store
- [ ] App name: "Overtime+"
- [ ] Short description (80 characters max)
- [ ] Full description (4000 characters max)
- [ ] App icon (512x512px) - verify `assets/icon.png` exists
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots:
  - [ ] Phone screenshots (at least 2)
  - [ ] Tablet screenshots (at least 2, if supporting tablets)
- [ ] Promo video (optional but recommended)

## Legal & Compliance

### Privacy Policy
- [ ] Privacy Policy URL is ready
- [ ] Privacy Policy covers:
  - [ ] What data is collected
  - [ ] How data is used
  - [ ] Data storage and security
  - [ ] Third-party services (Supabase)
  - [ ] User rights (data deletion, etc.)
  - [ ] Contact information

### Terms of Service
- [ ] Terms of Service URL is ready (optional but recommended)
- [ ] Terms cover app usage, limitations, etc.

### Content Ratings
- [ ] iOS: Complete content rating questionnaire
- [ ] Android: Complete content rating questionnaire

## App Configuration

### Version Management
- [ ] Current version in `app.config.ts`: `1.0.0`
- [ ] Build number strategy defined
- [ ] Semantic versioning plan for future updates

### Bundle Identifiers
- [ ] iOS: `com.overtimeplus.app` (verify in `app.config.ts`)
- [ ] Android: `com.overtimeplus.app` (verify in `app.config.ts`)

### App Icons & Assets
- [ ] App icon exists: `assets/icon.png`
- [ ] Adaptive icon (Android): `assets/adaptive-icon.png`
- [ ] Splash screen: `assets/splash.png`
- [ ] Notification icon: `assets/notification-icon.png`
- [ ] Favicon (web): `assets/favicon.png`

## EAS Submit Configuration

### iOS
- [ ] Apple ID configured in `eas.json`
- [ ] App Store Connect App ID configured
- [ ] Apple Team ID configured
- [ ] App Store Connect API key set up (recommended)

### Android
- [ ] Google Play service account key configured
- [ ] Track selection (internal/alpha/beta/production)
- [ ] Google Play Console app created

## Submission Process

### Pre-Submission
- [ ] All testing completed (see `PRODUCTION_TESTING_CHECKLIST.md`)
- [ ] All critical bugs fixed
- [ ] App version updated if needed
- [ ] Build numbers incremented

### iOS Submission
```bash
eas submit --platform ios --profile production
```
- [ ] Build submitted successfully
- [ ] App Store Connect submission completed
- [ ] App review information filled out
- [ ] App submitted for review

### Android Submission
```bash
eas submit --platform android --profile production
```
- [ ] Build uploaded to Google Play Console
- [ ] Store listing completed
- [ ] Content rating completed
- [ ] App submitted for review

## Post-Submission

### iOS
- [ ] Monitor App Store Connect for review status
- [ ] Respond to any review feedback
- [ ] App approved and released

### Android
- [ ] Monitor Google Play Console for review status
- [ ] Respond to any review feedback
- [ ] App approved and released

## Notes

- App Store review can take 1-3 days (iOS) or a few hours to days (Android)
- Be prepared to respond to review feedback quickly
- Keep app metadata updated and accurate
- Privacy Policy is REQUIRED for both stores






