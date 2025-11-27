# Paywall Testing & Reset Guide

## Quick Reset Methods

### Method 1: Reset in RevenueCat Dashboard (Recommended)

1. **Go to RevenueCat Dashboard:**
   - Navigate to your project
   - Go to **Customers** section
   - Search for your user ID (Supabase user ID)

2. **Reset Customer:**
   - Click on the customer
   - Click **"Delete Customer"** or **"Reset Customer"**
   - This clears all subscription history for that user

3. **Alternative - Clear Entitlements:**
   - In the customer view, go to **Entitlements**
   - Remove any active entitlements
   - This simulates a user without a subscription

### Method 2: Use a Different Test User

1. **Create a new test account in your app**
2. **Use a different email** (or delete the old one from Supabase)
3. This gives you a fresh user with no subscription history

### Method 3: Reset in Supabase Database

Run this SQL in Supabase SQL Editor to reset a specific user:

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
UPDATE public.profiles
SET 
  subscription_status = 'none',
  trial_consumed = false,
  trial_started_at = NULL,
  trial_expires_at = NULL,
  subscription_expires_at = NULL,
  subscription_product_id = NULL,
  subscription_cancelled_at = NULL,
  grace_period_until = NULL,
  paywall_acknowledged_at = NULL
WHERE id = 'YOUR_USER_ID';
```

### Method 4: Clear App Data (iOS Simulator)

```bash
# Stop the app
# Then in terminal:
xcrun simctl uninstall booted com.overtimeplus.app

# Or reset the entire simulator:
xcrun simctl erase all
```

### Method 5: Clear App Data (iOS Device)

1. **Delete the app** from your device
2. **Reinstall** via Xcode or TestFlight
3. **Sign in again** with your test account

## Testing Different Scenarios

### Test 1: New User (No Subscription)

1. Reset user in RevenueCat (Method 1)
2. Reset in Supabase (Method 3)
3. Reload app
4. Should see paywall immediately (if `enable_paywall` flag is on)

### Test 2: Trial Eligible User

1. Reset user completely
2. Make sure user hasn't used trial before
3. Should see "Free Trial Available" message
4. Should see "Start Free Trial" button

### Test 3: Trial Active User

1. Purchase a subscription (will start trial)
2. Check Supabase - should have `subscription_status = 'trial'`
3. Paywall should show trial status
4. Should show days remaining

### Test 4: Active Subscription

1. Complete a purchase (or wait for trial to convert)
2. Check Supabase - should have `subscription_status = 'active'`
3. Paywall should not show (user has access)

### Test 5: Grace Period

1. Have an active subscription
2. Cancel it in App Store/Play Store
3. Wait for webhook to process (or manually update Supabase)
4. Update Supabase:
   ```sql
   UPDATE public.profiles
   SET 
     subscription_status = 'grace',
     subscription_cancelled_at = NOW(),
     grace_period_until = NOW() + INTERVAL '7 days'
   WHERE id = 'YOUR_USER_ID';
   ```
5. Reload app - should show grace period status

### Test 6: Expired Subscription

1. Set subscription to expired:
   ```sql
   UPDATE public.profiles
   SET 
     subscription_status = 'none',
     subscription_expires_at = NOW() - INTERVAL '1 day',
     grace_period_until = NULL
   WHERE id = 'YOUR_USER_ID';
   ```
2. Reload app - should show paywall

## Testing Purchase Flow

### iOS Simulator (StoreKit Configuration)

1. **Create StoreKit Configuration File:**
   - In Xcode: File → New → File → StoreKit Configuration File
   - Add your subscription products
   - Set up test scenarios (purchase, cancel, etc.)

2. **Configure Scheme:**
   - Edit Scheme → Run → Options
   - Set StoreKit Configuration to your file

3. **Test Purchases:**
   - Purchases will be simulated
   - No real charges
   - Can test various scenarios

### iOS Device (Sandbox)

1. **Sign out of App Store** on device
2. **Create Sandbox Tester** in App Store Connect:
   - Users and Access → Sandbox Testers
   - Create new tester with test email

3. **Test Purchase:**
   - When prompted, sign in with sandbox tester
   - Purchase will be free/test
   - Can test cancellation, renewal, etc.

## Quick Test Checklist

- [ ] Paywall shows for new users
- [ ] Trial eligible message appears
- [ ] Trial ineligible message appears (for users who used trial)
- [ ] Purchase flow works
- [ ] Subscription status updates after purchase
- [ ] Paywall disappears after successful subscription
- [ ] Restore purchases works
- [ ] Manage subscription link works
- [ ] Grace period shows correctly
- [ ] Trial countdown shows correctly

## Debugging Tips

### Check RevenueCat Status

```bash
# In app logs, look for:
LOG [revenuecat] RevenueCat configured
LOG [revenuecat] RevenueCat logged in
```

### Check Supabase Status

```sql
-- Check user's subscription status
SELECT 
  id,
  email,
  subscription_status,
  trial_consumed,
  trial_started_at,
  subscription_expires_at,
  grace_period_until,
  paywall_acknowledged_at
FROM public.profiles
WHERE id = 'YOUR_USER_ID';
```

### Check Feature Flags

```sql
-- Check if paywall is enabled
SELECT * FROM public.remote_feature_flags
WHERE key = 'enable_paywall';
```

### Force Refresh in App

1. Pull down to refresh on paywall screen
2. Or restart the app
3. Subscription store will re-fetch from RevenueCat and Supabase

## Common Issues

### Paywall Not Showing

1. Check `enable_paywall` feature flag is enabled
2. Check user's `subscription_status` in Supabase
3. Check if user has `legacy_free_access = true` (needs acknowledgement)
4. Check app logs for errors

### Products Not Loading

1. Verify offering is set as "Current" in RevenueCat
2. Check product IDs match `DEFAULT_SUBSCRIPTION_PRODUCTS`
3. Verify API keys are correct in `.env`
4. Check RevenueCat dashboard for product configuration

### Purchase Not Updating Status

1. Check webhook is configured and receiving events
2. Check webhook logs in Supabase Edge Functions
3. Manually trigger reconciliation:
   ```sql
   -- Or call the reconcile function manually
   ```
4. Check RevenueCat dashboard for purchase status

## Reset Everything (Nuclear Option)

```sql
-- Reset ALL users (use with caution!)
UPDATE public.profiles
SET 
  subscription_status = 'none',
  trial_consumed = false,
  trial_started_at = NULL,
  trial_expires_at = NULL,
  subscription_expires_at = NULL,
  subscription_product_id = NULL,
  subscription_cancelled_at = NULL,
  grace_period_until = NULL,
  paywall_acknowledged_at = NULL,
  legacy_free_access = false;
```

Then delete all customers in RevenueCat dashboard (or use their bulk delete if available).


