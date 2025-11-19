# Testing the Paywall - Quick Guide

## Why the Paywall Isn't Showing

The paywall won't show for new users because:
1. **Feature flag is disabled** - The `enable_paywall` flag defaults to `false`
2. **Legacy free access** - New users get `legacy_free_access = true` automatically

## Step 1: Enable Paywall Feature Flag

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
UPDATE remote_feature_flags
SET value = jsonb_build_object(
  'enabled', true,
  'cohort_percentage', 100,
  'target_group', 'testing'
)
WHERE key = 'enable_paywall';
```

## Step 2: Disable Legacy Access for Test User (Optional)

To force the paywall to show for a specific test user:

```sql
-- Replace 'your-test-user-id' with the actual user ID
UPDATE profiles
SET legacy_free_access = false
WHERE user_id = 'your-test-user-id';
```

**OR** navigate to the paywall manually (see Step 3).

## Step 3: Access the Paywall Manually

Even if it doesn't auto-redirect, you can access it directly:

1. **In the app**, navigate to: **Profile tab**
2. Look for the **Subscription Status Card** at the top
3. Click **"View Paywall"** or **"Unlock Access"** button
4. This will take you to `/subscription/paywall`

**OR** you can manually navigate by:
- Opening the app
- Going to Profile tab
- The subscription card should have a button to view the paywall

## Step 4: Configure RevenueCat Products

For the paywall to show subscription options, you need to:

### A. Create Products in RevenueCat Dashboard

1. Go to RevenueCat Dashboard → **Products**
2. Click **"+ Add Product"**
3. Add `overtime_plus_monthly`:
   - Product ID: `overtime_plus_monthly`
   - Store: **App Store** (link to your App Store subscription)
   - Store Product ID: `overtime_plus_monthly`
4. Add `overtime_plus_yearly`:
   - Product ID: `overtime_plus_yearly`
   - Store: **App Store**
   - Store Product ID: `overtime_plus_yearly`

### B. Create Entitlement

1. Go to **Entitlements**
2. Click **"+ Add Entitlement"**
3. Name: `premium` (or your preferred name)
4. Attach both products to this entitlement

### C. Create Offering

1. Go to **Offerings**
2. Click **"+ Add Offering"**
3. Name: `default` (or your preferred name)
4. Add both products (`overtime_plus_monthly` and `overtime_plus_yearly`)
5. Set as **Current Offering**

### D. Set API Keys

Make sure you have set the RevenueCat API keys in your `.env`:

```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=<your-ios-public-key>
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=<your-android-public-key>
```

## Step 5: Test the Paywall

1. **Restart your app** (to reload the feature flag)
2. **Sign in** with your test user
3. The paywall should either:
   - Auto-redirect you (if `legacy_free_access = false`)
   - Be accessible via Profile → Subscription card → "View Paywall"

## What the Paywall Looks Like

The paywall screen (`/subscription/paywall`) includes:

1. **Status Card** - Shows current subscription status
2. **Trial Eligibility Badge** - If eligible for free trial
3. **Subscription Plans** - Monthly and Yearly options with:
   - Product name
   - Price
   - "Start Free Trial" or "Subscribe" button
4. **Restore Purchases** button
5. **Manage Subscription** link
6. **Information callouts** about cancellation policy

## Troubleshooting

### Paywall shows but no products appear

- Check RevenueCat Dashboard → Offerings → Make sure offering is set as "Current"
- Check that products are linked to App Store subscriptions
- Verify API keys are set correctly
- Try refreshing the paywall (pull to refresh)

### Paywall doesn't show at all

- Verify feature flag is enabled (Step 1)
- Check that user doesn't have `legacy_free_access = true` (unless acknowledged)
- Make sure subscription store is initialized (check app logs)

### Products show but can't purchase

- Make sure App Store subscriptions are approved (can take 24-48 hours)
- For testing, use sandbox/test accounts
- Check RevenueCat logs for errors

## Getting Screenshot for Apple Review

Once the paywall is working:

1. Navigate to the paywall screen
2. Take a screenshot showing:
   - Both subscription options (monthly/yearly)
   - Pricing information
   - Free trial messaging
   - "Start Free Trial" buttons
3. Use this screenshot in App Store Connect → Subscription → Review Information

## Quick Test Checklist

- [ ] Feature flag enabled (`enable_paywall.enabled = true`)
- [ ] RevenueCat products created and linked
- [ ] Entitlement created and products attached
- [ ] Offering created and set as current
- [ ] API keys set in `.env`
- [ ] App restarted to reload config
- [ ] Paywall accessible (manual navigation or auto-redirect)
- [ ] Products showing on paywall screen
- [ ] Screenshot taken for Apple review

