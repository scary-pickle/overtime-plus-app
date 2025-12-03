# Fix StoreKit Configuration - Manual Steps

## The Problem

The StoreKit Configuration file exists and is referenced in the scheme, but RevenueCat still can't find it. This usually means the file needs to be manually configured in Xcode's UI.

## Solution: Configure in Xcode UI

### Step 1: Open Xcode

```bash
open ios/Overtime.xcworkspace
```

### Step 2: Verify File is in Project

1. In Xcode's Project Navigator (left sidebar), look for `Products.storekit`
2. If you don't see it:
   - Right-click on the `ios` folder (or root project folder)
   - Select "Add Files to 'Overtime'..."
   - Navigate to and select `ios/Products.storekit`
   - **Important:** Make sure "Copy items if needed" is **UNCHECKED** (file already exists)
   - Make sure "Create groups" is selected
   - Click "Add"

### Step 3: Configure Scheme Manually

1. **Edit Scheme:**
   - Product → Scheme → Edit Scheme (or press ⌘<)
   - Select **"Run"** on the left sidebar
   - Go to the **"Options"** tab

2. **Set StoreKit Configuration:**
   - Scroll down to **"StoreKit Configuration"** section
   - Click the dropdown (should say "None" or be empty)
   - Select **"Products.storekit"** from the list
   - If it's not in the list, click **"Add StoreKit Configuration File..."**
   - Navigate to and select `ios/Products.storekit`
   - Click **"Close"**

### Step 4: Verify Configuration

1. **Check the scheme again:**
   - Product → Scheme → Edit Scheme
   - Run → Options tab
   - Under "StoreKit Configuration", you should see `Products.storekit` selected

2. **Verify file type:**
   - In Project Navigator, select `Products.storekit`
   - In the File Inspector (right sidebar), check the file type
   - It should show as "StoreKit Configuration File" or similar

### Step 5: Clean and Rebuild

1. **Clean Build Folder:**
   - Product → Clean Build Folder (⌘⇧K)
   - Or skip this if it fails (Xcode build system issue)

2. **Rebuild:**
   - Product → Run (⌘R)
   - Make sure you're running in **iOS Simulator** (not real device)

### Step 6: Test

1. **Run the app** in iOS Simulator
2. **Navigate to paywall** (`/subscription/paywall`)
3. **Check logs** - you should see products loading from StoreKit file
4. **Products should appear** on the paywall screen

## Alternative: Run Directly from Xcode

Instead of using `npx expo run:ios`, try running directly from Xcode:

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **Select iOS Simulator:**
   - Top toolbar → Select an iOS Simulator (e.g., "iPhone 15 Pro")

3. **Run:**
   - Click the Play button (or ⌘R)
   - This ensures the scheme configuration is used

## Troubleshooting

### StoreKit File Not in Dropdown

**Issue:** `Products.storekit` doesn't appear in the StoreKit Configuration dropdown

**Fix:**
1. Make sure the file is added to the Xcode project (see Step 2)
2. Try closing and reopening Xcode
3. Try removing and re-adding the file to the project

### Still Getting Errors

**Issue:** Products still don't load after configuring

**Check:**
1. Are you running in **iOS Simulator**? (StoreKit files only work in simulator)
2. Is the scheme configured correctly? (Run → Options → StoreKit Configuration)
3. Are the product IDs correct? (`overtime_plus_monthly`, `overtime_plus_yearly`)
4. Try restarting the simulator
5. Try deleting the app from simulator and reinstalling

### File Type Wrong

**Issue:** File shows as "Text" instead of "StoreKit Configuration File"

**Fix:**
1. Select the file in Xcode
2. File Inspector (right sidebar) → File Type
3. Change to "StoreKit Configuration File" or "Default - StoreKit Configuration File"

## Verification

After configuring, you should see in the logs:
- ✅ No errors about products not being fetchable
- ✅ Products loading successfully
- ✅ Paywall showing subscription options

If you still see errors, the StoreKit file might not be properly configured. Try the manual steps above.

---

**Important:** StoreKit Configuration files **only work in iOS Simulator**, not on real devices. For real device testing, you need App Store Connect products.




