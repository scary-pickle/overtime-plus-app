# Quick Fix Prompt: Splash Screen Size Mismatch

**Problem:** The native splash screen logo is larger than the React Native overlay logo (with spinner), causing a visible size jump.

**Fix:** The native splash uses `icon.png` with `resizeMode: 'contain'`, which scales it to ~100% of screen. The React Native overlay uses 60% of screen width. 

**Solution:**
1. Run `npm run generate:splash` to create `assets/splash-60.png` (logo at 60% with white padding)
2. Update `app.config.ts` and `app.json` to use `'./assets/splash-60.png'` instead of `'./assets/icon.png'`
3. Rebuild native app: `npm run prebuild:ios && npx expo run:ios` (or Android equivalent)

The `splash-60.png` has the logo at 60% of canvas size, so when `contain` scales it, the logo appears at 60% of screen, matching the React Native overlay.
