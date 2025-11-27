# How to Rebuild App with RevenueCat Support

## The Issue

RevenueCat native module isn't loading because the app needs to be rebuilt with native modules included.

## Solution: Local Build (Fastest for Testing)

### Step 1: Prebuild Native Code

```bash
npx expo prebuild --clean
```

This generates the native iOS/Android projects with all native modules (including RevenueCat).

### Step 2: Run on iOS Simulator

```bash
npx expo run:ios
```

This will:
- Build the native iOS app with RevenueCat included
- Install it on the simulator
- Start the Metro bundler

### Step 3: Test the Paywall

Once the app launches:
1. Sign in
2. Navigate to Profile → View Paywall
3. Products should now appear!

## Alternative: Fix EAS Project ID First

If you prefer to use EAS builds:

1. **Get your EAS project ID:**
   - Go to https://expo.dev
   - Find your project
   - Copy the project ID

2. **Update app.config.ts:**
   ```typescript
   eas: {
     projectId: 'your-actual-project-id-here'  // Replace with real ID
   }
   ```

3. **Then build:**
   ```bash
   eas build --platform ios --profile ios-simulator
   ```

## Why This is Needed

- RevenueCat requires native code
- Native modules are compiled into the app binary
- After adding `react-native-purchases`, you must rebuild
- Expo Go doesn't support custom native modules

## After Rebuilding

The RevenueCat module will load and:
- ✅ Offerings will fetch from RevenueCat
- ✅ Products will appear on paywall
- ✅ Purchases will work

