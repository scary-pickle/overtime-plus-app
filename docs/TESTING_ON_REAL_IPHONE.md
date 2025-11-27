# Testing RevenueCat on Real iPhone - Complete Guide

## Overview

Testing on a real iPhone requires different setup than the iOS Simulator. The StoreKit Configuration file only works in the simulator. For real devices, you have two options:

1. **App Store Connect Sandbox** (Recommended) - Real StoreKit testing
2. **RevenueCat Test Store** (Quick) - Simulated purchases, works on device

## Option 1: App Store Connect Sandbox (Recommended for Production Testing)

This uses real StoreKit and requires App Store Connect products to be set up.

### Prerequisites

- ✅ App Store Connect products created and approved (see `APP_STORE_CONNECT_PRODUCTS_SETUP.md`)
- ✅ Products linked in RevenueCat dashboard
- ✅ Production RevenueCat API key (not test key)

### Step 1: Get Production API Key

1. **Go to RevenueCat Dashboard:**
   - Navigate to your project
   - Go to **Project Settings** → **API Keys**
   - Find the **Public API Key** for iOS (starts with `rc_` or `appl_`, NOT `test_`)
   - Copy this key

2. **Update your `.env` file:**
   ```bash
   # Replace test key with production key
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=rc_your_production_key_here
   ```

3. **Restart Metro bundler** (if running):
   ```bash
   # Stop current Metro (Ctrl+C)
   # Then restart
   npx expo start
   ```

### Step 2: Create Sandbox Tester

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Navigate to Sandbox Testers:**
   - Click **Users and Access** in top menu
   - Click **Sandbox Testers** tab
   - Click **+** button to add new tester

3. **Create Sandbox Tester:**
   - **First Name:** (any name, e.g., "Test")
   - **Last Name:** (any name, e.g., "User")
   - **Email:** Use a **real email** you can access (needed for verification)
   - **Password:** Create a password (remember this!)
   - **Country/Region:** Select your country
   - Click **Save**

4. **Verify Email:**
   - Check the email inbox you used
   - Click the verification link
   - Sandbox tester is now active

### Step 3: Prepare Your iPhone

1. **Sign Out of App Store:**
   - Settings → [Your Name] → Media & Purchases
   - Tap **Sign Out**
   - ⚠️ **Important!** Sandbox won't work if signed into real App Store

2. **Connect iPhone to Mac:**
   - Use USB cable
   - Unlock iPhone
   - Trust computer if prompted

3. **Enable Developer Mode (iOS 16+):**
   - Settings → Privacy & Security → Developer Mode
   - Toggle ON
   - Restart iPhone if prompted

### Step 4: Build and Install on iPhone

#### Option A: Using Expo CLI (Recommended)

```bash
# Make sure you're in the project directory
cd /Users/nathanaeldavidson/Overtime+

# Build and install on connected device
npx expo run:ios --device
```

- Select your iPhone when prompted
- Wait for build and installation
- App will launch automatically

#### Option B: Using Xcode

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Select your device:**
   - Top toolbar → Select your iPhone from device dropdown

3. **Sign the app:**
   - Click on "Overtime" project in left sidebar
   - Select "Overtime" target
   - Go to **Signing & Capabilities** tab
   - Select your **Team** (Apple Developer account)
   - Xcode will automatically manage provisioning

4. **Build and Run:**
   - Click the **Play** button (or ⌘R)
   - Wait for build and installation

### Step 5: Test Sandbox Purchase

1. **Open the app** on your iPhone

2. **Sign in** with your regular account (Supabase auth)

3. **Navigate to paywall:**
   - Go to Profile tab
   - Click "View Paywall" or navigate to `/subscription/paywall`

4. **Attempt a purchase:**
   - Tap "Subscribe" on any plan (monthly or yearly)
   - **App Store sign-in prompt will appear**

5. **Sign in with Sandbox Tester:**
   - Use the **sandbox tester email** you created
   - Use the **sandbox tester password**
   - ⚠️ This is NOT your regular Apple ID!

6. **Complete purchase:**
   - Confirm the purchase
   - It will be **FREE** (sandbox purchases don't charge)
   - Purchase should complete successfully

### Step 6: Verify Purchase

#### In RevenueCat Dashboard:
1. Go to **Customers**
2. Search for your user ID
3. Should show active subscription
4. Check **Events** tab - should show purchase event

#### In App Store Connect:
1. Go to **Sales and Trends**
2. Click **Sandbox Purchases** tab
3. Should see your test purchase
4. May take a few minutes to appear

#### In Your App:
1. Paywall should disappear
2. Profile should show "Subscription Active"
3. All features should be unlocked

---

## Option 2: RevenueCat Test Store (Quick Testing)

If you haven't set up App Store Connect products yet, you can use RevenueCat Test Store. This works on real devices but uses simulated purchases.

### Prerequisites

- ✅ Test RevenueCat API key (starts with `test_`)
- ✅ Products configured in RevenueCat dashboard (can be test products)

### Step 1: Verify Test API Key

Check your `.env` file has the test key:
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd
```

### Step 2: Build and Install

Same as Option 1, Step 4:
```bash
npx expo run:ios --device
```

### Step 3: Test Purchase

1. **Open app** on iPhone
2. **Sign in** with your account
3. **Navigate to paywall**
4. **Tap "Subscribe"**
5. **No App Store sign-in required** - purchase is simulated
6. **Purchase completes immediately**

### Limitations of Test Store

- ❌ Doesn't use real StoreKit
- ❌ Won't appear in App Store Connect sandbox
- ❌ Not as realistic as real sandbox testing

---

## Troubleshooting: Offerings Empty on Real Device

If you see `Error fetching offerings` on a real iPhone (not simulator):

- ✅ Use the **production** RevenueCat API key for App Store Connect testing (not `test_...`).
- ✅ Ensure your IAPs in App Store Connect are fully set up (pricing/localization) and submitted/approved. Status should be at least **Waiting for Review** or **Approved**; **Ready to Submit** isn’t fetchable.
- ✅ Agreements/Tax/Banking in App Store Connect must be active.
- ✅ Product IDs in App Store Connect must match RevenueCat (`overtime_plus_monthly`, `overtime_plus_yearly`) and be linked to the products in RC; the offering should point to those packages.
- ✅ Bundle ID in App Store Connect must match the app (com.overtimeplus.app), and the build you’re running should be signed with that bundle ID.
- ✅ On device, sign out of the App Store and sign in with a **Sandbox Tester** account when prompted at purchase time (for real StoreKit tests).
- ✅ Works without App Store Connect products
- ✅ Instant purchases
- ✅ Good for testing app logic

---

## Troubleshooting

### "No Sandbox Account" Error

**Issue**: App Store prompts for sandbox account but can't sign in

**Solutions**:
1. Make sure you signed out of App Store on device (Settings → [Your Name] → Media & Purchases → Sign Out)
2. Verify sandbox tester email is verified (check email inbox)
3. Try signing in with sandbox tester again
4. Make sure you're using production API key (not test key)

### Build Fails / Signing Error

**Issue**: Xcode can't sign the app

**Solutions**:
1. Make sure your Apple Developer account is added to Xcode (Xcode → Settings → Accounts)
2. Check Team is selected in Signing & Capabilities
3. Make sure bundle ID matches: `com.overtimeplus.app`
4. Try cleaning build folder (⌘⇧K) and rebuilding

### Purchase Doesn't Work

**Issue**: Purchase fails or products don't load

**Solutions**:
1. **For Sandbox**: Verify you're using production API key (not test)
2. **For Sandbox**: Check RevenueCat Dashboard → Products → Products are linked to App Store Connect
3. **For Sandbox**: Make sure offering is set as "Current" in RevenueCat
4. **For Test Store**: Verify test API key is set correctly
5. Check app logs for specific errors
6. Verify product IDs match exactly: `overtime_plus_monthly`, `overtime_plus_yearly`

### Can't Find Device

**Issue**: Xcode/Expo can't see your iPhone

**Solutions**:
1. Make sure iPhone is unlocked
2. Trust computer on iPhone (tap "Trust" when prompted)
3. Check USB cable connection
4. Try unplugging and replugging
5. Check: `xcrun xctrace list devices` to see connected devices
6. Make sure Developer Mode is enabled (iOS 16+)

### Products Don't Load

**Issue**: Paywall shows but no products appear

**Solutions**:
1. **For Sandbox**: Products must exist in App Store Connect and be approved
2. **For Sandbox**: Products must be linked in RevenueCat dashboard
3. **For Test Store**: Products must be created in RevenueCat dashboard
4. Check app logs for RevenueCat errors
5. Verify API key is correct (production for sandbox, test for test store)
6. Try refreshing the paywall (pull down to refresh)

### "Missing App Store Connect API credentials" Warning

**Issue**: Still seeing this warning in logs

**Solutions**:
1. This is just a warning, doesn't break functionality
2. To fix: Follow `APP_STORE_CONNECT_API_CREDENTIALS_SETUP.md`
3. Or ignore it - app will still work

---

## Quick Comparison

| Feature | Test Store | Sandbox |
|---------|-----------|---------|
| **Setup Time** | 5 minutes | 30-60 minutes + approval wait |
| **Requires App Store Connect Products** | ❌ No | ✅ Yes |
| **Uses Real StoreKit** | ❌ No | ✅ Yes |
| **Works on Real Device** | ✅ Yes | ✅ Yes |
| **App Store Sign-in Required** | ❌ No | ✅ Yes |
| **Appears in App Store Connect** | ❌ No | ✅ Yes |
| **Realistic Testing** | ⚠️ Limited | ✅ Full |
| **Best For** | Quick testing | Production testing |

---

## Recommended Workflow

### Development Phase:
1. ✅ Use **Test Store** for quick iteration
2. ✅ Test in iOS Simulator with StoreKit Configuration file
3. ✅ Test app logic and UI

### Pre-Production Phase:
1. ✅ Set up App Store Connect products
2. ✅ Wait for approval (24-48 hours)
3. ✅ Switch to **Sandbox** testing
4. ✅ Test on real device with sandbox testers
5. ✅ Verify webhooks work
6. ✅ Test all purchase flows

### Production:
1. ✅ Use production API keys
2. ✅ Monitor RevenueCat dashboard
3. ✅ Monitor App Store Connect

---

## Next Steps

After successful testing:

1. **Verify Webhooks:**
   - Check Supabase receives purchase events
   - Verify subscription status updates in database

2. **Test Edge Cases:**
   - Subscription cancellation
   - Restore purchases
   - Grace period
   - Trial expiration

3. **Monitor:**
   - RevenueCat Dashboard → Customers
   - App Store Connect → Sandbox Purchases
   - Your app's subscription status

---

## Related Documentation

- `SANDBOX_TESTING_SETUP.md` - Detailed sandbox setup
- `APP_STORE_CONNECT_PRODUCTS_SETUP.md` - Create App Store Connect products
- `STOREKIT_SETUP_GUIDE.md` - StoreKit Configuration file (simulator only)
- `REVENUECAT_VS_SANDBOX_EXPLAINED.md` - Understand the difference

---

**Quick Start**: If you just want to test quickly, use **Option 2 (Test Store)**. For production-ready testing, use **Option 1 (Sandbox)** after setting up App Store Connect products.
