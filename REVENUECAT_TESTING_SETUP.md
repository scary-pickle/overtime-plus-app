# RevenueCat Testing Setup Guide

## Step 1: Set Test API Key

Add the test API key to your `.env` file:

```bash
# For iOS testing (use the test key you provided)
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd

# For Android testing (get the Android test key from RevenueCat Dashboard)
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=test_android_key_here
```

**Note:** Test keys start with `test_` prefix. Production keys start with `rc_` or `appl_`/`goog_`.

## Step 2: Create Test Products in RevenueCat

You can create test products that don't require App Store approval:

1. **Go to RevenueCat Dashboard → Products**
2. **Create Test Products:**
   - Product ID: `overtime_plus_monthly_test` (or use the same IDs)
   - Store: **App Store** (sandbox mode)
   - Store Product ID: `overtime_plus_monthly` (can use same IDs for testing)

3. **Or use existing products:**
   - If you've already created `overtime_plus_monthly` and `overtime_plus_yearly`, they'll work in sandbox mode
   - RevenueCat automatically uses sandbox when using test API keys

## Step 3: Create Test Entitlement

1. **Go to Entitlements**
2. **Create or use existing entitlement:**
   - Identifier: `premium`
   - Attach your test products

## Step 4: Create Test Offering

1. **Go to Offerings**
2. **Create offering:**
   - Identifier: `default`
   - Add packages with your test products
   - Set as "Current Offering"

## Step 5: Test in Sandbox Mode

### For iOS Testing:

1. **Use a sandbox test account:**
   - Create test account in App Store Connect → Users and Access → Sandbox Testers
   - Sign out of your regular Apple ID on the device/simulator
   - When prompted during purchase, use the sandbox test account

2. **Build and test:**
   ```bash
   # Build for iOS simulator
   eas build --platform ios --profile ios-simulator
   
   # Or run locally
   npx expo start
   ```

3. **Test flow:**
   - Navigate to paywall
   - Products should appear
   - Try purchasing (will use sandbox, no real charge)
   - Verify subscription status updates

### For Android Testing:

1. **Use license testing:**
   - Add test accounts in Google Play Console → Setup → License Testing
   - Up to 100 test accounts

2. **Build and test:**
   ```bash
   eas build --platform android --profile development
   ```

## Step 6: Verify Test Setup

Check that test mode is working:

1. **Products appear on paywall** ✅
2. **Can initiate purchase** ✅
3. **Sandbox purchase completes** ✅
4. **Subscription status updates** ✅
5. **Webhook receives events** ✅

## Step 7: Switch to Production (After Testing)

Once testing is complete:

1. **Get production API keys:**
   - RevenueCat Dashboard → Project Settings → API Keys
   - Copy **Public API Key (iOS)** - starts with `appl_` or `rc_`
   - Copy **Public API Key (Android)** - starts with `goog_` or `rc_`

2. **Update `.env` for production:**
   ```bash
   # Production keys (for production builds)
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_production_key_here
   EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_production_key_here
   ```

3. **Link to real App Store products:**
   - Make sure products in RevenueCat are linked to approved App Store subscriptions
   - Products should use the same IDs: `overtime_plus_monthly`, `overtime_plus_yearly`

4. **Set production secret key in Supabase:**
   ```bash
   supabase secrets set REVENUECAT_SECRET_KEY=<production-secret-key>
   ```

## Testing Checklist

- [ ] Test API key set in `.env`
- [ ] Products created in RevenueCat (or existing products work in sandbox)
- [ ] Entitlement created and products attached
- [ ] Offering created and set as current
- [ ] App restarted to load new API key
- [ ] Paywall shows products
- [ ] Sandbox purchase works
- [ ] Subscription status updates correctly
- [ ] Webhook receives test events

## Important Notes

1. **Test vs Production Keys:**
   - Test keys (`test_*`) → Sandbox mode, no real charges
   - Production keys (`appl_*`, `goog_*`, `rc_*`) → Real purchases

2. **Same Product IDs:**
   - You can use the same product IDs (`overtime_plus_monthly`, `overtime_plus_yearly`) for both test and production
   - RevenueCat automatically uses sandbox when test keys are used

3. **App Store Sandbox:**
   - Requires sandbox test accounts
   - No real charges
   - Subscriptions expire quickly (for testing)

4. **When to Switch:**
   - Test thoroughly with test keys first
   - Only switch to production keys when ready for real users
   - Production builds should use production keys

