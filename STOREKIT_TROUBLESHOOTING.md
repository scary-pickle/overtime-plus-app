# StoreKit Configuration Troubleshooting

## Current Issue

The StoreKit Configuration file (`Products.storekit`) exists and is referenced in the scheme, but RevenueCat still can't fetch products from it. The error persists:

```
Error fetching offerings - None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file if one is being used).
```

## Known Issues

### iOS 18.4-18.5 Simulator Bug

There's a **known bug in iOS 18.4 and 18.5 simulators** where StoreKit fails to load products. You're using iOS 18.6, which should be fixed, but there might still be issues.

**Solution:** Try a different simulator version or test on a physical device.

## Root Cause Analysis

Looking at your logs:
- Line 635: "Using a simulator. Ensure you have a StoreKit Config file set up"
- Line 711: "No existing products cached, starting store products request"
- Line 748: Products still can't be fetched

This suggests:
1. ✅ RevenueCat knows you're in a simulator
2. ✅ It's trying to fetch from StoreKit
3. ❌ StoreKit isn't returning the products

## Solutions to Try

### Solution 1: Verify Scheme Configuration in Xcode UI

The scheme XML has the reference, but Xcode might not be using it. You **must** configure it in Xcode's UI:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Edit Scheme:**
   - Product → Scheme → Edit Scheme (⌘<)
   - Select **"Run"** on the left
   - Look for **"Options"** tab (or check all tabs)
   - Find **"StoreKit Configuration"** section
   - Select **"Products.storekit"** from dropdown
   - If not in list, click **"+"** or **"Add..."** and browse to `ios/Products.storekit`

3. **Save and Run:**
   - Click "Close" to save
   - Run the app (⌘R)

### Solution 2: Try Different Simulator

The iOS 18.6 simulator might still have issues. Try:

1. **Use iOS 17.x Simulator:**
   - Xcode → Window → Devices and Simulators
   - Download iOS 17.5 or 17.4 simulator
   - Run app on that simulator

2. **Or use iOS 19.x Simulator:**
   - If available, try the latest iOS 19 simulator

### Solution 3: Test on Physical Device

StoreKit Configuration files **only work in simulator**. For real device testing, you need App Store Connect products. However, you can test the RevenueCat integration:

1. **Set up App Store Connect products** (see `APP_STORE_CONNECT_PRODUCTS_SETUP.md`)
2. **Use sandbox tester account**
3. **Test on real iPhone**

### Solution 4: Verify File Location and Type

1. **Check file is in project:**
   - In Xcode Project Navigator, `Products.storekit` should be visible
   - If not, right-click project → "Add Files to 'Overtime'..." → select `ios/Products.storekit`

2. **Check file type:**
   - Select `Products.storekit` in Project Navigator
   - File Inspector (⌘⌥1) → **File Type**
   - Should be **"StoreKit Configuration File"** or **"Default - StoreKit Configuration File"**
   - If wrong, change it

3. **Check file path:**
   - File Inspector → **Location**
   - Should show: `Relative to Group` or absolute path to `ios/Products.storekit`

### Solution 5: Clean Build and Derived Data

1. **Clean build folder:**
   - Product → Clean Build Folder (⌘⇧K)

2. **Delete derived data:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/Overtime-*
   ```

3. **Restart Xcode and rebuild**

### Solution 6: Check StoreKit File Content

Verify the file has correct product IDs:

```bash
grep -A 1 "productID" ios/Products.storekit
```

Should show:
- `overtime_plus_monthly`
- `overtime_plus_yearly`

## Alternative: Continue Without StoreKit File

If StoreKit file continues to not work, you have options:

### Option A: Use RevenueCat Test Store

If you're using a test API key, purchases are simulated anyway. The StoreKit file is just for testing the UI. You can:
- Continue development
- Set up App Store Connect products for production
- Test on real device with sandbox

### Option B: Suppress Errors (Already Done)

The code already logs these as debug messages instead of errors, so your app won't crash. You can continue developing other features.

## Verification Checklist

After trying solutions, verify:

- [ ] StoreKit file is in Xcode project (visible in Project Navigator)
- [ ] File type is "StoreKit Configuration File"
- [ ] Scheme is configured in Xcode UI (not just XML)
- [ ] Running on iOS Simulator (not real device)
- [ ] Using iOS 17.x or 19.x simulator (avoid 18.4-18.6 if possible)
- [ ] Products have correct IDs: `overtime_plus_monthly`, `overtime_plus_yearly`
- [ ] Clean build and rebuild after changes

## Next Steps

1. **Try Solution 1 first** - Configure scheme in Xcode UI
2. **If that doesn't work, try Solution 2** - Different simulator
3. **If still not working, use Solution 3** - Set up App Store Connect products for real device testing

The StoreKit file should work, but if it doesn't, you can still proceed with App Store Connect products for production testing.



