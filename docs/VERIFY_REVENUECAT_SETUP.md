# Verify RevenueCat Setup - Step by Step

## Issue: Products Not Showing

The paywall shows "No offerings loaded from RevenueCat yet" which means either:
1. RevenueCat native module isn't loading (we're fixing this)
2. Offering isn't set as "Current" in RevenueCat Dashboard
3. Products aren't properly configured

## Quick Fix Steps

### 1. Reload App with Fixed Code

The code fix I just made should help. **Reload the app** (shake device → Reload, or Cmd+R in simulator).

### 2. Verify RevenueCat Dashboard Configuration

**Go to RevenueCat Dashboard and check:**

1. **Offerings:**
   - [ ] Go to Offerings section
   - [ ] Find your offering (probably named `default`)
   - [ ] **CRITICAL:** Make sure it's marked as "Current Offering"
   - [ ] If not, click "Set as Current" or toggle it ON

2. **Products in Offering:**
   - [ ] Click on your offering
   - [ ] Should see packages listed (monthly, yearly)
   - [ ] Each package should have a product attached

3. **Products:**
   - [ ] Go to Products section
   - [ ] Verify `overtime_plus_monthly` exists
   - [ ] Verify `overtime_plus_yearly` exists
   - [ ] Both should be linked to App Store subscriptions

### 3. Check App Logs After Reload

After reloading, look for:
- ✅ "RevenueCat configured" (instead of error)
- ✅ Any RevenueCat API calls
- ✅ Offerings being fetched

### 4. Try Refresh Button

On the paywall screen, click the "Refresh" button to manually trigger a fetch.

## Most Common Issue

**The offering is not set as "Current"** - This is the #1 reason products don't show!

RevenueCat only returns the "Current" offering. If none is set, the app gets empty results.

## Quick Test

1. **In RevenueCat Dashboard:**
   - Offerings → Your offering → Set as "Current"

2. **In App:**
   - Reload app (Cmd+R)
   - Go to paywall
   - Click "Refresh" button
   - Products should appear!


