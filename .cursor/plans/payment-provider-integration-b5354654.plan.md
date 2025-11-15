<!-- b5354654-5770-4105-aee4-d4cf7e5bd451 fd60717b-ee2b-4ea6-b6f4-f38bc31e5623 -->
# Payment Provider Integration with Free Trial

## Overview

Integrate RevenueCat for subscription-based payments with a **1-month free trial** for all new users. After the trial expires, automatic subscription starts. **Cancellation behavior differs by period**: During trial, cancellation makes app unusable immediately. After trial (paid subscription), cancellation prevents auto-renewal but user retains access until the end of the paid period (month or year). RevenueCat is the easiest and cheapest option - free tier up to $10k monthly revenue.

## Payment Model

- **1-month free trial** for all new users
- Trial starts automatically when user signs up and selects subscription plan
- After trial expires, automatic subscription starts (monthly or yearly based on user selection)
- If user cancels subscription, app becomes unusable immediately (hard paywall)
- No free tier - only trial period before paid subscription

## Implementation Steps

### 1. Install Dependencies

- Install `react-native-purchases` (RevenueCat SDK) or `@revenuecat/purchases-expo` for Expo
- Update `app.config.ts` with RevenueCat configuration
- Add RevenueCat API keys to environment variables

### 2. Set Up RevenueCat Account & Products

- Create RevenueCat account
- Configure iOS App Store Connect integration
- Configure Google Play Console integration
- Create subscription products (monthly, yearly) with **introductory offers (free trial)**:
- Monthly: $X.99/month with 1-month free trial
- Yearly: $XX.99/year with 1-month free trial
- Get RevenueCat API keys (public key for app, secret key for backend)

### 3. Create Subscription Store

- Create `lib/state/subscriptionStore.ts` using Zustand
- Store subscription status, entitlements, active products, and **trial status**
- Add methods:
- `checkSubscriptionStatus()` - Check if user has active subscription OR active trial
- `isInTrial()` - Check if currently in trial period
- `getTrialInfo()` - Get trial start date, end date, days remaining
- `restorePurchases()` - Restore previous purchases
- `purchaseSubscription()` - Start subscription (begins trial if first time)
- Initialize RevenueCat SDK with user ID from auth store
- Track trial expiration and auto-conversion to paid subscription

### 4. Database Schema Updates

- Add `subscription_status` column to `profiles` table (enum: 'trial', 'active', 'expired', 'cancelled')
- Add `subscription_expires_at` timestamp
- Add `trial_started_at` timestamp
- Add `trial_expires_at` timestamp
- Add `subscription_product_id` (monthly/yearly)
- Add `subscription_cancelled_at` timestamp (for tracking cancellations)
- Create migration: `supabase/migrations/YYYYMMDD_add_subscriptions.sql`

### 5. Backend Integration (Supabase)

- Create Supabase Edge Function or use webhooks to sync subscription status
- Store subscription status when user purchases/restores/starts trial
- Verify subscription status on app launch
- Add RLS policies for subscription data
- Handle trial expiration and conversion to paid subscription

### 6. Create Paywall Screen

- Create `app/subscription/paywall.tsx` screen
- Display subscription options (monthly/yearly) with **"1-month free trial"** messaging
- Show pricing with trial information
- Display trial countdown if user is in trial period
- Add "Start Free Trial" button (converts to "Subscribe" after trial)
- Add "Restore Purchases" button
- Handle purchase flow with RevenueCat
- Show loading states and error handling
- Show cancellation warning (app becomes unusable if cancelled)

### 7. Add Subscription Checks

- Update `app/_layout.tsx` to check subscription on app launch
- Check if user has active subscription OR active trial
- Show paywall immediately if neither subscription nor trial is active
- Redirect to paywall screen if subscription cancelled/expired
- Add trial countdown indicator in profile screen
- Show "Trial Active" badge when in trial period

### 8. Update Profile Screen

- Add subscription section in `app/(tabs)/profile.tsx`
- Show current subscription status:
- "Trial Active - X days remaining"
- "Subscribed - Expires [date]"
- "Expired" or "Cancelled"
- Show trial countdown if in trial period
- Show subscription expiration date if subscribed
- Add "Manage Subscription" button (links to App Store/Play Store)
- Add "Cancel Subscription" button with warning (app becomes unusable)
- Show cancellation date if subscription was cancelled

### 9. Feature Gating (Hard Paywall)

- Create `lib/utils/subscription.ts` utility
- Add `isSubscribed()` helper function that checks:
- Active subscription OR
- Active trial period
- Add `isInTrial()` helper function
- Add `getTrialDaysRemaining()` helper function
- Gate **ALL app features** behind subscription/trial check (hard paywall)
- Show paywall immediately if no active subscription or trial
- Block access to all main features (home, logs, shifts, exports) if subscription cancelled
- No free tier - only trial period

### 10. Testing

- Test subscription flow on iOS (sandbox) with free trial
- Test subscription flow on Android (test purchases) with free trial
- Test trial expiration and auto-conversion to paid subscription
- Test restore purchases functionality
- Test subscription cancellation (verify app becomes unusable)
- Test offline subscription status (cache last known status)
- Test trial countdown display

## Files to Create/Modify

### New Files

- `lib/state/subscriptionStore.ts` - Subscription state management with trial tracking
- `lib/utils/subscription.ts` - Subscription utility functions (isSubscribed, isInTrial, etc.)
- `app/subscription/paywall.tsx` - Paywall screen with trial messaging
- `supabase/migrations/YYYYMMDD_add_subscriptions.sql` - Database migration with trial fields
- `lib/subscription/revenuecat.ts` - RevenueCat SDK wrapper

### Modified Files

- `package.json` - Add RevenueCat dependencies
- `app.config.ts` - Add RevenueCat configuration
- `app/_layout.tsx` - Add subscription/trial check on app launch, show paywall if needed
- `app/(tabs)/profile.tsx` - Add subscription management section with trial countdown
- `lib/supabase.ts` - Add subscription sync functions
- `env.example` - Add RevenueCat API keys

## Configuration Required

### App Store Connect

- Create subscription group
- Create monthly subscription product with introductory offer:
- Type: Free Trial
- Duration: 1 month
- Eligible: All new subscribers
- Create yearly subscription product with introductory offer:
- Type: Free Trial
- Duration: 1 month
- Eligible: All new subscribers
- Set pricing for each product
- Configure auto-renewal settings

### Google Play Console

- Create subscription products (monthly, yearly)
- Set pricing for each product
- Configure introductory offers (free trial):
- Duration: 1 month
- Eligible: All new subscribers
- Configure subscription management
- Set up auto-renewal

### RevenueCat Dashboard

- Create app project
- Link iOS app (App Store Connect)
- Link Android app (Google Play Console)
- Create entitlements (e.g., "premium")
- Create offerings (monthly, yearly) with introductory offers (free trial)
- Configure webhooks (optional, for backend sync)
- Set up trial period handling (RevenueCat automatically tracks trial status)

## Environment Variables

- `EXPO_PUBLIC_REVENUECAT_API_KEY` - RevenueCat public API key
- `REVENUECAT_SECRET_KEY` - RevenueCat secret key (backend only)

## Subscription Products

- **Monthly**: $X.99/month (with 1-month free trial)
- **Yearly**: $XX.99/year (with 1-month free trial)

## Trial & Subscription Flow

1. User signs up → Sees paywall with trial offer
2. User selects plan (monthly/yearly) → Trial starts immediately
3. User can use app during trial period (full access)
4. Trial countdown shown in profile
5. After 1 month, trial expires → Automatic subscription starts
6. User charged automatically (monthly or yearly)
7. **If user cancels subscription:**

- Cancellation prevents auto-renewal only
- User retains full app access until end of current paid period
- Monthly subscription: Access until end of current month
- Yearly subscription: Access until end of current year
- After paid period expires → App becomes unusable (hard paywall)

8. User must resubscribe before expiration to maintain access

## Error Handling

- Handle network errors during purchase
- Handle cancelled purchases gracefully
- Handle trial expiration gracefully (show paywall before trial ends)
- Handle subscription cancellation (immediate paywall, no grace period)
- Show user-friendly error messages
- Log errors for debugging

## Account & Data Handling on Cancellation

### When Subscription is Cancelled

**Account Status:**

- User account remains active in Supabase auth (not deleted)
- User can still sign in to their account
- Subscription status set to 'cancelled' in database
- App access is blocked (hard paywall) - user cannot use app features

**Data Retention Policy:**

- **Local Data (SQLite)**: Retained on device indefinitely (until app uninstall or manual cleanup)
- Logs, shifts, export batches remain in local database
- User can export data if they resubscribe
- Data persists even after cancellation
- **Cloud Data (Supabase)**: Retained for 90 days after cancellation
- All user data (logs, shifts, profiles, export batches) kept in Supabase
- Data is soft-deleted (marked with deleted_at) after 90 days
- Permanent deletion after 90 days (or longer based on legal requirements)
- User can resubscribe within 90 days to restore access to their data

**Grace Period:**

- 7-day grace period after cancellation before app access is blocked
- During grace period, user can:
- Export all their data (PDF exports, CSV exports)
- Download their logs and shifts
- Cancel subscription cancellation (if supported by platform)
- After grace period, app shows paywall and blocks access

**Data Export Before Cancellation:**

- Add "Export All Data" feature in profile screen
- Allow users to export:
- All logs as CSV or PDF
- All shifts as JSON
- Profile data as JSON
- Export available during trial, active subscription, and grace period

**Resubscription:**

- If user resubscribes within 90 days:
- All cloud data is restored automatically
- Local data (if still on device) is merged with cloud data
- User regains full app access immediately
- If user resubscribes after 90 days:
- Cloud data may be permanently deleted
- User starts fresh (but can restore from local data if available)

**Account Deletion (Separate from Cancellation):**

- Account deletion is a separate action from subscription cancellation
- User must explicitly request account deletion
- Account deletion permanently removes:
- Auth account in Supabase
- All user data (logs, shifts, profiles, exports)
- All cloud and local data
- Account deletion is irreversible

### Implementation Details

**Database Changes:**

- Add `subscription_cancelled_at` timestamp to track cancellation date
- Add `data_retention_until` timestamp (cancelled_at + 90 days)
- Add `grace_period_until` timestamp (cancelled_at + 7 days)
- Add `account_deleted_at` timestamp for account deletion

**Subscription Store Updates:**

- Add `isInGracePeriod()` method
- Add `getDaysUntilDataDeletion()` method
- Add `canExportData()` method (true during trial, subscription, grace period)
- Add `requestAccountDeletion()` method

**Profile Screen Updates:**

- Show cancellation date if subscription cancelled
- Show grace period countdown if in grace period
- Show data retention countdown (days until permanent deletion)
- Add "Export All Data" button (available during grace period)
- Add "Delete Account" button (separate from cancellation, with warning)

**Data Export Feature:**

- Create `app/export/all-data.tsx` screen
- Export all logs as CSV
- Export all shifts as JSON
- Export profile as JSON
- Generate comprehensive PDF report
- Allow sharing via email or file system

**Automatic Cleanup:**

- Create Supabase Edge Function or scheduled job to:
- Soft delete data after 90 days of cancellation
- Permanently delete data after additional retention period (if applicable)
- Clean up orphaned data from deleted accounts

## Implementation Timeline

### Estimated Time: 2-3 weeks (depending on experience with RevenueCat)

**Week 1: Setup & Core Integration (5-7 days)**

- Day 1-2: RevenueCat account setup, App Store Connect/Play Console configuration
- Day 3-4: Install SDK, create subscription store, database migration
- Day 5: Basic paywall screen and subscription checks
- Day 6-7: Testing subscription flow in sandbox/test mode

**Week 2: Feature Gating & UI (4-5 days)**

- Day 1-2: Feature gating implementation, subscription utilities
- Day 3: Profile screen updates, subscription management UI
- Day 4: Data export feature, account deletion flow
- Day 5: Integration testing, edge case handling

**Week 3: Testing & Refinement (3-5 days)**

- Day 1-2: Comprehensive testing (trial, cancellation, expiration scenarios)
- Day 3: Bug fixes and refinements
- Day 4-5: Production readiness verification, documentation

**Note:** Actual time may vary based on:

- Familiarity with RevenueCat SDK
- App Store/Play Console approval times for subscription products
- Complexity of testing scenarios
- Integration with existing Supabase infrastructure

## Testing Strategy

### Development Testing (Before Production)

**1. RevenueCat Sandbox/Test Mode**

**iOS Testing:**

- Use RevenueCat sandbox environment (automatic with test accounts)
- Create test user accounts in App Store Connect
- Use sandbox tester accounts (not real Apple IDs)
- Test purchases use sandbox environment (no real charges)
- Subscription products must be approved in App Store Connect first (can take 24-48 hours)

**Android Testing:**

- Use Google Play Console test tracks (Internal Testing, Closed Testing)
- Create test accounts in Google Play Console
- Use license testing accounts (up to 100 test accounts)
- Test purchases use test environment (no real charges)
- Subscription products must be created in Play Console (can take a few hours)

**2. Local Development Testing**

**Test Subscription States:**

- Create mock subscription states in development
- Test with hardcoded subscription statuses:
- Active trial
- Active subscription (monthly/yearly)
- Cancelled (during trial - immediate paywall)
- Cancelled (during paid period - access until expiration)
- Expired subscription
- Test subscription expiration logic
- Test grace period handling

**Test Scenarios to Cover:**

1. **Trial Period:**

- Start trial → Verify full access
- Cancel during trial → Verify immediate paywall
- Trial expiration → Verify auto-conversion to paid

2. **Paid Subscription:**

- Monthly subscription active → Verify full access
- Cancel monthly (mid-month) → Verify access until month end
- Yearly subscription active → Verify full access
- Cancel yearly (mid-year) → Verify access until year end
- Subscription expiration → Verify paywall appears

3. **Edge Cases:**

- Network errors during purchase
- Restore purchases functionality
- Multiple device sync
- Offline subscription status
- Subscription status sync with Supabase

**3. RevenueCat Dashboard Testing**

**Use RevenueCat Test Mode:**

- RevenueCat provides test API keys (separate from production)
- Use test API key in development environment
- Test webhook handling (if implemented)
- Verify subscription status updates in RevenueCat dashboard
- Test customer identification and entitlements

**4. Supabase Integration Testing**

**Test Database Updates:**

- Verify subscription status saved to profiles table
- Test subscription sync from RevenueCat to Supabase
- Test subscription status retrieval on app launch
- Verify RLS policies for subscription data
- Test data retention logic (90-day retention)

**5. Pre-Production Verification Checklist**

**Before Deploying to Production:**

- [ ] All subscription products created and approved in App Store Connect
- [ ] All subscription products created in Google Play Console
- [ ] RevenueCat products configured with correct product IDs
- [ ] Test purchases work in sandbox/test environment
- [ ] Trial period works correctly (1 month free)
- [ ] Cancellation during trial blocks access immediately
- [ ] Cancellation during paid period allows access until expiration
- [ ] Subscription expiration shows paywall correctly
- [ ] Restore purchases works on both platforms
- [ ] Subscription status syncs to Supabase correctly
- [ ] Profile screen shows correct subscription status
- [ ] Paywall screen displays correctly
- [ ] Feature gating works (blocks access when needed)
- [ ] Data export works during grace period
- [ ] Account deletion works correctly
- [ ] No hardcoded test credentials in code
- [ ] Production API keys configured (not test keys)
- [ ] Error handling works gracefully
- [ ] Offline subscription status caching works

**6. Testing Tools & Methods**

**RevenueCat Debugging:**

- Use RevenueCat dashboard to view customer subscriptions
- Check RevenueCat logs for purchase events
- Use RevenueCat test mode for safe testing
- Monitor webhook deliveries (if implemented)

**App Debugging:**

- Add debug logging for subscription status checks
- Log subscription state changes
- Verify subscription status in app state
- Test subscription checks at app launch

**Device Testing:**

- Test on real iOS device (sandbox)
- Test on real Android device (test track)
- Test subscription restoration across devices
- Test offline behavior

**7. Production Rollout Strategy**

**Phased Rollout:**

1. **Internal Testing (1-2 days):**

- Test with internal team accounts
- Verify all flows work correctly
- Fix any critical issues

2. **Beta Testing (3-5 days):**

- Release to beta testers (TestFlight/Play Console beta)
- Collect feedback on subscription flow
- Monitor for issues

3. **Gradual Production Release:**

- Start with small percentage of users
- Monitor subscription metrics
- Gradually increase rollout
- Full production release after validation

**8. Monitoring After Launch**

**Key Metrics to Monitor:**

- Subscription conversion rate (trial to paid)
- Cancellation rate
- Subscription renewal rate
- Revenue metrics
- Error rates in subscription flow
- Customer support tickets related to subscriptions

## Security Considerations

- Never store subscription status only on device
- Verify subscription status with backend/Supabase
- Use RevenueCat webhooks for server-side verification
- Cache subscription status locally for offline use
- Verify trial status server-side to prevent manipulation
- Ensure data retention complies with privacy laws (GDPR, etc.)
- Provide clear data retention and deletion policies to users
- Use separate test and production API keys
- Never commit test credentials to version control