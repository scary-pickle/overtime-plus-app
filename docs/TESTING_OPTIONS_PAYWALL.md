# Testing Options When Paywall Isn't Working

## Current Situation

You have:
- ✅ StoreKit Configuration file (`ios/Products.storekit`) with products configured
- ❌ StoreKit config not attached to Xcode scheme (causing "App Store problem" errors)
- ❌ Products in App Store Connect are "READY_TO_SUBMIT" (not approved yet)
- ❌ Can't test purchases in simulator

## Option 1: Fix StoreKit Configuration (Recommended for Simulator Testing)

**Best for:** Testing the actual purchase flow in iOS Simulator

### Steps:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Attach StoreKit Configuration:**
   - Product → Scheme → Edit Scheme (or press `⌘<`)
   - Select **Run** in left sidebar
   - Go to **Options** tab (or **Info** tab in older Xcode)
   - Under **StoreKit Configuration**, select `Products.storekit`
   - Click **Close**

3. **Clean and Rebuild:**
   - Product → Clean Build Folder (`⌘⇧K`)
   - Product → Build (`⌘B`)

4. **Run in Simulator:**
   - Select iOS Simulator
   - Press `⌘R` to run
   - Products should now load from StoreKit config file

5. **Test Purchase:**
   - Navigate to paywall
   - Products should appear
   - Purchase should work without real payment

**Why this works:** StoreKit Configuration file bypasses App Store Connect and lets you test purchases locally in the simulator.

---

## Option 2: Disable Paywall for Development

**Best for:** Testing app features without dealing with subscriptions

### Method A: Use Remote Feature Flag (if you have Supabase)

1. **Update Supabase feature flag:**
   ```sql
   UPDATE remote_feature_flags
   SET value = '{"enabled": false}'
   WHERE key = 'enable_paywall';
   ```

2. **Restart app** - paywall will be disabled

### Method B: Add Environment Variable Bypass

Add this to your `.env` file:
```bash
EXPO_PUBLIC_DISABLE_PAYWALL=true
```

Then update `lib/state/subscriptionStore.ts`:
```typescript
const derivePaywallEnabled = (flags: RemoteFlagMap): boolean => {
  // Add dev bypass
  if (process.env.EXPO_PUBLIC_DISABLE_PAYWALL === 'true') {
    return false;
  }
  
  const paywallFlag = flags['enable_paywall'];
  // ... rest of function
};
```

**Why this works:** The app checks `paywallEnabled` first and grants access if disabled.

---

## Option 3: Add Dev Mode Bypass Button

**Best for:** Quick toggle during development

Add a hidden dev button in your paywall screen:

```typescript
// In app/subscription/paywall.tsx
{__DEV__ && (
  <TouchableOpacity
    onPress={async () => {
      // Grant access by updating subscription store
      useSubscriptionStore.setState({
        access: {
          hasAccess: true,
          shouldShowPaywall: false,
          reason: 'paywall-disabled',
        },
      });
      router.back();
    }}
    style={styles.devBypassButton}
  >
    <Text>🔓 Dev: Bypass Paywall</Text>
  </TouchableOpacity>
)}
```

---

## Option 4: Use RevenueCat Test Store (If Working)

**Best for:** Testing RevenueCat integration without StoreKit

1. **Verify you're using test API key:**
   ```bash
   # In .env
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_...
   ```

2. **Create test products in RevenueCat Dashboard:**
   - Products → Create Product
   - Use same IDs: `overtime_plus_monthly`, `overtime_plus_yearly`
   - Mark as "Test Product"

3. **Test in app:**
   - Products should load from RevenueCat
   - Purchases are simulated (no real payment)

**Note:** This might not work if RevenueCat can't fetch products from App Store Connect.

---

## Option 5: Submit Products for Review (For Real Testing)

**Best for:** Production-ready testing

1. **App Store Connect:**
   - Go to your app → In-App Purchases
   - Submit products for review
   - Wait for approval (usually 24-48 hours)

2. **Once approved:**
   - Products will work in sandbox
   - Can test on real devices
   - Can use TestFlight

**Note:** This requires waiting for Apple's review, but gives you the most realistic testing.

---

## Option 6: Test on Real Device with Sandbox

**Best for:** Testing on actual iPhone (requires product approval)

1. **Create Sandbox Tester:**
   - App Store Connect → Users and Access → Sandbox Testers
   - Create new tester with test email

2. **On iPhone:**
   - Sign out of App Store
   - Run app
   - When prompted, sign in with sandbox tester

3. **Test purchase:**
   - Uses real StoreKit
   - No real charges
   - Most realistic testing

**Note:** Still requires products to be approved in App Store Connect.

---

## Quick Fix: Recommended Approach

**For immediate testing, do Option 1 (Fix StoreKit Config):**

1. Open Xcode workspace
2. Edit Run scheme → Options → StoreKit Configuration → Select `Products.storekit`
3. Clean build (`⌘⇧K`)
4. Run in simulator (`⌘R`)
5. Test purchases should work!

**For development without paywall, do Option 2B (Add env variable):**

1. Add `EXPO_PUBLIC_DISABLE_PAYWALL=true` to `.env`
2. Update `derivePaywallEnabled` function
3. Restart app
4. Paywall will be bypassed

---

## Troubleshooting StoreKit Config

If Option 1 doesn't work:

1. **Verify file exists:**
   ```bash
   ls -la ios/Products.storekit
   ```

2. **Check Xcode scheme:**
   - Product → Scheme → Edit Scheme
   - Run → Options
   - StoreKit Configuration should show `Products.storekit`

3. **Try manual path:**
   - In StoreKit Configuration dropdown, browse to `ios/Products.storekit`

4. **Restart Xcode:**
   - Sometimes Xcode needs a restart to pick up changes

5. **Check simulator:**
   - Make sure you're using iOS Simulator (not real device)
   - StoreKit config only works in simulator

---

## Summary

| Option | Speed | Realistic | Setup Time |
|--------|-------|-----------|------------|
| 1. Fix StoreKit Config | ⚡ Fast | ✅ Realistic | 5 min |
| 2. Disable Paywall | ⚡⚡ Very Fast | ❌ Not realistic | 2 min |
| 3. Dev Bypass Button | ⚡ Fast | ❌ Not realistic | 5 min |
| 4. RevenueCat Test | ⚡ Fast | ⚠️ Partial | 10 min |
| 5. Submit for Review | 🐌 Slow | ✅✅ Most realistic | 2 days wait |
| 6. Real Device Sandbox | ⚡ Fast | ✅✅ Most realistic | 30 min (after approval) |

**My Recommendation:** Start with Option 1 (fix StoreKit config) for immediate testing, then add Option 2B (env bypass) for development convenience.

