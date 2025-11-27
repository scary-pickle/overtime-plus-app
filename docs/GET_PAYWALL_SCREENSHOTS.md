# Getting Paywall Screenshots for App Store Connect Review

## The Problem

You need screenshots of your paywall for App Store Connect product review, but you can't see the products in the app until they're approved. This is a classic chicken-and-egg situation!

## Solution Options

### Option 1: Use iOS Simulator with StoreKit Configuration File (Easiest)

The StoreKit Configuration file we created works in the iOS Simulator, so you can get screenshots there!

#### Steps:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Run in iOS Simulator:**
   - Select an iOS Simulator (any iPhone model)
   - Press ⌘R to run
   - The StoreKit Configuration file will automatically be used

3. **Navigate to Paywall:**
   - Sign in to your app
   - Go to Profile tab
   - Tap "View Paywall" or navigate to `/subscription/paywall`

4. **Products Should Load:**
   - You should see both subscription options:
     - Monthly: $9.99/month
     - Yearly: $99.99/year
   - Both should show "Start Free Trial" or similar

5. **Take Screenshots:**
   - **Option A: Simulator Menu**
     - Device → Screenshot (or ⌘S)
     - Screenshot saved to Desktop
   
   - **Option B: iOS Simulator Toolbar**
     - Click the camera icon in the simulator toolbar
     - Or use ⌘S keyboard shortcut
   
   - **Option C: Mac Screenshot**
     - Press ⌘⇧4 to select area
     - Or ⌘⇧3 for full screen
     - Or ⌘⇧4 then Spacebar to capture window

6. **Edit Screenshots (if needed):**
   - Open in Preview or any image editor
   - Crop to show just the paywall
   - Make sure it's clear and readable
   - Recommended size: 1242 x 2688 pixels (iPhone Pro Max) or similar

### Option 2: Use RevenueCat Test Store on Real Device

If you want to test on your actual iPhone:

1. **Make sure you're using Test API key:**
   ```bash
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=test_...
   ```

2. **Build and run on device:**
   ```bash
   npx expo run:ios --device
   ```

3. **Navigate to paywall** - products should load (simulated)

4. **Take screenshot on iPhone:**
   - Press Volume Up + Side Button simultaneously
   - Screenshot saved to Photos

5. **Transfer to Mac:**
   - AirDrop, iCloud Photos, or connect via USB

### Option 3: Create Mock/Placeholder Screenshots

If products still don't load, you can create mock screenshots:

1. **Use design tools:**
   - Figma, Sketch, or even Keynote/PowerPoint
   - Create a mockup of your paywall UI
   - Show the subscription options with placeholder text

2. **What to include:**
   - Your app's branding
   - Subscription options (Monthly/Yearly)
   - Pricing information
   - "Start Free Trial" buttons
   - Any feature highlights

3. **Make it realistic:**
   - Match your actual UI design
   - Use correct product names
   - Show accurate pricing (if you know it)

### Option 4: Submit Without Screenshots (Some Fields Optional)

**Good news:** Screenshots are often **optional** for subscription products in App Store Connect!

#### Check What's Required:

1. **Go to App Store Connect:**
   - Navigate to your subscription product
   - Check the "Review Information" section

2. **Required vs Optional:**
   - **Required:** Product ID, Display Name, Description, Pricing
   - **Optional:** Screenshots, Review Notes (often)

3. **Try submitting without screenshots:**
   - Complete all required fields
   - Leave screenshot blank or upload a placeholder
   - Add a note in "Review Notes" explaining:
     ```
     Screenshots will be provided after products are approved and visible in the app.
     The paywall is accessible at [path] after sign-in.
     ```

### Option 5: Use App Store Connect's Preview Tool

Some subscription products allow you to preview without screenshots:

1. **In App Store Connect:**
   - Go to your subscription product
   - Look for "Preview" or "Test" options
   - Some products can be tested in TestFlight builds

## Recommended Approach

**Best workflow:**

1. ✅ **Use iOS Simulator** (Option 1) - Easiest and most reliable
2. ✅ **Take screenshots** of paywall with products loaded
3. ✅ **Submit products** with screenshots
4. ✅ **Wait for approval** (24-48 hours)
5. ✅ **Test on real device** with sandbox after approval

## Screenshot Requirements

### Size Recommendations:
- **iPhone:** 1242 x 2688 pixels (iPhone Pro Max)
- **Or:** 1170 x 2532 pixels (iPhone 12/13/14)
- **Format:** PNG or JPEG
- **Max file size:** Usually 500KB per image

### What to Show:
- ✅ Clear view of subscription options
- ✅ Pricing information
- ✅ "Start Free Trial" or purchase buttons
- ✅ Any feature highlights or benefits
- ✅ Your app's branding/design

### What to Avoid:
- ❌ Blurry or low-quality images
- ❌ Screenshots that are too small
- ❌ Personal information visible
- ❌ Test/placeholder data (if possible)

## Troubleshooting

### Products Still Don't Load in Simulator

**Check:**
1. StoreKit Configuration file exists: `ios/Products.storekit`
2. Xcode scheme is configured (Product → Scheme → Edit Scheme → Options → StoreKit Configuration)
3. Running in Simulator (not real device)
4. Clean build folder (⌘⇧K) and rebuild

### Screenshots Rejected

**Common reasons:**
- Screenshots don't match actual app experience
- Missing required information
- Poor quality or unclear

**Fix:**
- Use actual app screenshots (not mockups)
- Ensure all text is readable
- Match the actual UI design

### Products Approved But Still Don't Load

**After approval:**
1. Wait 5-10 minutes for sync
2. Verify products are linked in RevenueCat
3. Check you're using production API key (not test)
4. Try on real device with sandbox tester

## Quick Checklist

- [ ] StoreKit Configuration file created (`ios/Products.storekit`)
- [ ] Xcode scheme configured to use StoreKit file
- [ ] Run app in iOS Simulator
- [ ] Navigate to paywall screen
- [ ] Products load successfully
- [ ] Take screenshots (⌘S in Simulator)
- [ ] Edit/crop screenshots if needed
- [ ] Upload to App Store Connect
- [ ] Submit products for review

## Alternative: Submit Without Screenshots

If you can't get screenshots working:

1. **Complete all required fields** in App Store Connect
2. **Leave screenshot blank** or upload a simple placeholder
3. **Add Review Notes:**
   ```
   Screenshots will be provided after products are approved.
   The subscription paywall is accessible in the app after user sign-in.
   Products are configured in RevenueCat and will be visible once approved.
   ```
4. **Submit for review** - Apple may approve without screenshots
5. **Update with real screenshots** after approval if needed

## Next Steps

1. **Try Option 1** (Simulator with StoreKit) - This should work!
2. **Take screenshots** of the paywall
3. **Upload to App Store Connect** in your subscription products
4. **Submit for review**
5. **Wait for approval** (24-48 hours typically)
6. **Test on real device** with sandbox after approval

---

**Pro Tip:** The StoreKit Configuration file we created earlier should make this easy - just run in the simulator and take screenshots!

