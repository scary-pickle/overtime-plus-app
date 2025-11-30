# TestFlight Submission Guide

This guide walks you through submitting an iOS build to TestFlight for beta testing.

## Prerequisites

1. **Apple Developer Account** (paid membership required - $99/year)
2. **App Store Connect Access** - Your app must be registered in App Store Connect
3. **Xcode** (latest version recommended) OR **EAS CLI** installed and logged in
4. **App Store Connect API Key** (optional, for EAS) or App Store Connect credentials

## Two Methods: Xcode vs EAS

You can submit to TestFlight using either method:

- **Xcode** (Recommended for direct control) - Build and submit directly from Xcode
- **EAS** (Recommended for CI/CD) - Build in the cloud and submit via command line

Choose the method that works best for you. This guide covers both.

---

## Method 1: Submit via Xcode

This method gives you full control and is often faster for local development.

### Step 1: Prepare App Store Connect

#### 1.1 Create/Verify Your App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps**
3. Click **+** to create a new app (if it doesn't exist)
4. Fill in:
   - **Platform**: iOS
   - **Name**: Overtime+
   - **Primary Language**: English (or your preference)
   - **Bundle ID**: `com.overtimeplus.app` (must match your `app.config.ts`)
   - **SKU**: A unique identifier (e.g., `overtime-plus-ios`)
   - **User Access**: Full Access (or App Manager if you have a team)

### Step 2: Configure Xcode Project

#### 2.1 Open Your Project in Xcode

```bash
cd ios
open Overtime.xcworkspace
```

**Important:** Always open the `.xcworkspace` file, not the `.xcodeproj` file (because you're using CocoaPods).

#### 2.2 Select Your Target

1. In Xcode, click on the **Overtime** project in the left sidebar
2. Select the **Overtime** target (under TARGETS)
3. Go to the **Signing & Capabilities** tab

#### 2.3 Configure Signing

1. **Team**: Select your Apple Developer team from the dropdown
   - If you don't see your team, click "Add Account..." and sign in with your Apple ID
2. **Bundle Identifier**: Verify it's `com.overtimeplus.app`
3. **Automatically manage signing**: ✅ Check this box
   - Xcode will automatically create/update provisioning profiles

#### 2.4 Set Build Configuration

1. Go to **Product** → **Scheme** → **Edit Scheme...**
2. Select **Archive** in the left sidebar
3. Set **Build Configuration** to **Release**
4. Click **Close**

### Step 3: Update Version and Build Number

#### 3.1 Update Version in Xcode

1. In the project settings, go to the **General** tab
2. Update **Version** (e.g., `1.0.0`) - This is your marketing version
3. Update **Build** (e.g., `1`) - This must increment for each submission
   - Or leave it blank and Xcode will auto-increment

**Alternative:** You can also update these in `app.config.ts`:
```typescript
version: '1.0.0',
ios: {
  buildNumber: '1',
  // ...
}
```

Then run `npx expo prebuild --clean` to sync to Xcode.

### Step 4: Build and Archive

#### 4.1 Select Generic iOS Device

1. In the device selector (top toolbar), select **Any iOS Device (arm64)**
   - Don't select a simulator or connected device

#### 4.2 Create Archive

1. Go to **Product** → **Archive**
2. Wait for the build to complete (5-15 minutes depending on your Mac)
3. The **Organizer** window will open automatically when done

**Note:** If Archive is grayed out:
- Make sure you selected "Any iOS Device" (not a simulator)
- Check that your signing is configured correctly
- Try cleaning the build: **Product** → **Clean Build Folder** (Shift+Cmd+K)

### Step 5: Upload to App Store Connect

#### 5.1 Distribute App

1. In the **Organizer** window, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Click **Next**

#### 5.2 Choose Distribution Method

1. Select **Upload**
2. Click **Next**

#### 5.3 Select Distribution Options

1. **Distribution options**: Usually leave defaults
   - ✅ **Upload your app's symbols** (recommended for crash reports)
   - ✅ **Manage Version and Build Number** (if you want Xcode to manage it)
2. Click **Next**

#### 5.4 Review and Upload

1. Review the summary
2. Click **Upload**
3. Wait for upload to complete (5-10 minutes)
4. You'll see a success message when done

### Step 6: Wait for Processing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Overtime+** → **TestFlight**
3. You'll see your build appear with status "Processing"
4. Wait 10-30 minutes for Apple to process the build
5. You'll receive an email when processing is complete

### Step 7: Configure TestFlight (Same as EAS Method)

Follow the steps in **Method 2: Submit via EAS** → **Step 5: Configure TestFlight** below.

---

## Method 2: Submit via EAS

This method is great for CI/CD and cloud builds.

### Step 1: Prepare App Store Connect

### 1.1 Create/Verify Your App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps**
3. Click **+** to create a new app (if it doesn't exist)
4. Fill in:
   - **Platform**: iOS
   - **Name**: Overtime+
   - **Primary Language**: English (or your preference)
   - **Bundle ID**: `com.overtimeplus.app` (must match your `app.config.ts`)
   - **SKU**: A unique identifier (e.g., `overtime-plus-ios`)
   - **User Access**: Full Access (or App Manager if you have a team)

### 1.2 Get Your App Store Connect Information

You'll need these values for EAS submit configuration:

- **ASC App ID**: Found in App Store Connect → Your App → App Information → Apple ID
- **Apple Team ID**: Found in App Store Connect → Users and Access → Your Name → Team ID
- **Apple ID**: Your Apple ID email address

## Step 2: Configure EAS Submit

### 2.1 Update `eas.json` Submit Configuration

Update the `submit` section in your `eas.json` with your actual values:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      }
    }
  }
}
```

**Where to find these values:**
- `appleId`: Your Apple ID email
- `ascAppId`: App Store Connect → Your App → App Information → Apple ID (numeric)
- `appleTeamId`: App Store Connect → Users and Access → Your Name → Team ID (10 characters)

### 2.2 Alternative: Use App Store Connect API Key (Recommended)

For better security and automation, use an API key instead of credentials:

1. **Create API Key in App Store Connect:**
   - Go to App Store Connect → Users and Access → Keys
   - Click **+** to generate a new key
   - Name it (e.g., "EAS Submit Key")
   - Download the `.p8` key file (you can only download once!)
   - Note the **Key ID** and **Issuer ID**

2. **Update `eas.json` to use API key:**
```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456",
        "appleApiKey": "./path/to/AuthKey_XXXXXXXXXX.p8",
        "appleApiKeyId": "XXXXXXXXXX",
        "appleIssuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

**Important:** Add the `.p8` file to `.gitignore` to avoid committing it!

## Step 3: Build Your iOS App

### 3.1 Build for Production

Build your iOS app using the production profile:

```bash
eas build --profile production --platform ios
```

This will:
- Build your app in the cloud
- Generate an `.ipa` file
- Take approximately 15-30 minutes

### 3.2 Monitor Build Progress

You can monitor the build progress:
- In the terminal output
- At [expo.dev](https://expo.dev) → Your Project → Builds

### 3.3 Wait for Build to Complete

The build must complete successfully before you can submit. You'll see a success message with a build ID when it's done.

## Step 4: Submit to TestFlight

### 4.1 Submit the Build

Once your build is complete, submit it to TestFlight:

```bash
eas submit --platform ios --latest
```

Or submit a specific build:

```bash
eas submit --platform ios --id <build-id>
```

### 4.2 Authentication

If using credentials (not API key), you'll be prompted for:
- Apple ID email
- App-specific password (not your regular password)

**To create an app-specific password:**
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → Security → App-Specific Passwords
3. Generate a new password for "EAS Submit"
4. Use this password when prompted

### 4.3 Wait for Processing

After submission:
1. EAS uploads the build to App Store Connect
2. Apple processes the build (usually 10-30 minutes)
3. You'll receive an email when processing is complete

---

## Configure TestFlight (Applies to Both Methods)

**Note:** These steps are the same whether you submitted via Xcode or EAS. Once your build is processed in App Store Connect, follow these steps.

### 5.1 Add Test Information (First Time Only)

In App Store Connect → Your App → TestFlight:

1. **Test Information:**
   - What to Test: Brief description of what testers should focus on
   - Feedback Email: Your email for tester feedback
   - Marketing URL (optional): Your website
   - Privacy Policy URL: Required if you collect user data

2. **Beta App Review Information:**
   - Contact Information
   - Demo Account (if login required)
   - Notes: Any special instructions for reviewers

### 5.2 Add Internal Testers

1. Go to TestFlight → Internal Testing
2. Click **+** to add testers
3. Add users by email (must be in your App Store Connect team)
4. Select the build you want to test
5. Click **Start Testing**

**Note:** Internal testers can test immediately after processing (up to 100 testers).

### 5.3 Add External Testers (Optional)

1. Go to TestFlight → External Testing
2. Create a new group (e.g., "Beta Testers")
3. Add testers by email (up to 10,000 testers)
4. Select the build
5. Submit for Beta App Review (first time only, takes 24-48 hours)

**Note:** External testing requires Beta App Review approval the first time.

## Step 6: Distribute to Testers

### 6.1 Internal Testing

- Testers receive an email invitation
- They install TestFlight app from App Store
- Open the invitation email and tap "Start Testing"
- The app appears in TestFlight and can be installed

### 6.2 External Testing

- After Beta App Review approval, testers receive email invitations
- Same process as internal testing

## Troubleshooting

### Xcode-Specific Issues

#### Archive is Grayed Out

**Solutions:**
- Select "Any iOS Device" in the device selector (not a simulator)
- Check that signing is configured correctly (Signing & Capabilities tab)
- Clean build folder: **Product** → **Clean Build Folder** (Shift+Cmd+K)
- Close and reopen Xcode
- Make sure you opened `.xcworkspace`, not `.xcodeproj`

#### Code Signing Errors

**Solutions:**
- Verify your Apple Developer account is added in Xcode → Preferences → Accounts
- Check that your team is selected in Signing & Capabilities
- Ensure bundle identifier matches App Store Connect (`com.overtimeplus.app`)
- Try unchecking and rechecking "Automatically manage signing"
- Delete derived data: **Xcode** → **Preferences** → **Locations** → Click arrow next to Derived Data → Delete folder

#### Build Errors

**Solutions:**
- Update CocoaPods: `cd ios && pod install`
- Clean build: **Product** → **Clean Build Folder**
- Delete derived data (see above)
- Check that all dependencies are installed: `cd ios && pod install --repo-update`

#### Upload Fails

**Solutions:**
- Check your internet connection
- Verify you're signed in to App Store Connect with the correct account
- Try uploading again (sometimes Apple's servers have issues)
- Check App Store Connect for any compliance issues

### EAS-Specific Issues

#### Build Fails

**Common issues:**
- Missing environment variables → Check EAS secrets
- Code signing errors → Verify bundle identifier matches App Store Connect
- Build timeout → Try again or contact EAS support

**Check build logs:**
```bash
eas build:list
eas build:view <build-id>
```

#### Submit Fails

**Common issues:**
- Invalid credentials → Verify Apple ID and app-specific password
- Missing App Store Connect app → Create app in App Store Connect first
- Wrong ASC App ID → Double-check the numeric ID in App Store Connect

**Check submit logs:**
```bash
eas submit:list
eas submit:view <submit-id>
```

### Build Processing Fails in App Store Connect

**Common issues:**
- Missing compliance information → Fill out Export Compliance in App Store Connect
- Invalid provisioning profile → EAS handles this automatically, but check bundle ID matches
- Missing required app icons → Verify `assets/icon.png` exists and is correct size

**Check processing status:**
- App Store Connect → Your App → TestFlight → Builds
- Look for error messages or warnings

### Testers Can't Install

**Common issues:**
- Build still processing → Wait for email confirmation
- Tester not added to group → Verify they're in the correct TestFlight group
- iOS version incompatible → Check minimum iOS version in `app.config.ts`

## Quick Reference

### Xcode Method

1. **Open project:**
   ```bash
   cd ios
   open Overtime.xcworkspace
   ```

2. **In Xcode:**
   - Select "Any iOS Device" in device selector
   - **Product** → **Archive**
   - In Organizer: **Distribute App** → **App Store Connect** → **Upload**

### EAS Method

```bash
# Build for production
eas build --profile production --platform ios

# Submit latest build
eas submit --platform ios --latest

# List builds
eas build:list

# View build details
eas build:view <build-id>

# List submissions
eas submit:list

# View submission details
eas submit:view <submit-id>
```

## Best Practices

1. **Version Management:**
   - Update `version` in `app.config.ts` before each build
   - Use semantic versioning (e.g., 1.0.0, 1.0.1, 1.1.0)

2. **Build Number:**
   - EAS automatically increments build numbers
   - Or set manually in `app.config.ts` → `ios.buildNumber`

3. **Testing Checklist:**
   - Test on physical devices before submitting
   - Verify all features work in production build
   - Check that environment variables are correct

4. **Release Notes:**
   - Add release notes in App Store Connect for each build
   - Helps testers understand what's new or fixed

5. **Security:**
   - Never commit API keys or `.p8` files
   - Use EAS Secrets for environment variables
   - Rotate API keys periodically

## Next Steps After TestFlight

Once testing is complete:

1. **Fix any issues found**
2. **Submit for App Store Review** (when ready for production)**
3. **Release to production** after approval

For App Store submission, the process is similar but you'll need to:
- Complete App Store listing information
- Add screenshots and app description
- Submit for App Review (not Beta App Review)

## Additional Resources

- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

git 