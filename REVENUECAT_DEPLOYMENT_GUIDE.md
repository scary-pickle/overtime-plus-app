# RevenueCat Integration Deployment Guide

This guide covers the deployment steps required to complete the RevenueCat payment provider integration.

## ✅ Completed

- ✅ Database migration applied (`20251115235959_add_subscription_and_paywall_support.sql`)
- ✅ Client-side subscription store and utilities implemented
- ✅ Paywall screen with trial messaging
- ✅ Profile screen subscription status card
- ✅ Legacy user acknowledgement modal
- ✅ RevenueCat webhook Edge Function created
- ✅ Nightly reconciliation Edge Function created

## 🔧 Required Actions

### 1. Deploy Supabase Edge Functions

#### Deploy RevenueCat Webhook Handler

```bash
cd supabase/functions/revenuecat-webhook
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

**Set environment variables/secrets:**
```bash
# Get your RevenueCat secret key from: https://app.revenuecat.com/projects/<project-id>/settings/keys
supabase secrets set REVENUECAT_SECRET_KEY=<your-revenuecat-secret-key>
```

**Configure webhook in RevenueCat Dashboard:**
1. Go to RevenueCat Dashboard → Project Settings → Webhooks
2. Add webhook URL: `https://<your-project-ref>.supabase.co/functions/v1/revenuecat-webhook`
3. Select events to send:
   - `INITIAL_PURCHASE` (includes trial starts when period_type='trial')
   - `RENEWAL`
   - `CANCELLATION`
   - `EXPIRATION`
   - `BILLING_ISSUE`
4. Set Authorization header: `Bearer <your-revenuecat-secret-key>`
5. Save webhook

#### Deploy Reconciliation Function

```bash
cd supabase/functions/revenuecat-reconcile
supabase functions deploy revenuecat-reconcile --no-verify-jwt
```

**Set environment variables:**
```bash
supabase secrets set REVENUECAT_SECRET_KEY=<your-revenuecat-secret-key>
# Optional: Set a cron secret for manual triggers
supabase secrets set CRON_SECRET=<random-secret>
```

**Set up nightly cron job:**
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - Name: `revenuecat-reconcile`
   - Schedule: `0 2 * * *` (runs daily at 2 AM UTC)
   - SQL:
   ```sql
   SELECT net.http_post(
     url := 'https://<your-project-ref>.supabase.co/functions/v1/revenuecat-reconcile',
     headers := '{"Content-Type": "application/json"}'::jsonb,
     body := '{}'::jsonb
   ) AS request_id;
   ```

**Alternative: Use pg_cron extension**
```sql
SELECT cron.schedule(
  'revenuecat-reconcile',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/revenuecat-reconcile',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Configure RevenueCat Dashboard

#### Create Subscription Products

1. **App Store Connect (iOS):**
   - Create subscription group
   - Create monthly subscription:
     - Product ID: `overtime_plus_monthly`
     - Price: Set your monthly price
     - Introductory offer: Free trial, 1 month
   - Create yearly subscription:
     - Product ID: `overtime_plus_yearly`
     - Price: Set your yearly price
     - Introductory offer: Free trial, 1 month
   - Submit for review (can take 24-48 hours)

2. **Google Play Console (Android):**
   - Create subscription products
   - Monthly: `overtime_plus_monthly` with 1-month free trial
   - Yearly: `overtime_plus_yearly` with 1-month free trial
   - Set pricing and activate

3. **RevenueCat Dashboard:**
   - Go to Products → Create products
   - Add `overtime_plus_monthly` and `overtime_plus_yearly`
   - Link to App Store/Play Store products
   - Create entitlement: `premium` (or your preferred name)
   - Create offering with both products
   - Ensure product IDs match `DEFAULT_SUBSCRIPTION_PRODUCTS` in `lib/utils/subscription.ts`:
     ```typescript
     export const DEFAULT_SUBSCRIPTION_PRODUCTS = [
       'overtime_plus_monthly',
       'overtime_plus_yearly',
     ];
     ```

#### Get API Keys

1. Go to RevenueCat Dashboard → Project Settings → API Keys
2. Copy:
   - **Public API Key (iOS)** → Set as `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
   - **Public API Key (Android)** → Set as `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
   - **Secret API Key** → Set as `REVENUECAT_SECRET_KEY` in Supabase secrets

### 3. Set Environment Variables

#### Client-side (Expo)

Add to your `.env` file:
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=<ios-public-key>
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=<android-public-key>
```

**For EAS Build:**
```bash
# Set secrets in EAS
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_IOS --value <ios-public-key>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value <android-public-key>
```

#### Server-side (Supabase)

Already set in step 1 above via `supabase secrets set`.

### 4. Test the Integration

#### Build Development Clients

**iOS Simulator:**
```bash
eas build --platform ios --profile ios-simulator
```

**Android Device/Emulator:**
```bash
eas build --platform android --profile development
```

#### Test Scenarios

1. **New User Trial:**
   - Sign up new account
   - Should see paywall with "Start Free Trial" option
   - Complete purchase → Verify trial starts
   - Check Supabase `profiles` table: `subscription_status = 'trial'`, `trial_consumed = true`

2. **Legacy User:**
   - Sign in with existing account (has `legacy_free_access = true`)
   - Should see acknowledgement modal
   - Acknowledge → `paywall_acknowledged_at` set
   - Should then see paywall

3. **Trial Expiration:**
   - Wait for trial to expire (or use RevenueCat sandbox to simulate)
   - Verify webhook updates `subscription_status = 'active'`
   - Verify auto-renewal works

4. **Cancellation:**
   - Cancel during trial → Access should be revoked immediately
   - Cancel during paid period → Access should continue until expiration
   - After expiration → 7-day grace period for exports

5. **Restore Purchases:**
   - Test restore on different device
   - Verify subscription status syncs

6. **Webhook Testing:**
   - Use RevenueCat webhook testing tool
   - Send test events and verify Supabase updates

7. **Reconciliation:**
   - Manually trigger: `curl -X POST https://<project-ref>.supabase.co/functions/v1/revenuecat-reconcile`
   - Verify subscription statuses are corrected

### 5. Staged Rollout

#### Update Feature Flag

Control rollout via `remote_feature_flags.enable_paywall`:

```sql
-- Internal QA only
UPDATE remote_feature_flags
SET value = jsonb_build_object(
  'enabled', true,
  'cohort_percentage', 0,
  'target_group', 'internal'
)
WHERE key = 'enable_paywall';

-- 10% of users
UPDATE remote_feature_flags
SET value = jsonb_build_object(
  'enabled', true,
  'cohort_percentage', 10,
  'target_group', 'beta'
)
WHERE key = 'enable_paywall';

-- 100% rollout
UPDATE remote_feature_flags
SET value = jsonb_build_object(
  'enabled', true,
  'cohort_percentage', 100,
  'target_group', 'production'
)
WHERE key = 'enable_paywall';
```

**Note:** The client-side code currently only checks `enabled`. To implement cohort percentage, update `lib/state/subscriptionStore.ts`:

```typescript
const derivePaywallEnabled = (flags: RemoteFlagMap, userId?: string | null): boolean => {
  const paywallFlag = flags['enable_paywall'];
  if (!paywallFlag?.value) {
    return false;
  }
  if (typeof paywallFlag.value.enabled === 'boolean' && !paywallFlag.value.enabled) {
    return false;
  }
  
  // Implement cohort percentage logic if needed
  const percentage = paywallFlag.value.cohort_percentage ?? 100;
  if (percentage < 100 && userId) {
    // Simple hash-based cohort assignment
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const userCohort = hash % 100;
    if (userCohort >= percentage) {
      return false;
    }
  }
  
  return true;
};
```

### 6. Monitoring & Verification

#### Check Webhook Logs

1. Supabase Dashboard → Edge Functions → `revenuecat-webhook` → Logs
2. RevenueCat Dashboard → Webhooks → Delivery logs

#### Verify Database Updates

```sql
-- Check subscription statuses
SELECT 
  user_id,
  subscription_status,
  trial_consumed,
  subscription_expires_at,
  trial_expires_at,
  grace_period_until,
  legacy_free_access,
  paywall_acknowledged_at
FROM profiles
WHERE subscription_status != 'none'
ORDER BY updated_at DESC
LIMIT 20;
```

#### Monitor Reconciliation

Check reconciliation function logs:
```bash
supabase functions logs revenuecat-reconcile
```

### 7. Production Checklist

Before enabling paywall for all users:

- [ ] Edge functions deployed and tested
- [ ] Webhook configured in RevenueCat and tested
- [ ] Reconciliation cron job scheduled
- [ ] RevenueCat products created and approved in App Store/Play Store
- [ ] Product IDs match `DEFAULT_SUBSCRIPTION_PRODUCTS`
- [ ] API keys set in EAS secrets and Supabase
- [ ] Test purchases work in sandbox/test environment
- [ ] Trial period works correctly
- [ ] Cancellation flows tested (trial vs paid)
- [ ] Restore purchases works
- [ ] Legacy user acknowledgement flow tested
- [ ] Webhook events update database correctly
- [ ] Reconciliation job runs successfully
- [ ] Feature flag rollout strategy defined
- [ ] Monitoring and alerting set up

## Troubleshooting

### Webhook Not Receiving Events

1. Check RevenueCat webhook configuration (URL, auth header)
2. Verify `REVENUECAT_SECRET_KEY` matches in both places
3. Check Supabase function logs for errors
4. Test webhook manually with RevenueCat's test tool

### Subscription Status Not Updating

1. Check webhook logs for delivery failures
2. Manually trigger reconciliation function
3. Verify RevenueCat customer info matches Supabase user ID
4. Check for RLS policy issues (service role should bypass)

### Trial Eligibility Issues

1. Verify `trial_consumed` flag in database
2. Check RevenueCat eligibility API response
3. Ensure App Store/Play Store trial offers are configured correctly

### Legacy Users Not Seeing Modal

1. Verify `legacy_free_access = true` in database
2. Check `paywall_acknowledged_at` is null
3. Ensure modal is shown in paywall screen (already implemented)

## Support

For issues:
1. Check Supabase function logs
2. Check RevenueCat dashboard for customer info
3. Review webhook delivery logs
4. Test with RevenueCat sandbox environment

## Next Steps After Deployment

1. Monitor subscription conversion rates
2. Track trial-to-paid conversion
3. Monitor cancellation rates
4. Collect user feedback on paywall experience
5. Consider A/B testing paywall messaging
6. Evaluate RevenueCat's hosted paywalls for marketing flexibility

