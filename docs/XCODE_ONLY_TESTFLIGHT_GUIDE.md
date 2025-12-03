# TestFlight Submission via Xcode Only (No EAS Build)

This guide shows you how to build and submit to TestFlight using **only Xcode**, completely bypassing EAS Build to avoid costs.

## Prerequisites

1. **Xcode** (latest version recommended)
2. **Apple Developer Account** ($99/year)
3. **App Store Connect Access**
4. **Local Development Environment** (Mac with Xcode)

## Step 1: Generate Native iOS Project

Since you're using Expo, you need to generate the native iOS project first:

```bash
# Generate native iOS project
npx expo prebuild --platform ios --clean

# This creates the ios/ folder with Xcode project
```

**Note**: The `ios/` folder should already exist in your project. If it does, you can skip this step or run it to regenerate.

## Step 2: Set Up Environment Variables Locally

Since you're not using EAS Build, you have two options:

### Option A: Use Local .env File (Recommended for Local Builds)

1. Create a `.env` file in your project root (if it doesn't exist)
2. Add all required environment variables:

```bash
# .env file
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key-here
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://your-domain.com/privacy
EXPO_PUBLIC_TERMS_URL=https://your-domain.com/terms
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=rc_ios_public_key_here
EXPO_PUBLIC_DISABLE_PAYWALL=false
# ... other variables
```

3. Install `dotenv` if not already installed:
```bash
npm install --save-dev dotenv
```

4. Make sure your `app.config.ts` reads from `.env` (Expo should do this automatically)

**Important**: The `.env` file is already in `.gitignore`, so it won't be committed.

### Option B: Set in Xcode Build Settings

You can also set environment variables in Xcode's build settings, but Option A is easier.

## Step 3: Open Project in Xcode

```bash
cd ios
open Overtime.xcworkspace
```

**Critical**: Always open the `.xcworkspace` file, NOT the `.xcodeproj` file (because you're using CocoaPods).

## Step 4: Configure Signing in Xcode

1. In Xcode, click on the **Overtime** project in the left sidebar
2. Select the **Overtime** target (under TARGETS)
3. Go to the **Signing & Capabilities** tab
4. Configure:
   - **Team**: Select your Apple Developer team
   - **Bundle Identifier**: Verify it's `com.overtimeplus.app`
   - **Automatically manage signing**: ✅ Check this box

## Step 5: Update Version and Build Number

1. In Xcode project settings, go to the **General** tab
2. Update **Version** (e.g., `1.0.0`) - This is your marketing version
3. Update **Build** (e.g., `1`) - This must increment for each submission

**Alternative**: You can also update these in `app.config.ts`:
```typescript
version: '1.0.0',
ios: {
  buildNumber: '1',
  // ...
}
```

Then run `npx expo prebuild --clean` to sync to Xcode.

## Step 6: Set Build Configuration

1. Go to **Product** → **Scheme** → **Edit Scheme...**
2. Select **Archive** in the left sidebar
3. Set **Build Configuration** to **Release**
4. Click **Close**

## Step 7: Install CocoaPods Dependencies

```bash
cd ios
pod install
```

## Step 8: Build and Archive

1. In Xcode device selector (top toolbar), select **Any iOS Device (arm64)**
   - Don't select a simulator or connected device

2. Go to **Product** → **Archive**
   - Wait for the build to complete (5-15 minutes depending on your Mac)
   - The **Organizer** window will open automatically when done

**Note**: If Archive is grayed out:
- Make sure you selected "Any iOS Device" (not a simulator)
- Check that signing is configured correctly
- Try cleaning: **Product** → **Clean Build Folder** (Shift+Cmd+K)

## Step 9: Submit to App Store Connect

1. In the **Organizer** window, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Click **Next**
5. Select **Upload**
6. Click **Next**
7. Review distribution options:
   - ✅ **Upload your app's symbols** (recommended for crash reports)
   - ✅ **Manage Version and Build Number** (optional)
8. Click **Next**
9. Review the summary
10. Click **Upload**
11. Wait for upload to complete (5-10 minutes)

## Step 10: Wait for Processing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Overtime+** → **TestFlight**
3. You'll see your build appear with status "Processing"
4. Wait 10-30 minutes for Apple to process the build
5. You'll receive an email when processing is complete

## Step 11: Configure TestFlight

Once your build is processed:

1. **Test Information**:
   - What to Test: Brief description
   - Feedback Email: Your email
   - Privacy Policy URL: Required (must match your environment variable)

2. **Beta App Review Information**:
   - Contact Information
   - Demo Account (if login required)
   - Notes: Any special instructions

3. **Add Internal Testers**:
   - Go to TestFlight → Internal Testing
   - Click **+** to add testers
   - Add users by email (must be in your App Store Connect team)
   - Select the build
   - Click **Start Testing**

## Advantages of Xcode-Only Approach

✅ **No EAS Build costs** - Build locally for free  
✅ **Faster iteration** - No waiting for cloud builds  
✅ **Full control** - Direct access to Xcode settings  
✅ **Offline builds** - Don't need internet for building  

## Disadvantages

⚠️ **Requires Mac** - Can't build on Windows/Linux  
⚠️ **Local resources** - Uses your Mac's CPU/memory  
⚠️ **Manual setup** - Need to manage environment variables locally  
⚠️ **CocoaPods** - Need to run `pod install` when dependencies change  

## Environment Variables Management

Since you're not using EAS Secrets, you need to manage environment variables locally:

1. **Development**: Use `.env` file (already in `.gitignore`)
2. **Production**: 
   - Option A: Use `.env` file (make sure it's not committed)
   - Option B: Set in Xcode build settings
   - Option C: Use Xcode schemes with different configurations

## Troubleshooting

### Archive is Grayed Out
- Select "Any iOS Device" in device selector
- Check signing configuration
- Clean build folder: **Product** → **Clean Build Folder**

### Code Signing Errors
- Verify Apple Developer account is added in Xcode → Preferences → Accounts
- Check team is selected in Signing & Capabilities
- Ensure bundle identifier matches App Store Connect
- Try unchecking and rechecking "Automatically manage signing"

### Build Errors
- Update CocoaPods: `cd ios && pod install`
- Clean build: **Product** → **Clean Build Folder**
- Delete derived data: **Xcode** → **Preferences** → **Locations** → Derived Data → Delete

### Environment Variables Not Working
- Verify `.env` file exists in project root
- Check `app.config.ts` reads from environment variables
- Restart Metro bundler if running
- Clean and rebuild

## Quick Reference

```bash
# Generate native project
npx expo prebuild --platform ios --clean

# Install CocoaPods dependencies
cd ios && pod install

# Open in Xcode
open Overtime.xcworkspace

# Then in Xcode:
# 1. Product → Archive
# 2. Organizer → Distribute App → App Store Connect → Upload
```

## Next Steps

After your first successful submission:
- Set up CI/CD (optional) - GitHub Actions can build and submit automatically
- Automate version bumping
- Set up fastlane (optional) - For more automation

---

**Summary**: Yes, you can completely bypass EAS Build and use Xcode only. Just generate the native project with `expo prebuild`, manage environment variables locally, and build/archive in Xcode. No EAS costs! 🎉


