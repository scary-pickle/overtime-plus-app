# Fix: RevenueCat Module Not Loading

## The Problem

The error `"Cannot read property 'StoreClient' of undefined"` means the RevenueCat native module isn't loaded. This happens because:

1. **RevenueCat requires native code** - It can't work in Expo Go
2. **App needs to be rebuilt** - Native modules are compiled into the app binary
3. **Development build required** - You need `expo-dev-client` build, not Expo Go

## Solution: Rebuild the App

### Option 1: Build for iOS Simulator (Recommended for Testing)

```bash
# Build for iOS simulator
eas build --platform ios --profile ios-simulator
```

After the build completes:
1. Install it on your simulator
2. Start Expo dev server: `npx expo start`
3. Connect to the development build
4. The RevenueCat module should now load

### Option 2: Build for Development (Physical Device)

```bash
# Build for iOS device
eas build --platform ios --profile development
```

### Option 3: Local Build (Faster, but requires Xcode)

```bash
# Prebuild native code
npx expo prebuild

# Run on iOS simulator
npx expo run:ios
```

## Why This Happens

- **Expo Go** doesn't include custom native modules like RevenueCat
- **Development builds** include your native dependencies
- After installing `react-native-purchases`, you must rebuild

## After Rebuilding

Once you have a development build:

1. **The RevenueCat module will load** ✅
2. **Offerings will fetch from RevenueCat** ✅
3. **Products will appear on paywall** ✅

## Quick Checklist

- [ ] Packages installed: `react-native-purchases`, `expo-dev-client` ✅ (already done)
- [ ] `.env` file has API key ✅ (already done)
- [ ] **Rebuild app with native modules** ⚠️ (THIS IS THE ISSUE)
- [ ] Install development build on device/simulator
- [ ] Start Expo dev server
- [ ] Test paywall

## Next Steps

Run one of the build commands above to create a development build with RevenueCat support.

