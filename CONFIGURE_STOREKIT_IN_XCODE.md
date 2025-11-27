# Configure StoreKit in Xcode 16.4 - Step by Step

## The Issue

The StoreKit Configuration file exists and is in the scheme, but it's not being used. In Xcode 16.4, the scheme editor might have a different layout.

## Solution: Configure via Scheme Editor

### Method 1: Using Scheme Editor (If Options Tab Exists)

1. **Open Scheme Editor:**
   - Product → Scheme → Edit Scheme (or press ⌘<)
   - Select **"Run"** on the left sidebar

2. **Look for StoreKit Configuration:**
   - Check all tabs: **Info**, **Arguments**, **Options**, **Diagnostics**
   - In newer Xcode versions, it might be under **"Info"** tab instead of "Options"
   - Look for a section called **"StoreKit Configuration"** or **"StoreKit Testing"**

3. **Set the Configuration:**
   - Find the dropdown for StoreKit Configuration
   - Select **"Products.storekit"** from the list
   - If not in list, click **"+"** or **"Add..."** button
   - Navigate to `ios/Products.storekit` and select it

### Method 2: Right-Click on StoreKit File

1. **In Project Navigator:**
   - Find `Products.storekit` in the left sidebar
   - Right-click on it
   - Look for options like:
     - "Set as StoreKit Configuration"
     - "Use for Testing"
     - Or similar StoreKit-related options

### Method 3: Project Settings

1. **Select the Project:**
   - Click on "Overtime" (blue project icon) in Project Navigator
   - Select the **"Overtime"** target (under TARGETS)
   - Go to **"Build Settings"** tab
   - Search for "StoreKit" in the search bar
   - Check if there's a setting for StoreKit Configuration

### Method 4: Verify File is Properly Added

1. **Check File in Project:**
   - In Project Navigator, find `Products.storekit`
   - Select it
   - In the File Inspector (right sidebar, ⌘⌥1), check:
     - **File Type:** Should be "StoreKit Configuration File" or "Default - StoreKit Configuration File"
     - **Location:** Should show the correct path
     - **Target Membership:** Make sure it's checked for the "Overtime" target

2. **If File Type is Wrong:**
   - Select the file
   - File Inspector → **File Type** dropdown
   - Change to **"StoreKit Configuration File"** or **"Default - StoreKit Configuration File"**

### Method 5: Direct Scheme XML Edit (Last Resort)

The scheme file already has the reference, but we can verify it's correct. The scheme should have:

```xml
<StoreKitConfigurationFileReference
   identifier = "Products.storekit">
</StoreKitConfigurationFileReference>
```

This is already in your scheme file, so it should work. The issue might be that Xcode needs to recognize the file properly.

## Quick Check: Is File Being Used?

After configuring, when you run the app, check the logs. You should see:
- ✅ No errors about products not being fetchable
- ✅ Products loading successfully
- ❌ If you still see errors, the file isn't being used

## Alternative: Test Without StoreKit File

Since you're getting errors anyway, you have two options:

### Option A: Continue Development Without Products

The errors are informational - your app will still work, just without subscription products visible. You can:
- Continue developing other features
- Set up App Store Connect products for production
- Test on real device with sandbox after products are approved

### Option B: Use RevenueCat Test Store

If you're using a test API key, purchases will be simulated anyway. The StoreKit file is just for testing the UI with products visible.

## What to Try Now

1. **In Xcode, with the scheme editor open:**
   - Look at ALL tabs (Info, Arguments, Options, Diagnostics, etc.)
   - Search for "StoreKit" in each tab
   - The setting might be in a different location than expected

2. **Check the Run action specifically:**
   - Make sure you're editing the **"Run"** action (not Test, Profile, etc.)
   - StoreKit Configuration only applies to Run action

3. **Try running directly from Xcode:**
   - Select iOS Simulator
   - Click Run (⌘R)
   - Even if the UI doesn't show it configured, the scheme XML has it, so it might work

4. **If still not working:**
   - The StoreKit file might need to be in a different location
   - Or you might need to set up App Store Connect products instead

Let me know what tabs you see in the scheme editor, and I can help you find the right one!



