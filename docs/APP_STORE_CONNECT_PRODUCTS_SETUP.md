# Step-by-Step: Creating Subscription Products in App Store Connect

## Prerequisites

Before you start, make sure you have:
- ✅ An active Apple Developer account
- ✅ An app created in App Store Connect
- ✅ Your app's Bundle ID matches: `com.overtimeplus.app`
- ✅ Admin or App Manager access to the app

## Step 1: Access App Store Connect

1. **Go to App Store Connect:**
   - Visit: https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Navigate to Your App:**
   - Click "My Apps" in the top navigation
   - Find and click on "Overtime+" (or your app name)

## Step 2: Create a Subscription Group

Subscription products must belong to a subscription group. You can have multiple subscription groups, but typically you'll have one.

1. **Go to Subscriptions:**
   - In your app's left sidebar, click **"Subscriptions"**
   - If you don't see this option, you may need to:
     - Complete app information first
     - Or ensure your app is set up for subscriptions

2. **Create Subscription Group:**
   - Click the **"+"** button (top left) or **"Create Subscription Group"**
   - Enter a **Reference Name**: `Overtime+ Premium` (or any name you prefer)
   - Click **"Create"**

## Step 3: Create Monthly Subscription Product

1. **Add Subscription:**
   - In your subscription group, click **"+"** or **"Create Subscription"**

2. **Fill in Subscription Details:**

   **Reference Name:**
   - Enter: `Overtime+ Monthly`
   - This is for your internal reference only

   **Product ID:**
   - **CRITICAL:** Enter exactly: `overtime_plus_monthly`
   - This MUST match what's in your code (`lib/utils/subscription.ts`)
   - Cannot be changed after creation
   - Must be unique across all your apps

   **Subscription Duration:**
   - Select: `1 Month`

   **Price:**
   - Click **"Add Price"** or select a price tier
   - Choose your price (e.g., $4.99/month, $9.99/month, etc.)
   - You can add prices for different countries/regions

3. **Subscription Information:**
   - **Display Name:** `Overtime+ Monthly` (what users see)
   - **Description:** Write a brief description of what the subscription includes
     - Example: "Unlimited overtime log entries, PDF exports, and cloud sync"

4. **Review Information:**
   - **Review Notes:** (Optional) Add any notes for App Review
   - **Screenshot:** (Optional) Add a screenshot showing the subscription in your app

5. **Save:**
   - Click **"Create"** or **"Save"** in the top right

## Step 4: Create Yearly Subscription Product

1. **Add Another Subscription:**
   - Still in the same subscription group, click **"+"** again

2. **Fill in Subscription Details:**

   **Reference Name:**
   - Enter: `Overtime+ Yearly`

   **Product ID:**
   - **CRITICAL:** Enter exactly: `overtime_plus_yearly`
   - Must match your code exactly

   **Subscription Duration:**
   - Select: `1 Year`

   **Price:**
   - Click **"Add Price"** or select a price tier
   - Choose your yearly price (typically 10-12 months worth)
   - Example: If monthly is $9.99, yearly might be $99.99 (saves 2 months)

3. **Subscription Information:**
   - **Display Name:** `Overtime+ Yearly`
   - **Description:** Similar to monthly but mention yearly savings
     - Example: "Unlimited overtime log entries, PDF exports, and cloud sync. Save 17% with yearly subscription."

4. **Save:**
   - Click **"Create"** or **"Save"**

## Step 5: Configure Subscription Group Settings

1. **Set Display Name:**
   - In your subscription group, set the **Display Name**
   - This is what users see (e.g., "Overtime+ Premium")

2. **Set Subscription Levels (Optional):**
   - If you have multiple subscriptions, you can set their "levels"
   - Higher level = more features
   - For now, both can be at the same level

3. **Review Group:**
   - Make sure both subscriptions are listed
   - Verify Product IDs are correct:
     - ✅ `overtime_plus_monthly`
     - ✅ `overtime_plus_yearly`

## Step 6: Submit for Review

1. **Check Status:**
   - Each subscription should show status: **"Ready to Submit"** or **"Waiting for Review"**

2. **Submit Subscription Group:**
   - Click **"Submit for Review"** button
   - You may need to complete:
     - App information
     - Privacy policy URL
     - Subscription terms

3. **Wait for Approval:**
   - Apple typically reviews subscriptions within 24-48 hours
   - You'll receive email notifications about status changes
   - Status will change to **"Approved"** when ready

## Step 7: Link Products in RevenueCat

Once your products are approved in App Store Connect:

1. **Go to RevenueCat Dashboard:**
   - Visit: https://app.revenuecat.com
   - Navigate to your project

2. **Go to Products:**
   - Click **"Products"** in the left sidebar

3. **Link Monthly Product:**
   - Find or create product: `overtime_plus_monthly`
   - Click on it
   - Under **"Store Products"**, click **"Link Store Product"**
   - Select **"App Store"**
   - Find and select your `overtime_plus_monthly` subscription
   - Click **"Link"**

4. **Link Yearly Product:**
   - Repeat for `overtime_plus_yearly`
   - Link it to your App Store Connect yearly subscription

5. **Verify:**
   - Both products should show **"Linked"** status
   - Should display App Store Connect product details

## Step 8: Verify in Your App

1. **Wait for Sync:**
   - RevenueCat may take a few minutes to sync with App Store Connect
   - Usually happens within 5-10 minutes

2. **Test in App:**
   - Reload your app
   - Navigate to paywall screen
   - Products should now appear!

## Important Notes

### Product IDs Must Match Exactly

Your code expects these exact Product IDs:
- `overtime_plus_monthly`
- `overtime_plus_yearly`

**DO NOT** use:
- ❌ `OvertimePlusMonthly` (wrong case)
- ❌ `overtime-plus-monthly` (wrong separator)
- ❌ `overtime_plus_monthly_v1` (extra suffix)

### Product ID Format Rules

- Must start with a letter
- Can contain letters, numbers, underscores, and periods
- Cannot contain spaces or hyphens
- Case-sensitive
- Cannot be changed after creation

### Pricing Considerations

- **Monthly:** Set your base price
- **Yearly:** Typically 10-12 months worth (shows savings)
- Example: $9.99/month = $99.99/year (saves $19.89)

### Approval Timeline

- **Initial Review:** 24-48 hours typically
- **Updates:** Usually faster (few hours)
- **Rejections:** Fix issues and resubmit

### Testing Before Approval

Even before approval, you can:
- ✅ Test in sandbox with sandbox testers
- ✅ Use StoreKit Configuration file in simulator
- ❌ Cannot test with real purchases until approved

## Troubleshooting

### "Subscriptions" Option Not Visible

**Possible reasons:**
1. App information incomplete
2. App not set up for subscriptions
3. Missing required agreements

**Fix:**
- Complete all app information
- Go to Agreements, Tax, and Banking
- Complete required agreements

### Product ID Already Exists

**Error:** "This Product ID is already in use"

**Fix:**
- Product IDs are unique across all your apps
- Check if you created it in another app
- Use a different Product ID (but update your code too)

### Products Not Appearing in RevenueCat

**Possible reasons:**
1. Products not approved yet
2. Products not linked
3. Sync delay

**Fix:**
1. Wait for App Store Connect approval
2. Manually link products in RevenueCat
3. Wait 5-10 minutes for sync
4. Refresh RevenueCat dashboard

### Products Not Showing in App

**Check:**
1. Product IDs match exactly
2. Products are approved in App Store Connect
3. Products are linked in RevenueCat
4. Offering is set as "Current" in RevenueCat
5. Using correct API key (production vs test)

## Quick Checklist

- [ ] Subscription group created
- [ ] Monthly product created with ID: `overtime_plus_monthly`
- [ ] Yearly product created with ID: `overtime_plus_yearly`
- [ ] Products submitted for review
- [ ] Products approved (status: "Approved")
- [ ] Products linked in RevenueCat dashboard
- [ ] Offering set as "Current" in RevenueCat
- [ ] Products appear in app paywall

## Next Steps After Setup

1. **Set up Sandbox Testers:**
   - App Store Connect → Users and Access → Sandbox Testers
   - Create test accounts for testing purchases

2. **Test Purchases:**
   - Use sandbox testers on real device
   - Test subscription flow
   - Verify webhooks work

3. **Monitor:**
   - Check RevenueCat dashboard for purchases
   - Monitor App Store Connect for sandbox transactions
   - Test subscription renewal flow

## Support Resources

- **App Store Connect Help:** https://help.apple.com/app-store-connect/
- **RevenueCat Docs:** https://docs.revenuecat.com/
- **Apple Subscriptions Guide:** https://developer.apple.com/app-store/subscriptions/

---

**Estimated Time:** 30-60 minutes (plus 24-48 hours for approval)

**Difficulty:** Medium (requires attention to detail, especially Product IDs)


