# Fix Splash Screen Logo Size Mismatch

## Problem
The native splash screen logo appears larger than the React Native overlay logo (the one with the spinner). This creates a visible size jump when transitioning from the native splash to the React Native overlay.

## Root Cause
The native splash screen uses `resizeMode: 'contain'` with the full-size `icon.png`. When Expo scales this image to fit the screen, the logo appears at ~100% of the available space. Meanwhile, the React Native overlay explicitly sets the logo to 60% of screen width, causing a size mismatch.

## Solution
Use a pre-sized splash image where the logo is already at 60% of the canvas size with white padding. When `resizeMode: 'contain'` scales this image, the logo inside will appear at 60% of the screen, matching the React Native overlay.

## Steps to Fix

1. **Generate the 60% splash image:**
   ```bash
   npm run generate:splash
   ```
   This creates `assets/splash-60.png` with the logo at 60% size centered with white padding.

2. **Verify the configuration files use the correct splash image:**
   - `app.config.ts` should have:
     ```typescript
     splash: {
       image: './assets/splash-60.png',
       resizeMode: 'contain',
       backgroundColor: '#ffffff'
     }
     ```
   - `app.json` should match:
     ```json
     "splash": {
       "image": "./assets/splash-60.png",
       "resizeMode": "contain",
       "backgroundColor": "#ffffff"
     }
     ```

3. **Rebuild the native app** (required for splash screen changes):
   ```bash
   # For iOS
   npm run prebuild:ios
   npx expo run:ios
   
   # For Android
   npm run prebuild:android
   npx expo run:android
   ```

4. **Verify the fix:**
   - Cold start the app
   - The native splash logo should appear at 60% size
   - The React Native overlay logo (with spinner) should match at 60% size
   - There should be no visible size transition between them

## Technical Details

- The `splash-60.png` image is 1024x1024 pixels with a 614x614 logo (60% of 1024) centered with white padding
- When `resizeMode: 'contain'` scales this 1024x1024 image to fit the screen, the logo inside scales proportionally and appears at 60% of the screen width
- The React Native overlay (`AnimatedSplashIcon` component) calculates size as `screenWidth * 0.6`, ensuring perfect matching

## Related Files
- `scripts/generate-splash.js` - Script to generate the 60% splash image
- `components/AnimatedSplashIcon.tsx` - React Native overlay component
- `app/_layout.tsx` - Root layout that shows the overlay
- `app/(tabs)/home.tsx` - Home screen that shows the loading splash with spinner
