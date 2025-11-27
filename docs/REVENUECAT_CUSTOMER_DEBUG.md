# RevenueCat Customer Not Showing - Debug Guide

## Why Customers Don't Appear Immediately

RevenueCat creates customers when:
1. **First API call is made** (getOfferings, getCustomerInfo, purchase, etc.)
2. **User is logged in** via `Purchases.logIn(userId)`
3. **A purchase is attempted**

If you don't see customers, it means RevenueCat hasn't received any requests yet.

## Quick Fix: Force Customer Creation

### Method 1: Trigger from App (Easiest)

1. **Open your app**
2. **Navigate to the paywall screen** (`/subscription/paywall`)
3. **Pull down to refresh** (this triggers `getOfferings()`)
4. **Check RevenueCat Dashboard** - customer should appear within a few seconds

### Method 2: Check App Logs

Look for these logs in your terminal/console:

```
LOG [revenuecat] RevenueCat configured
LOG [revenuecat] RevenueCat logged in {"userId": "***"}
DEBUG [RevenueCat] ℹ️ API request started: GET '/v1/subscribers/.../offerings'
```

If you see these, RevenueCat is working and the customer should appear.

### Method 3: Verify User ID is Being Passed

1. **Check your user ID in Supabase:**
   ```sql
   SELECT id, email FROM public.profiles LIMIT 1;
   ```

2. **Check app logs for:**
   ```
   LOG [revenuecat] RevenueCat logged in {"userId": "YOUR_USER_ID"}
   ```

3. **Search in RevenueCat Dashboard:**
   - Go to Customers
   - Search for your Supabase user ID (the UUID)
   - It should appear if RevenueCat received the request

## Debug Steps

### Step 1: Verify RevenueCat is Configured

Check your `.env` file has the API key:
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd
```

### Step 2: Check App Initialization

In your app logs, you should see:
```
LOG [revenuecat] RevenueCat configured
LOG [revenuecat] RevenueCat logged in {"userId": "75e54308..."}
```

If you DON'T see "RevenueCat logged in", the user ID isn't being passed correctly.

### Step 3: Force a Request

The subscription store should automatically fetch offerings when initialized. To manually trigger:

1. **Go to paywall screen**
2. **Click "Refresh" button**
3. **Check logs** - should see RevenueCat API requests

### Step 4: Check RevenueCat Dashboard

1. **Go to RevenueCat Dashboard**
2. **Click "Customers"** in sidebar
3. **Wait 10-30 seconds** after triggering a request
4. **Search for your user ID** (Supabase UUID)

## Common Issues

### Issue 1: User ID Not Being Passed

**Symptom:** No "RevenueCat logged in" log

**Fix:** Check `app/_layout.tsx` - make sure `user.id` exists:
```typescript
if (user?.id && emailVerified) {
  initializeSubscription(user.id).catch(() => {});
}
```

### Issue 2: RevenueCat Not Configured

**Symptom:** No "RevenueCat configured" log

**Fix:** 
- Check `.env` file has API key
- Restart Metro bundler after adding API key
- Rebuild app if needed

### Issue 3: API Key Wrong

**Symptom:** RevenueCat errors in logs

**Fix:**
- Verify API key in RevenueCat Dashboard → Project Settings
- Make sure you're using the correct key (iOS vs Android)
- For testing, use the **Test** API key (starts with `test_`)

### Issue 4: Customer Created But Not Visible

**Symptom:** Logs show requests but no customer in dashboard

**Fix:**
- **Refresh the RevenueCat Dashboard** (sometimes takes a few seconds)
- **Check the correct project** (make sure you're in the right RevenueCat project)
- **Check filters** - make sure no filters are applied in Customers view

## Manual Customer Creation Test

To test if RevenueCat is working, you can manually trigger a request:

1. **Open app**
2. **Go to paywall screen**
3. **Open React Native Debugger** or check logs
4. **Look for RevenueCat API calls**

You should see:
```
DEBUG [RevenueCat] ℹ️ API request started: GET '/v1/subscribers/.../offerings'
DEBUG [RevenueCat] ℹ️ API request completed: GET '/v1/subscribers/.../offerings' (200)
```

If you see a 200 response, the customer was created successfully.

## Verify Customer Was Created

After triggering a request, check RevenueCat:

1. **Dashboard → Customers**
2. **Search for your Supabase user ID**
3. **Customer should show:**
   - App User ID: Your Supabase UUID
   - First Seen: Just now
   - Entitlements: None (if no purchase yet)

## Still Not Working?

If customers still don't appear:

1. **Check RevenueCat Dashboard → Project Settings → API Keys**
   - Make sure you're using the correct project
   - Verify the API key matches your `.env` file

2. **Check Network Tab** (if using React Native Debugger)
   - Look for requests to `api.revenuecat.com`
   - Check if they're successful (200 status)

3. **Try a different user ID:**
   - Create a new test account
   - Sign in and check if that user appears

4. **Check RevenueCat Status:**
   - Go to RevenueCat status page
   - Make sure their API is operational

## Expected Behavior

Once working correctly:
- Customer appears in RevenueCat within 10-30 seconds of first API call
- Customer ID matches your Supabase user ID
- You can see all API requests in RevenueCat Dashboard → Customers → [Your User] → Events


