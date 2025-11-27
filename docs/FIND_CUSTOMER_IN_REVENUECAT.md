# Finding Your Customer in RevenueCat Dashboard

## Your User ID
Based on your logs, your user ID is:
```
75e54308-4d12-485e-9516-da024793ab28
```

## Step-by-Step: Find Your Customer

### Step 1: Verify You're in the Right Project
1. Go to RevenueCat Dashboard
2. Check the project name in the top-left
3. Make sure it matches the project where your API key is from

### Step 2: Go to Customers Section
1. Click **"Customers"** in the left sidebar
2. You should see a list or search bar

### Step 3: Search for Your User ID
1. **Use the search bar** at the top of the Customers page
2. **Paste this exact ID:** `75e54308-4d12-485e-9516-da024793ab28`
3. Press Enter or click search

### Step 4: Check Filters
1. Make sure **no filters are applied** (Active, Inactive, etc.)
2. Check if there's a "Show test customers" toggle - enable it if present

## Important: Test Store API Key

Your logs show:
```
WARN [RevenueCat] ⚠️ Using a Test Store API key.
```

**Test Store customers might:**
- Appear in a separate section
- Have a different view/filter
- Need to be explicitly searched for
- Not appear in the main customer list until a purchase is made

## Verify Customer Exists

Based on your logs, the customer **definitely exists** because:

1. ✅ RevenueCat logged in: `LOG [revenuecat] RevenueCat logged in`
2. ✅ API requests successful: `GET '/v1/subscribers/75e54308-4d12-485e-9516-da024793ab28/offerings'` (200/304)
3. ✅ Purchase was made: `POST '/v1/receipts' (200)`
4. ✅ CustomerInfo updated: `CustomerInfo updated from network`

## Alternative: Check via API

If you still can't find it in the dashboard, you can verify via RevenueCat's API:

1. Go to RevenueCat Dashboard → **Project Settings** → **API Keys**
2. Copy your **Secret API Key** (not the public one)
3. Run this curl command:

```bash
curl -X GET "https://api.revenuecat.com/v1/subscribers/75e54308-4d12-485e-9516-da024793ab28" \
  -H "Authorization: Bearer YOUR_SECRET_API_KEY" \
  -H "X-Platform: ios"
```

If this returns customer data, the customer exists and it's a dashboard display issue.

## Common Issues

### Issue 1: Wrong Project
- **Solution:** Make sure you're in the project that matches your API key
- Check your `.env` file - the API key should match the project

### Issue 2: Test vs Production
- **Solution:** Test Store customers might be in a separate view
- Look for a "Test Customers" or "Sandbox" filter/tab

### Issue 3: Dashboard Cache
- **Solution:** Hard refresh the RevenueCat dashboard (Cmd+Shift+R or Ctrl+Shift+R)
- Or log out and log back in

### Issue 4: Search Not Working
- **Solution:** Try searching for just part of the ID: `75e54308`
- Or try searching by email if you've set attributes

## What You Should See

When you find the customer, you should see:
- **App User ID:** `75e54308-4d12-485e-9516-da024793ab28`
- **First Seen:** Recent timestamp
- **Entitlements:** Should show your subscription if purchase was successful
- **Events:** Should show the purchase event from your logs

## Still Can't Find It?

1. **Check RevenueCat Status:** https://status.revenuecat.com/
2. **Check API Key:** Make sure the API key in `.env` matches the project you're looking in
3. **Contact RevenueCat Support:** They can help locate the customer

## Quick Test

To force a new customer creation:
1. Delete the customer in RevenueCat (if you can find it)
2. Or use a different test user ID
3. Reload the app
4. Navigate to paywall
5. Customer should appear within 30 seconds


