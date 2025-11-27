# Troubleshooting: Offerings Not Loading

## Quick Checks

### 1. Verify API Key is Loaded

**Check if the API key is actually being used:**

1. **Restart your app completely** (not just reload)
   - Close the app completely
   - Reopen it
   - This ensures `.env` variables are loaded

2. **Check app logs for RevenueCat errors:**
   - Look for messages like "RevenueCat configured" or "Failed to configure RevenueCat"
   - Check for "missing-api-key" errors

### 2. Verify RevenueCat Offering is Set as "Current"

**In RevenueCat Dashboard:**

1. Go to **Offerings**
2. Find your offering (should be named `default` or similar)
3. **Check that it's set as "Current Offering"**
   - There should be a toggle or "Set as Current" button
   - The current offering should be highlighted or marked

4. **Verify packages are in the offering:**
   - Click on the offering
   - Should see both monthly and yearly packages
   - Packages should have products attached

### 3. Verify Products are Active

**In RevenueCat Dashboard:**

1. Go to **Products**
2. Check that `overtime_plus_monthly` and `overtime_plus_yearly` are:
   - ✅ Created
   - ✅ Linked to App Store subscriptions
   - ✅ Active (not archived)

### 4. Check RevenueCat Dashboard for Errors

1. Go to **RevenueCat Dashboard → Project Settings**
2. Check for any warnings or errors
3. Verify the API key you're using matches the project

### 5. Test API Key Directly

The test API key should work. Verify:
- Key starts with `test_`
- Key matches what's in RevenueCat Dashboard → API Keys → Test Keys

## Common Issues & Fixes

### Issue: API Key Not Loading

**Fix:**
1. Make sure `.env` file is in the project root (same level as `package.json`)
2. Restart Expo dev server: `npx expo start --clear`
3. Rebuild the app if using EAS build

### Issue: Offering Not Set as Current

**Fix:**
1. Go to RevenueCat Dashboard → Offerings
2. Click on your offering
3. Toggle "Set as Current Offering" to ON
4. Or click "Set as Current" button

### Issue: Products Not Linked

**Fix:**
1. Go to RevenueCat Dashboard → Products
2. Click on each product
3. Under "Store Products", verify App Store subscription is linked
4. If not linked, click "Link Store Product" and select your App Store subscription

### Issue: No Packages in Offering

**Fix:**
1. Go to RevenueCat Dashboard → Offerings
2. Click on your offering
3. Click "Add Package"
4. Create packages:
   - Monthly package → Attach `overtime_plus_monthly` product
   - Yearly package → Attach `overtime_plus_yearly` product

## Debug Steps

### Step 1: Check App Logs

Look for these log messages:
- ✅ "RevenueCat configured" - API key loaded
- ❌ "RevenueCat API key missing" - API key not found
- ❌ "Failed to fetch RevenueCat offerings" - Error fetching

### Step 2: Verify in RevenueCat Dashboard

1. **Offerings:**
   - [ ] Offering exists
   - [ ] Offering is set as "Current"
   - [ ] Offering has packages
   - [ ] Packages have products attached

2. **Products:**
   - [ ] Products exist
   - [ ] Products are linked to App Store
   - [ ] Products are active

3. **API Keys:**
   - [ ] Test key matches what's in `.env`
   - [ ] Key is for the correct project

### Step 3: Test Refresh Button

On the paywall screen:
1. Click the "Refresh" button
2. Check if offerings load after refresh
3. Check app logs for any errors

### Step 4: Verify Environment Variable

**Check if the variable is actually loaded:**

Add temporary debug logging (or check existing logs):
- The app should log "RevenueCat configured" when the API key is found
- If you see "RevenueCat API key missing", the `.env` file isn't being read

## Quick Fix Checklist

- [ ] `.env` file exists in project root
- [ ] API key is in `.env`: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_aGPJMitHdSnFAjFtartVLjcMMVd`
- [ ] App completely restarted (not just reloaded)
- [ ] RevenueCat offering is set as "Current"
- [ ] Offering has packages with products
- [ ] Products are linked to App Store subscriptions
- [ ] Products are active (not archived)
- [ ] Test API key matches RevenueCat Dashboard

## Still Not Working?

If offerings still don't load after all checks:

1. **Check RevenueCat Dashboard → Customers:**
   - Try creating a test customer
   - See if the API key works there

2. **Verify test API key:**
   - RevenueCat Dashboard → Project Settings → API Keys
   - Copy the test key again
   - Make sure it matches exactly (no extra spaces)

3. **Check network:**
   - Make sure device/simulator has internet
   - Try on different network

4. **Check RevenueCat status:**
   - Visit RevenueCat status page
   - Make sure service is operational

