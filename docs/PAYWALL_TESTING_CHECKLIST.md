# Paywall Testing Checklist

## Pre-Testing Setup

### 1. Enable Paywall Feature Flag

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

### 2. Verify Test API Key is Set

Check your `.env` file has:
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd
```

### 3. Restart Your App

Restart the app to load the new feature flag and API key.

## Testing Steps

### Test 1: Paywall Appears

1. **Sign in** with a test user account
2. **Navigate to Profile tab**
3. **Check Subscription Status Card:**
   - Should show subscription status
   - Should have "View Paywall" or "Unlock Access" button
4. **Click the button** to go to paywall
5. **OR** navigate directly to `/subscription/paywall`

**Expected Result:**
- ✅ Paywall screen loads
- ✅ Shows subscription status card
- ✅ Shows trial eligibility message (if eligible)
- ✅ Shows subscription plans (monthly/yearly)

### Test 2: Products Display

On the paywall screen, verify:

1. **Monthly subscription card appears:**
   - Shows product name
   - Shows price
   - Shows "Start Free Trial" or "Subscribe" button

2. **Yearly subscription card appears:**
   - Shows product name
   - Shows price
   - Shows "Start Free Trial" or "Subscribe" button

3. **Trial eligibility:**
   - If eligible: Shows "You are eligible for a 1-month free trial"
   - If not eligible: Shows "Free trials are unavailable for this account"

**Expected Result:**
- ✅ Both products visible
- ✅ Prices displayed correctly
- ✅ Trial messaging appropriate

### Test 3: Purchase Flow (Sandbox)

**For iOS Testing:**

1. **Set up sandbox test account:**
   - App Store Connect → Users and Access → Sandbox Testers
   - Create a test account (use a different email than your Apple ID)

2. **Sign out of regular Apple ID:**
   - Settings → App Store → Sign Out (on device/simulator)

3. **On paywall screen:**
   - Click "Start Free Trial" on monthly or yearly
   - When prompted, sign in with sandbox test account
   - Complete the purchase flow

**Expected Result:**
- ✅ Purchase dialog appears
- ✅ Can sign in with sandbox account
- ✅ Purchase completes (no real charge)
- ✅ Subscription status updates
- ✅ User gets access to app

### Test 4: Subscription Status Updates

After purchase:

1. **Check Profile tab:**
   - Subscription status should show "Trial Active" or "Subscription Active"
   - Should show days remaining (if in trial)

2. **Check Supabase database:**
   ```sql
   SELECT 
     user_id,
     subscription_status,
     trial_consumed,
     trial_started_at,
     trial_expires_at,
     subscription_product_id
   FROM profiles
   WHERE user_id = 'your-test-user-id';
   ```

**Expected Result:**
- ✅ Status updated in app
- ✅ Database shows correct subscription status
- ✅ Trial dates set correctly

### Test 5: Webhook Receives Events

1. **Check Supabase function logs:**
   - Supabase Dashboard → Edge Functions → `revenuecat-webhook` → Logs
   - Should see webhook events logged

2. **Check RevenueCat Dashboard:**
   - RevenueCat Dashboard → Customers
   - Find your test user
   - Should show subscription active

**Expected Result:**
- ✅ Webhook receives INITIAL_PURCHASE event
- ✅ Database updated via webhook
- ✅ Customer visible in RevenueCat

### Test 6: Restore Purchases

1. **Sign out and sign back in** (or use different device)
2. **On paywall screen:**
   - Click "Restore Purchases"
   - Wait for restore to complete

**Expected Result:**
- ✅ Previous purchase restored
- ✅ Subscription status updated
- ✅ Access granted

### Test 7: Legacy User Flow

1. **Create a new user** (or use existing user with `legacy_free_access = true`)
2. **Sign in:**
   - Should see legacy acknowledgement modal
   - Acknowledge the modal
   - Should then see paywall

**Expected Result:**
- ✅ Modal appears for legacy users
- ✅ After acknowledgement, paywall shows
- ✅ Can proceed with subscription

## Troubleshooting

### Paywall doesn't show products

**Check:**
- [ ] Feature flag enabled
- [ ] API key set correctly
- [ ] App restarted
- [ ] RevenueCat offering set as "Current"
- [ ] Products linked to App Store subscriptions
- [ ] Try pull-to-refresh on paywall

**Debug:**
- Check app logs for RevenueCat errors
- Check RevenueCat Dashboard → Offerings → Verify current offering
- Check RevenueCat Dashboard → Products → Verify products are active

### Purchase fails

**Check:**
- [ ] Using sandbox test account (iOS)
- [ ] Signed out of regular Apple ID
- [ ] App Store subscriptions approved (for production)
- [ ] Network connection stable

**Debug:**
- Check app logs for purchase errors
- Check RevenueCat Dashboard → Customers → Check for errors
- Verify sandbox test account is active

### Webhook not receiving events

**Check:**
- [ ] Webhook URL configured in RevenueCat
- [ ] Authorization header set correctly
- [ ] REVENUECAT_SECRET_KEY set in Supabase
- [ ] Webhook events selected (INITIAL_PURCHASE, RENEWAL, etc.)

**Debug:**
- Check RevenueCat Dashboard → Webhooks → Delivery logs
- Check Supabase function logs
- Test webhook manually if needed

## Screenshot for Apple Review

Once everything works:

1. **Navigate to paywall screen**
2. **Take screenshot showing:**
   - Both subscription options (monthly/yearly)
   - Pricing information
   - Free trial messaging
   - "Start Free Trial" buttons
3. **Use in App Store Connect:**
   - Subscription → Review Information → Upload screenshot

## Success Criteria

- [ ] Paywall appears and shows products
- [ ] Products display correct prices
- [ ] Trial eligibility works correctly
- [ ] Purchase flow completes in sandbox
- [ ] Subscription status updates in app
- [ ] Database updated correctly
- [ ] Webhook receives events
- [ ] Restore purchases works
- [ ] Legacy user flow works
- [ ] Screenshot captured for Apple review

## Next Steps After Testing

Once testing is complete:

1. **Switch to production API keys** (when ready for real users)
2. **Link to production App Store subscriptions**
3. **Update Supabase secret** with production key
4. **Submit app for review** with subscription screenshot
5. **Monitor webhook logs** for production events

