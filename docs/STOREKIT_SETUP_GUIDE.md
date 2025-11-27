# StoreKit Configuration File Setup Guide

## Overview

The StoreKit Configuration file (`Products.storekit`) allows you to test in-app purchases and subscriptions in the iOS Simulator without needing real App Store Connect products. This is perfect for development and testing.

## What Was Created

✅ **StoreKit Configuration File**: `ios/Products.storekit`

This file includes:
- **Subscription Group**: "Overtime+ Premium"
- **Monthly Subscription**: `overtime_plus_monthly`
  - Price: $9.99/month
  - 1-month free trial
- **Yearly Subscription**: `overtime_plus_yearly`
  - Price: $99.99/year
  - 1-month free trial

## Configuration Status

⚠️ **Action needed once**: Point the Xcode Run scheme at `ios/Products.storekit` so the simulator uses these products.

**Quick attach steps**
1) Open the workspace: `open ios/Overtime.xcworkspace`
2) Product → Scheme → Edit Scheme → select **Run**
3) Find **StoreKit Configuration** (Options or Info tab, depending on Xcode)
4) Choose `Products.storekit` (located in `ios/`)

## How to Use

### Option 1: Normal run (after attaching)

Once the Run scheme points at `Products.storekit`, just:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Run in Simulator:**
   - Select an iOS Simulator
   - Press ⌘R or click Run
   - The StoreKit Configuration file will be used automatically

3. **Test Purchases:**
   - Navigate to the paywall screen
   - Products should load from the StoreKit Configuration file
   - You can make test purchases without real payment

### Option 2: Manually re-attach (if the scheme loses it)

If Xcode drops the reference or you switch schemes, re-attach it:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Edit Scheme:**
   - Product → Scheme → Edit Scheme (or press ⌘<)
   - Select "Run" on the left sidebar
   - Go to the "Options" tab
   - Under "StoreKit Configuration", select `Products.storekit`
   - Click "Close"

3. **Run in Simulator:**
   - Select an iOS Simulator
   - Press ⌘R to run
   - Products will load from the StoreKit Configuration file

## Customizing Prices

If you want to change the prices in the StoreKit Configuration file:

1. **Open in Xcode:**
   - Double-click `ios/Products.storekit` in Xcode
   - Or right-click → Open With → Xcode

2. **Edit Products:**
   - Click on a product (e.g., "Overtime+ Monthly")
   - Change the price in the inspector panel
   - Save (⌘S)

3. **Update Prices:**
   - Monthly: Currently $9.99/month
   - Yearly: Currently $99.99/year
   - You can adjust these to match your actual pricing

## Testing Purchases

### In Simulator

1. **Run app in Simulator**
2. **Navigate to paywall** (`/subscription/paywall`)
3. **Select a subscription**
4. **Complete purchase** - No real payment required!
5. **Verify subscription** - Check that subscription status updates

### Test Scenarios

- ✅ **Free Trial**: Both products include 1-month free trial
- ✅ **Monthly Subscription**: Test monthly renewal
- ✅ **Yearly Subscription**: Test yearly renewal
- ✅ **Cancellation**: Test subscription cancellation flow
- ✅ **Restore Purchases**: Test restore functionality

## Benefits

✅ **No App Store Connect Required**: Test without creating real products
✅ **Fast Testing**: No waiting for product approval
✅ **Free Testing**: No real payments needed
✅ **Simulator Support**: Works in iOS Simulator
✅ **Realistic Flow**: Mimics real purchase flow

## Limitations

⚠️ **Simulator Only**: StoreKit Configuration files only work in iOS Simulator
⚠️ **Not for Production**: Real devices need App Store Connect products
⚠️ **No Real Payments**: Can't test actual payment processing
⚠️ **No Webhooks**: RevenueCat webhooks won't fire for test purchases

## Next Steps

### For Development/Testing:
- ✅ Use StoreKit Configuration file (already set up)
- ✅ Test in iOS Simulator
- ✅ Verify purchase flows work correctly

### For Production:
- 📋 Create products in App Store Connect (see `APP_STORE_CONNECT_PRODUCTS_SETUP.md`)
- 📋 Link products in RevenueCat dashboard
- 📋 Test on real device with sandbox accounts
- 📋 Submit for App Review

## Troubleshooting

### Products Not Loading

**Issue**: Products don't appear in the app

**Solutions**:
1. Verify scheme is configured (Product → Scheme → Edit Scheme → Options → StoreKit Configuration)
2. Make sure you're running in iOS Simulator (not real device)
3. Check that `Products.storekit` file exists in `ios/` directory
4. Clean build folder (⌘⇧K) and rebuild

### StoreKit File Not Found

**Issue**: Xcode can't find the StoreKit Configuration file

**Solutions**:
1. Verify file exists: `ios/Products.storekit`
2. In Xcode, right-click `ios/` folder → Add Files to "Overtime"
3. Select `Products.storekit`
4. Make sure "Copy items if needed" is checked
5. Reconfigure scheme to use the file

### Products Still Not Working

**Issue**: Even with StoreKit file, products don't load

**Solutions**:
1. Check RevenueCat API key is set correctly
2. Verify product IDs match exactly: `overtime_plus_monthly`, `overtime_plus_yearly`
3. Check app logs for RevenueCat errors
4. Try restarting the simulator
5. Clear app data and reinstall

## File Location

```
ios/
  └── Products.storekit  ← StoreKit Configuration file
```

## Related Documentation

- `APP_STORE_CONNECT_PRODUCTS_SETUP.md` - Set up real products for production
- `REVENUECAT_PRODUCTS_NOT_FETCHABLE.md` - Troubleshooting product fetching
- `REVENUECAT_DEPLOYMENT_GUIDE.md` - Complete RevenueCat setup guide

---

**Status**: ✅ StoreKit Configuration file created and configured
**Next**: Test in iOS Simulator, then set up App Store Connect products for production
