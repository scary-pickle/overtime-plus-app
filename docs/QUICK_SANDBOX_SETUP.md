# Quick Sandbox Setup Steps

## ⚡ Quick Start

### 1. Get Production RevenueCat API Key
- Go to RevenueCat Dashboard → Project Settings → API Keys
- Copy the **Public API Key** for iOS (starts with `rc_`, NOT `test_`)
- Update your `.env` file:
  ```
  EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=rc_your_production_key_here
  ```

### 2. Create Sandbox Tester
- App Store Connect → Users and Access → Sandbox Testers
- Click **+** → Fill in details → Use a real email you can access
- Verify the email when you receive it

### 3. Sign Out of App Store on iPhone
- Settings → [Your Name] → Media & Purchases → Sign Out

### 4. Build and Install
Run this command (your iPhone is already connected):
```bash
npx expo run:ios --device
```

### 5. Test Purchase
- Open app → Go to paywall → Tap Subscribe
- When prompted, sign in with **sandbox tester** email/password
- Purchase will be free (sandbox doesn't charge)

## Your Connected Device
✅ iPhone detected: "Henoch-Schonlein Iphone"

Ready to build!


