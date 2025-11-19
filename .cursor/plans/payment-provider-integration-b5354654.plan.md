<!-- b5354654-5770-4105-aee4-d4cf7e5bd451 fd60717b-ee2b-4ea6-b6f4-f38bc31e5623 -->
# Payment Provider Integration with Free Trial

## Overview

Integrate RevenueCat for subscription-based payments with a **1-month free trial** for all new users. After the trial expires, automatic subscription starts. **Cancellation behavior differs by period**: During trial, cancellation makes app unusable immediately. After trial (paid subscription), cancellation prevents auto-renewal but user retains access until the end of the paid period (month or year). RevenueCat is the easiest and cheapest option - free tier up to $10k monthly revenue.

## Status & Remaining Work

### Completed

- Added Supabase migration `supabase/migrations/20251115235959_add_subscription_and_paywall_support.sql` that:
- Creates `subscription_status` enum plus `subscription_*`, `trial_*`, `grace_period_until`, `data_retention_until`, `legacy_free_access`, and `paywall_acknowledged_at` columns on `public.profiles`.
- Seeds existing users with `legacy_free_access = true` and ensures `subscription_status` defaults to `'none'`.
- Adds supporting indexes for subscription/trial/grace queries.
- Introduces `public.remote_feature_flags` with RLS, update trigger, and an initial `enable_paywall` flag used for staged rollout control.

### Still Needed

- Apply the migration to staging/production Supabase and verify RLS + index creation.
- Implement Supabase Edge Function/webhook handler that mutates the new columns based on RevenueCat events.
- Build `lib/state/subscriptionStore.ts`, `lib/utils/subscription.ts`, and the RevenueCat SDK wrapper that sync with the new schema.
- Gate app navigation/layout based on `subscription_status`, `trial_consumed`, `legacy_free_access`, and `remote_feature_flags.enable_paywall`.
- Update profile/paywall UI with trial eligibility copy, grace-period export mode, and manage-subscription CTAs.
- Add integration/system tests covering trial eligibility, grace period, legacy-user migration, and feature-flagged rollout.

## Implementation Progress (Nov 18, 2025)

- ✅ Added RevenueCat dependencies, Expo dev build profile tweaks, and new env variables (`EXPO_PUBLIC_REVENUECAT_API_KEY_*`).
- ✅ Created `lib/subscription/revenuecat.ts`, `lib/utils/subscription.ts`, and `lib/state/subscriptionStore.ts` to encapsulate RevenueCat setup, Supabase feature flags, and subscription gating logic.
- ✅ Wired `app/_layout.tsx` to initialize the subscription store after auth, automatically redirect to `/subscription/paywall` when required, and reset state on sign-out.
- ✅ Built `app/subscription/paywall.tsx` with plan selection, trial copy, restore/manage buttons, and rollout cohort details pulled from remote feature flags.
- ✅ Updated `app/(tabs)/profile.tsx` with a subscription status card (trial countdown, legacy badge, quick links to paywall/manage subscription) so users always see their entitlement state.
- ✅ Added helper functions in `lib/supabase.ts` to fetch subscription snapshots + remote feature flags and to store paywall acknowledgements.

### Outstanding to finish the plan

1. **Supabase backend work**
   - ✅ Applied `20251115235959_add_subscription_and_paywall_support.sql` to the database (indexes + RLS confirmed).
   - Ship the RevenueCat webhook Edge Function that flips `subscription_status`, `trial_consumed`, `grace_period_until`, etc. (see "Backend Integration" section below for exact events to handle).
   - Ensure nightly RevenueCat re-sync cron is implemented so the client cannot spoof entitlements.

2. **RevenueCat config**
   - Create offerings (monthly/yearly) with 1-month trials in the RevenueCat dashboard, then update `.env`/EAS secrets with the correct public keys for each environment.
   - Double-check that the package identifiers used in the dashboard match `DEFAULT_SUBSCRIPTION_PRODUCTS` (update that array if product IDs differ).

3. **Client polish**
   - Connect `subscriptionApi.markPaywallAcknowledged` to a UI acknowledgement flow for legacy users (e.g., a modal before showing the paywall).
   - Decide whether to surface RevenueCat paywalls (`react-native-purchases-ui`) instead of our custom screen and adjust the `packageCard` rendering accordingly.

4. **Testing & rollout**
   - Build iOS simulator + Android dev clients via `eas build --profile ios-simulator` / `eas build --profile development`, install on devices, and run through purchase, cancel, grace, and restore cases.
   - Add automated tests (vitest/jest or detox) for the new store logic—mock `subscriptionApi` + `revenuecatClient` so we cover `legacy_free_access`, `grace_period_until`, and feature-flagged gating.
   - Stage rollout by flipping `remote_feature_flags.enable_paywall` (`enabled`, `cohort_percentage`, `target_group`) per cohort described later in this file.

## Payment Model

- **1-month free trial** for all new users (see eligibility caveats below)
- Trial starts automatically when user signs up and selects subscription plan
- After trial expires, automatic subscription starts (monthly or yearly based on user selection)
- Cancellation rules:
- During trial → access revoked immediately (hard paywall)
- During paid period → user retains full access until the end of the current paid term
- After paid term ends → core features stay locked, but a **7-day read-only grace window** unlocks the export screen so users can pull their data or resubscribe
- No free tier - only trial period before paid subscription

## Trial Eligibility Safeguards

- App Store/Play Store may block free trials for returning subscribers; never assume eligibility.
- Subscription store must call RevenueCat `checkTrialOrIntroEligibility` (or equivalent helper) before showing "1-month free trial" copy.
- Mirror eligibility server-side by adding a `trial_consumed` boolean (or derived flag) to the Supabase profile so backend trust does not rely solely on client checks.
- Paywall messaging adapts dynamically:
- Eligible → "Start 1-month free trial"
- Ineligible → show paid price copy and highlight cancellation policy.
- Backend sets `trial_consumed = true` the moment a trial starts (even if user cancels immediately) so re-subscribers never receive another free month.

## Implementation Steps

### 1. Install Dependencies & Set Up Expo Development Build

**Important**: RevenueCat requires an Expo development build (not Expo Go for full functionality). Expo Go supports Preview API Mode for prototyping, but real purchases require a development build.

**Installation Steps:**

1. Install `expo-dev-client` (required for development builds):
   ```
   npx expo install expo-dev-client
   ```

2. Install RevenueCat SDKs using Expo's install command:
   ```
   npx expo install react-native-purchases react-native-purchases-ui
   ```
   - `react-native-purchases` - Core RevenueCat SDK
   - `react-native-purchases-ui` - UI components (Paywalls, Customer Center, etc.)

3. **Critical**: After installing RevenueCat SDKs, you **must** run a full build process (not just hot reload). Hot reloading without building will result in errors like:
   ```
   Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.
   ```

4. Update `app.config.ts` with RevenueCat configuration (if needed for config plugins)

5. Add RevenueCat API keys to environment variables:
   - `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` - iOS public API key
   - `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` - Android public API key

**Note on Expo Go:**
- Expo Go includes Preview API Mode that allows prototyping subscription UIs and testing integration flows
- Real purchases will not function in Expo Go
- For full testing, use a development build (see Testing section)

### 2. Set Up RevenueCat Account & Products

- Create RevenueCat account
- Configure iOS App Store Connect integration
- Configure Google Play Console integration
- Create subscription products (monthly, yearly) with **introductory offers (free trial)**:
- Monthly: $X.99/month with 1-month free trial
- Yearly: $XX.99/year with 1-month free trial
- Get RevenueCat API keys (public key for app, secret key for backend)

### 3. Create Subscription Store & Initialize RevenueCat SDK

- Create `lib/state/subscriptionStore.ts` using Zustand
- Store subscription status, entitlements, active products, and **trial status**
- Add methods:
- `checkSubscriptionStatus()` - Check if user has active subscription OR active trial
- `isInTrial()` - Check if currently in trial period
- `getTrialInfo()` - Get trial start date, end date, days remaining
- `refreshTrialEligibility()` - call RevenueCat eligibility API and set local + server flag
- `restorePurchases()` - Restore previous purchases
- `purchaseSubscription()` - Start subscription (begins trial if first time)
- Initialize RevenueCat SDK with Supabase user ID through `Purchases.logIn(userId)`
- Add `logOut()` handler so logging out of the app also calls `Purchases.logOut()` and clears cache
- Handle anonymous installs: start with `Purchases.configure` (anonymous), then call `logIn` after onboarding so pre-trial transactions on the device transfer to the authenticated customer
- Store `lastRevenueCatAppUserId` locally to detect mismatches and trigger `restorePurchases`
- Track trial expiration and auto-conversion to paid subscription

**SDK Initialization (Expo-specific):**

Initialize RevenueCat in your app entry point (e.g., `app/_layout.tsx`):

```typescript
import { Platform } from 'react-native';
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export default function App() {
  useEffect(() => {
    // Enable verbose logging for debugging (remove in production)
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Configure with platform-specific API keys
    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID });
      // OR: if building for Amazon, use:
      // Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_AMAZON, useAmazon: true });
    }
  }, []);
}
```

**Identify Users:**

After user authentication, identify the user to RevenueCat:
```typescript
await Purchases.logIn(supabaseUserId);
```

**Check Subscription Status:**

```typescript
try {
  const customerInfo = await Purchases.getCustomerInfo();
  // Check entitlements
  if (typeof customerInfo.entitlements.active[<my_entitlement_identifier>] !== "undefined") {
    // Grant user "premium" access
  }
} catch (e) {
  // Error fetching customer info
}
```

### 4. Database Schema Updates

- Add `subscription_status` column to `profiles` table (enum: 'trial', 'active', 'expired', 'cancelled')
- Add `subscription_expires_at` timestamp
- Add `trial_started_at` timestamp
- Add `trial_expires_at` timestamp
- Add `trial_consumed` boolean (server-trusted flag to prevent duplicate trials)
- Add `subscription_product_id` (monthly/yearly)
- Add `subscription_cancelled_at` timestamp (for tracking cancellations)
- Create migration: `supabase/migrations/YYYYMMDD_add_subscriptions.sql`

### 5. Backend Integration (Supabase)

- Create Supabase Edge Function that consumes RevenueCat webhooks (Events API v2)
- Validate RevenueCat webhook signatures and persist the raw payloads for auditing/replay
- Update Supabase `profiles` table on every webhook (trial started, renewal, cancellation, billing issue, expiration)
- Set `trial_consumed = true` the moment RevenueCat reports a trial start, even if the user churns before billing
- Nightly cron/Edge Function re-fetches customer info from RevenueCat to self-heal missed hooks or client tampering
- Store subscription status when user purchases/restores/starts trial
- Verify subscription status on app launch by trusting Supabase values (client shows read-only snapshot)
- Add RLS policies for subscription data (only owner/service role reads `subscription_*` fields)
- Handle trial expiration, cancellation conversions, and grace window transitions on the server

### 6. Create Paywall Screen

- Create `app/subscription/paywall.tsx` screen
- Display subscription options (monthly/yearly) with **"1-month free trial"** messaging
- Show pricing with trial information
- Display trial countdown if user is in trial period
- Fallback UI copy when user is ineligible for trial (hide free-trial badge, highlight immediate billing)
- Add "Start Free Trial" button (converts to "Subscribe" after trial)
- Add "Restore Purchases" button
- Handle purchase flow with RevenueCat
- Show loading states and error handling
- Show cancellation warning (app becomes unusable if cancelled)

**Using RevenueCat Paywalls:**

RevenueCat provides `react-native-purchases-ui` for pre-built paywall components. Review the [React Native Paywalls documentation](https://www.revenuecat.com/docs/paywalls) for implementation options:

- Use RevenueCat's remote paywall builder (no code changes needed)
- Use `react-native-purchases-ui` components for Customer Center and paywall presentation
- Or build custom paywall UI using RevenueCat SDK methods

**Presenting a Paywall:**

There are several ways to present a paywall in Expo. Review the React Native Paywalls documentation for the best approach for your use case.

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
- If trial not available, display "Trial already used" state so expectations are clear
- Add "Manage Subscription" button (links to App Store/Play Store)
- Add "Cancel Subscription" button with warning (app becomes unusable)
- Show cancellation date if subscription was cancelled

### 9. Feature Gating (Hard Paywall)

- Create `lib/utils/subscription.ts` utility
- Add `isSubscribed()` helper function that checks:
- Active subscription OR
- Active trial period
- Add `isInTrial()` helper function
- Add `isTrialEligible()` helper that combines RevenueCat response + server `trial_consumed` flag
- Add `getTrialDaysRemaining()` helper function
- Gate **ALL app features** behind subscription/trial check (hard paywall)
- Show paywall immediately if no active subscription or trial
- Block access to all main features (home, logs, shifts, exports) if subscription cancelled
- No free tier - only trial period

### 10. Testing with Expo Development Builds

**Important**: RevenueCat requires Expo development builds for testing. You cannot test real purchases in Expo Go (though Preview API Mode allows UI prototyping).

**Set Up EAS Build for Testing:**

1. Install EAS CLI globally:
   ```
   npm install -g eas-cli
   ```

2. Login to EAS:
   ```
   eas login
   ```

3. Initialize EAS configuration:
   ```
   eas init
   ```

4. Configure build profiles:
   ```
   eas build:configure
   ```

5. Update `eas.json` with development build profiles:

```json
{
  "cli": {
    "version": ">= 7.3.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {},
    "ios-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Testing on iOS Simulator:**

1. Build for iOS simulator:
   ```
   eas build --platform ios --profile ios-simulator
   ```

2. Enter your app's bundle ID (must match RevenueCat config and App Store Connect)

3. After build completes, choose "Yes" to open in simulator

4. Start Expo development server:
   ```
   npx expo start
   ```

5. Choose the local development server in the iOS simulator

**Testing on Android Device/Emulator:**

1. Ensure `developmentClient: true` in `eas.json` under `build.development` profile

2. Build for Android:
   ```
   eas build --platform android --profile development
   ```

3. Enter your app's application ID (must match RevenueCat config and Google Play Console)

4. Choose "Yes" when asked to create a new Android Keystore (if needed)

5. After build completes:
   - For physical device: Install Expo Orbit, connect device, select from Orbit menu, or use QR code
   - For emulator: Choose "Yes" in terminal after build completes

6. Start Expo development server:
   ```
   npx expo start
   ```

**Test Scenarios:**

- Test subscription flow on iOS (sandbox) with free trial
- Test subscription flow on Android (test purchases) with free trial
- Test trial expiration and auto-conversion to paid subscription
- Test restore purchases functionality
- Test subscription cancellation (verify app becomes unusable)
- Test offline subscription status (cache last known status)
- Test trial countdown display
- Test paywall presentation using `react-native-purchases-ui` components

## Existing User Migration Plan

- Capture baseline: export all current active users and mark them as `legacy_free_access` so they keep functionality until they accept the new paywall.
- Show a modal/banner explaining the upcoming subscription before forcing the paywall; require explicit acknowledgement before moving them to trial/subscription flow.
- Offer a one-time promo code or extended grace period for existing paid beta testers (configurable flag in Supabase).
- Use a remote feature flag (`enable_paywall`) to stage rollout:

1. Internal QA accounts only
2. 10% of production users
3. 100% after metrics look healthy

- Run a backfill job that creates RevenueCat customer records for existing Supabase users (without active entitlements) so analytics stay accurate once they see the paywall.
- Communicate via in-app message + email before/after migration, linking to FAQ and support.

## Files to Create/Modify

### New Files

- `lib/state/subscriptionStore.ts` - Subscription state management with trial tracking
- `lib/utils/subscription.ts` - Subscription utility functions (isSubscribed, isInTrial, etc.)
- `app/subscription/paywall.tsx` - Paywall screen with trial messaging
- `supabase/migrations/YYYYMMDD_add_subscriptions.sql` - Database migration with trial fields
- `lib/subscription/revenuecat.ts` - RevenueCat SDK wrapper

### Modified Files

- `package.json` - Add RevenueCat dependencies (`react-native-purchases`, `react-native-purchases-ui`) and `expo-dev-client`
- `app.config.ts` - Add RevenueCat configuration (if config plugins needed)
- `eas.json` - Add development build profiles for iOS simulator and Android testing
- `app/_layout.tsx` - Initialize RevenueCat SDK, add subscription/trial check on app launch, show paywall if needed
- `app/(tabs)/profile.tsx` - Add subscription management section with trial countdown
- `lib/supabase.ts` - Add subscription sync functions
- `env.example` - Add RevenueCat API keys (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`, `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`)

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

**Client-side (Expo):**
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` - RevenueCat iOS public API key (bundled in app)
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` - RevenueCat Android public API key (bundled in app)
- `EXPO_PUBLIC_REVENUECAT_API_KEY_AMAZON` - RevenueCat Amazon public API key (if supporting Amazon Appstore)

**Server-side (Supabase Edge Functions):**
- `REVENUECAT_SECRET_KEY_<ENV>` - RevenueCat secret key stored only in Supabase Edge Function secrets / CI, never bundled in the client

**Notes:**
- Use separate API keys for development/staging/production environments
- Document rotation steps: revoke old key in RevenueCat dashboard, update Supabase secret, redeploy Edge Functions, then update Expo environment variables and rebuild
- `.env` / `env.example` should reference placeholders only; real values live in secure secret managers (1Password / SSM)
- RevenueCat provides separate test API keys for development (use test keys in development, production keys in production)

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
- After paid period expires → Core features locked, export/resubscribe screen available for 7 days, then standard paywall

8. User must resubscribe before expiration to maintain access

## Error Handling

- Handle network errors during purchase
- Handle cancelled purchases gracefully
- Handle trial expiration gracefully (show paywall before trial ends)
- Handle subscription cancellation transitions (trial lockout vs paid-term access vs grace window)
- Show user-friendly error messages
- Log errors for debugging

## Account & Data Handling on Cancellation

### When Subscription is Cancelled

**Account Status:**

- User account remains active in Supabase auth (not deleted)
- User can still sign in to their account
- Subscription status set to 'cancelled' in database
- While `now < subscription_expires_at`, user retains full access
- After `subscription_expires_at`, main tabs are blocked (hard paywall) and user is routed to the limited export/resubscribe experience

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

- 7-day grace period **after the paid term ends** (not immediately at cancellation)
- During grace period, user sees a read-only screen where they can:
- Export all their data (PDF exports, CSV exports)
- Download their logs and shifts
- Resubscribe to immediately restore full access
- After grace period, export access is revoked and the standard paywall is shown

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
- Day 3-4: Install SDK (`expo-dev-client`, `react-native-purchases`, `react-native-purchases-ui`), set up EAS build configuration, create subscription store, database migration, initialize RevenueCat SDK
- Day 5: Basic paywall screen and subscription checks
- Day 6-7: Build development build with EAS, testing subscription flow in sandbox/test mode

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

- Familiarity with RevenueCat SDK and Expo development builds
- EAS build times (first build can take 15-30 minutes)
- App Store/Play Console approval times for subscription products
- Complexity of testing scenarios
- Integration with existing Supabase infrastructure
- Learning curve for EAS build process if new to Expo development builds

## Testing Strategy

### Development Testing (Before Production)

**1. RevenueCat Sandbox/Test Mode**

**Expo Development Build Setup:**

- **Required**: Use Expo development builds (not Expo Go) for testing real purchases
- Build development client using EAS: `eas build --platform ios --profile ios-simulator` or `eas build --platform android --profile development`
- After build, start Expo dev server: `npx expo start`
- Development builds allow hot reloading while maintaining native module support

**iOS Testing:**

- Use RevenueCat sandbox environment (automatic with test accounts)
- Create test user accounts in App Store Connect
- Use sandbox tester accounts (not real Apple IDs)
- Test purchases use sandbox environment (no real charges)
- Subscription products must be approved in App Store Connect first (can take 24-48 hours)
- Test on iOS simulator using EAS build with `ios-simulator` profile

**Android Testing:**

- Use Google Play Console test tracks (Internal Testing, Closed Testing)
- Create test accounts in Google Play Console
- Use license testing accounts (up to 100 test accounts)
- Test purchases use test environment (no real charges)
- Subscription products must be created in Play Console (can take a few hours)
- Test on Android device/emulator using EAS build with `development` profile

**Expo Go Limitations:**

- Expo Go supports Preview API Mode for prototyping subscription UIs and testing integration flows
- Real purchases will not function in Expo Go
- Use Expo Go only for UI/UX prototyping; use development builds for actual purchase testing

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
- [ ] Expo development build configured and tested (not using Expo Go for production testing)
- [ ] EAS build profiles configured correctly for iOS and Android
- [ ] RevenueCat SDK initialized correctly with platform-specific API keys
- [ ] Development build tested on both iOS simulator and Android device/emulator

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
