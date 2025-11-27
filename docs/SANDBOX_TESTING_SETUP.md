# App Store Connect Sandbox Testing Setup

## Step 1: Get Production RevenueCat API Key

1. **Go to RevenueCat Dashboard:**
   - Navigate to your project
   - Go to **Project Settings** → **API Keys**
   - Find the **Public API Key** for iOS (NOT the test one)
   - It should start with `rc_` (not `test_`)
   - Copy this key

2. **Update your `.env` file:**
   ```bash
   # Replace the test key with production key
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=rc_your_production_key_here
   ```

3. **Restart Metro bundler** after changing `.env`

## Step 2: Set Up Sandbox Tester in App Store Connect

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Navigate to Sandbox Testers:**
   - Click **Users and Access** in the top menu
   - Click **Sandbox Testers** tab
   - Click the **+** button to add a new tester

3. **Create Sandbox Tester:**
   - **First Name:** (any name)
   - **Last Name:** (any name)
   - **Email:** Use a **real email** you can access (needed for verification)
   - **Password:** Create a password (remember this!)
   - **Country/Region:** Select your country
   - Click **Save**

4. **Verify Email:**
   - Check the email inbox you used
   - Click the verification link
   - Sandbox tester is now active

## Step 3: Prepare Your iPhone

1. **Sign Out of App Store:**
   - Settings → [Your Name] → Media & Purchases
   - Tap **Sign Out**
   - This is important! Sandbox won't work if signed into real App Store

2. **Connect iPhone to Mac:**
   - Use USB cable
   - Unlock iPhone
   - Trust computer if prompted

3. **Enable Developer Mode (iOS 16+):**
   - Settings → Privacy & Security → Developer Mode
   - Toggle ON
   - Restart iPhone if prompted

## Step 4: Build and Install on iPhone

### Option A: Using Expo CLI (Recommended)

1. **Stop Metro bundler** if running (Ctrl+C)

2. **Build and install:**
   ```bash
   npx expo run:ios --device
   ```

3. **Select your device** when prompted

4. **Wait for build** - This will:
   - Build the native iOS app
   - Install on your connected iPhone
   - Launch the app

### Option B: Using Xcode

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Select your device:**
   - Top toolbar → Select your iPhone from device list

3. **Sign the app:**
   - Click on "Overtime" project in left sidebar
   - Select "Overtime" target
   - Go to **Signing & Capabilities** tab
   - Select your **Team** (Apple Developer account)
   - Xcode will automatically manage provisioning

4. **Build and Run:**
   - Click the **Play** button (or Cmd+R)
   - Wait for build and installation

## Step 5: Test Sandbox Purchase

1. **Open the app** on your iPhone

2. **Sign in** with your regular account (Supabase auth)

3. **Navigate to paywall:**
   - Go to Profile tab
   - Click "View Paywall"

4. **Attempt a purchase:**
   - Tap "Subscribe" on any plan
   - **App Store sign-in prompt will appear**

5. **Sign in with Sandbox Tester:**
   - Use the **sandbox tester email** you created
   - Use the **sandbox tester password**
   - This is NOT your regular Apple ID!

6. **Complete purchase:**
   - Confirm the purchase
   - It will be FREE (sandbox purchases don't charge)
   - Purchase should complete successfully

## Step 6: Verify Purchase

### In RevenueCat Dashboard:
1. Go to **Customers**
2. Search for your user ID
3. Should show active subscription
4. Check **Events** tab - should show purchase event

### In App Store Connect:
1. Go to **Sales and Trends**
2. Click **Sandbox Purchases** tab
3. Should see your test purchase
4. May take a few minutes to appear

### In Your App:
1. Paywall should disappear
2. Profile should show "Subscription Active"
3. All features should be unlocked

## Troubleshooting

### "No Sandbox Account" Error
- Make sure you signed out of App Store on device
- Make sure sandbox tester email is verified
- Try signing in with sandbox tester again

### Build Fails / Signing Error
- Make sure your Apple Developer account is added to Xcode
- Check Team is selected in Signing & Capabilities
- Make sure bundle ID matches: `com.overtimeplus.app`

### Purchase Doesn't Work
- Verify you're using production API key (not test)
- Check RevenueCat Dashboard → Products → Products are linked
- Make sure offering is set as "Current"
- Check app logs for errors

### Can't Find Device
- Make sure iPhone is unlocked
- Trust computer on iPhone
- Check USB cable connection
- Try: `xcrun xctrace list devices` to see connected devices

## Switching Back to Test Store

If you want to go back to Test Store for simulator testing:

1. Update `.env`:
   ```bash
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd
   ```

2. Restart Metro bundler

3. Test Store works in simulator, Sandbox only works on real devices

## Next Steps

After successful sandbox test:
- ✅ Verify webhook receives purchase events
- ✅ Check Supabase subscription status updates
- ✅ Test cancellation flow
- ✅ Test restore purchases
- ✅ Test grace period


