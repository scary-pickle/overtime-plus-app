# Setting Up iOS App in RevenueCat for Sandbox Testing

## The Problem

You currently only have a "Test Store" API key. For App Store Connect sandbox testing, you need:
1. An iOS app configured in RevenueCat
2. Products linked to App Store Connect
3. A production/public API key for iOS

## Step 1: Create iOS App in RevenueCat

1. **Go to RevenueCat Dashboard:**
   - Click on your project "Overtime+"
   - In the left sidebar, click **"Apps"**
   - Click **"+ New App"** or **"Add App"**

2. **Configure iOS App:**
   - **Platform:** Select "iOS"
   - **Bundle ID:** Enter `com.overtimeplus.app` (from your app.config.ts)
   - **App Name:** "Overtime+"
   - Click **"Create"** or **"Save"**

## Step 2: Link App Store Connect

1. **In the iOS app settings:**
   - Find **"App Store Connect"** section
   - Click **"Link App Store Connect"** or **"Connect"**

2. **Authenticate:**
   - Sign in with your Apple Developer account
   - Grant RevenueCat access to App Store Connect
   - Select your app from App Store Connect (if it exists)

3. **If app doesn't exist in App Store Connect yet:**
   - You can still proceed - RevenueCat will work with sandbox
   - The app will be created when you submit to App Store

## Step 3: Link Products to App Store

1. **Go to Products:**
   - RevenueCat Dashboard → **Products**
   - You should see `overtime_plus_monthly` and `overtime_plus_yearly`

2. **For each product:**
   - Click on the product
   - Find **"App Store"** section
   - Click **"Link Product"** or **"Add Store Product"**
   - Enter the Product ID from App Store Connect:
     - Monthly: `prod1c0a9903ca` (you mentioned this earlier)
     - Yearly: `prodda1ac3aa42` (you mentioned this earlier)

3. **If products don't exist in App Store Connect yet:**
   - You need to create them first in App Store Connect
   - Then link them in RevenueCat

## Step 4: Get Production API Key

After setting up the iOS app:

1. **Go to API Keys:**
   - RevenueCat Dashboard → **Project Settings** → **API Keys**
   - Under **SDK API keys**, you should now see:
     - **iOS** (production key - starts with `rc_`)
     - **Test Store** (what you have now)

2. **Copy the iOS Public API Key:**
   - It should start with `rc_`
   - This is your production key

## Alternative: Use Test Store for Now

If you want to test on device without setting up App Store Connect products yet:

1. **Keep using Test Store key:**
   - Test Store works on real devices too
   - But purchases are simulated (not real StoreKit)

2. **For real sandbox testing:**
   - You need the iOS app set up in RevenueCat
   - Products linked to App Store Connect
   - Production API key

## Quick Check: Do You Have Products in App Store Connect?

Before proceeding, check:
1. App Store Connect → Your App → Subscriptions
2. Do you have `overtime_plus_monthly` and `overtime_plus_yearly` created?
3. Are they in "Ready to Submit" or "Approved" status?

If yes → Link them in RevenueCat
If no → Create them in App Store Connect first

## Next Steps

**Option A: Full Sandbox Setup (Recommended)**
1. Create iOS app in RevenueCat
2. Link products to App Store Connect
3. Get production API key
4. Test with real StoreKit

**Option B: Quick Test (Faster)**
1. Keep Test Store key
2. Build on device
3. Test purchase flow (simulated)
4. Set up production later

Which would you like to do?


