# Clean Rebuild Instructions

## The Problem

The RevenueCat native module still isn't loading even after rebuild. This usually means:
1. The app is using a cached/old build
2. Metro bundler cache needs clearing
3. Xcode build cache needs clearing

## Solution: Complete Clean Rebuild

### Step 1: Stop Everything

```bash
# Stop Metro bundler and any running processes
pkill -f "expo\|metro\|node.*8081" || true
```

### Step 2: Clean All Caches

```bash
cd /Users/nathanaeldavidson/Overtime+

# Clear Metro bundler cache
npx expo start --clear

# Or manually:
rm -rf node_modules/.cache
rm -rf .expo
```

### Step 3: Clean Xcode Build

```bash
cd ios

# Clean Xcode build
xcodebuild clean -workspace Overtime.xcworkspace -scheme Overtime

# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/Overtime-*

# Reinstall pods (to ensure RevenueCat is linked)
pod deintegrate
pod install
```

### Step 4: Rebuild and Run

```bash
cd /Users/nathanaeldavidson/Overtime+

# Rebuild and run
npx expo run:ios
```

## Alternative: Open in Xcode and Build

1. **Open Xcode:**
   ```bash
   open ios/Overtime.xcworkspace
   ```

2. **In Xcode:**
   - Product → Clean Build Folder (Shift+Cmd+K)
   - Product → Build (Cmd+B)
   - Wait for build to complete
   - Product → Run (Cmd+R)

3. **Then start Metro:**
   ```bash
   npx expo start
   ```

## Verify RevenueCat is Linked

After rebuilding, check the logs for:
- ✅ "RevenueCat configured" (not the error)
- ✅ Products loading from RevenueCat
- ✅ Offerings appearing

## If Still Not Working

1. **Verify pods installed:**
   ```bash
   cd ios
   pod install
   ```
   Should see `RNPurchases` and `RevenueCat` in the output

2. **Check Xcode project:**
   - Open `ios/Overtime.xcworkspace` in Xcode
   - Check that `RNPurchases` appears in Pods
   - Verify it's linked to the Overtime target

3. **Check for build errors:**
   - Look for any red errors in Xcode
   - Check if RevenueCat framework is missing


