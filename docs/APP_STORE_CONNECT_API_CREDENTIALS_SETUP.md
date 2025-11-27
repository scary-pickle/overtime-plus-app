# App Store Connect API Credentials Setup for RevenueCat

## Overview

RevenueCat needs App Store Connect API credentials to validate your SDK configuration and check product statuses. This guide will help you set up these credentials.

## Why This Is Needed

The warning you're seeing:
```
WARN [RevenueCat] ⚠️ We could not validate your SDK's configuration and check your product statuses in App Store Connect.
Error: Missing App Store Connect API credentials
```

This means RevenueCat can't automatically verify that your products are properly configured in App Store Connect. While this doesn't break functionality, it's recommended to set up API credentials for better monitoring and validation.

## Step 1: Create API Key in App Store Connect

### 1.1 Access App Store Connect

1. **Go to App Store Connect:**
   - Visit: https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Navigate to Users and Access:**
   - Click "Users and Access" in the top navigation
   - Or go directly to: https://appstoreconnect.apple.com/access/api

### 1.2 Create API Key

1. **Go to Keys Tab:**
   - Click on the **"Keys"** tab
   - You'll see a list of existing API keys (if any)

2. **Generate New Key:**
   - Click the **"+"** button (top left) or **"Generate API Key"**
   - Enter a **Key Name**: `RevenueCat Integration` (or any descriptive name)
   - Select **Access Level**: 
     - Choose **"Admin"** for full access (recommended)
     - Or **"App Manager"** if you want limited access

3. **Download Key:**
   - Click **"Generate"**
   - **IMPORTANT**: Download the `.p8` key file immediately
   - You can only download it once - if you lose it, you'll need to create a new key
   - Save it securely (e.g., in 1Password, or secure file storage)

4. **Note the Key ID:**
   - The Key ID is displayed (e.g., `ABC123DEF4`)
   - Copy this - you'll need it for RevenueCat

5. **Note the Issuer ID:**
   - The Issuer ID is shown at the top of the Keys page
   - It looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID format)
   - Copy this as well

## Step 2: Add Credentials to RevenueCat

### 2.1 Access RevenueCat Dashboard

1. **Go to RevenueCat:**
   - Visit: https://app.revenuecat.com
   - Sign in to your account

2. **Navigate to Your Project:**
   - Select your project from the dashboard
   - Or go directly to your project settings

### 2.2 Add App Store Connect API Credentials

1. **Go to Project Settings:**
   - Click on your project name in the top left
   - Select **"Project Settings"** from the dropdown
   - Or navigate to: Settings → Project Settings

2. **Find App Store Connect API Section:**
   - Scroll down to **"App Store Connect API"** section
   - Or look for **"iOS App Store Connect API"**

3. **Add Credentials:**
   - Click **"Add App Store Connect API Key"** or **"Configure"**
   - You'll need to provide:
     - **Key ID**: The Key ID from Step 1.4 (e.g., `ABC123DEF4`)
     - **Issuer ID**: The Issuer ID from Step 1.5 (UUID format)
     - **Private Key**: The contents of the `.p8` file you downloaded

4. **Upload Private Key:**
   - Open the `.p8` file in a text editor
   - Copy the entire contents (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
   - Paste into the "Private Key" field in RevenueCat
   - Or upload the file if RevenueCat supports file upload

5. **Save:**
   - Click **"Save"** or **"Add Key"**
   - RevenueCat will validate the credentials

## Step 3: Verify Configuration

### 3.1 Check RevenueCat Dashboard

1. **Verify Status:**
   - In RevenueCat, check that the App Store Connect API shows as **"Connected"** or **"Valid"**
   - You should see a green checkmark or success indicator

2. **Test Connection:**
   - RevenueCat may automatically test the connection
   - If there's an error, check:
     - Key ID is correct
     - Issuer ID is correct
     - Private key is complete (including headers/footers)
     - Key has proper permissions (Admin or App Manager)

### 3.2 Test in Your App

1. **Run Your App:**
   - The warning about missing credentials should disappear
   - Check your app logs - you should no longer see the API credentials warning

2. **Verify Product Status:**
   - RevenueCat can now check product statuses in App Store Connect
   - This helps with debugging product configuration issues

## Security Best Practices

### 🔒 Secure Storage

- **Never commit** the `.p8` file to git
- Store it in a secure password manager (1Password, LastPass, etc.)
- Use environment variables or secure secret storage for CI/CD
- Limit access to team members who need it

### 🔑 Key Management

- **Rotate keys periodically** (every 6-12 months)
- **Revoke old keys** when creating new ones
- **Use separate keys** for different environments (dev/staging/prod) if needed
- **Document key usage** so team members know what each key is for

### 👥 Access Control

- **Use least privilege**: If possible, use "App Manager" instead of "Admin"
- **Limit key access**: Only give access to team members who need it
- **Monitor key usage**: Check App Store Connect for unusual activity

## Troubleshooting

### "Invalid Key" Error

**Issue**: RevenueCat says the key is invalid

**Solutions**:
1. Verify Key ID is correct (no extra spaces)
2. Verify Issuer ID is correct (full UUID format)
3. Check private key includes headers/footers:
   ```
   -----BEGIN PRIVATE KEY-----
   [key content]
   -----END PRIVATE KEY-----
   ```
4. Make sure key hasn't been revoked in App Store Connect
5. Verify key has proper permissions (Admin or App Manager)

### "Key Not Found" Error

**Issue**: RevenueCat can't find the key

**Solutions**:
1. Verify key exists in App Store Connect (Users and Access → Keys)
2. Check that key hasn't been deleted
3. Make sure you're using the correct Key ID
4. Try creating a new key if the old one was lost

### "Permission Denied" Error

**Issue**: Key doesn't have proper permissions

**Solutions**:
1. Check key access level in App Store Connect
2. Ensure key has "Admin" or "App Manager" access
3. Verify your Apple Developer account has proper permissions
4. Try creating a new key with Admin access

### Still Seeing Warnings

**Issue**: Warning persists after adding credentials

**Solutions**:
1. Wait a few minutes for RevenueCat to sync
2. Refresh RevenueCat dashboard
3. Check that credentials are saved correctly
4. Verify you're using the correct RevenueCat project
5. Check app logs - the warning should disappear on next app launch

## Alternative: Skip API Credentials (Not Recommended)

If you don't want to set up API credentials:

- ⚠️ RevenueCat won't be able to validate product statuses automatically
- ⚠️ You'll see warnings in logs (but app will still work)
- ⚠️ Debugging product issues will be harder
- ✅ App functionality won't be affected
- ✅ Products will still work if properly configured

**Recommendation**: Set up API credentials for better monitoring and debugging.

## Quick Checklist

- [ ] API key created in App Store Connect
- [ ] `.p8` file downloaded and saved securely
- [ ] Key ID noted
- [ ] Issuer ID noted
- [ ] Credentials added to RevenueCat dashboard
- [ ] Status shows as "Connected" or "Valid"
- [ ] Warning no longer appears in app logs

## Related Documentation

- `APP_STORE_CONNECT_PRODUCTS_SETUP.md` - Set up subscription products
- `REVENUECAT_DEPLOYMENT_GUIDE.md` - Complete RevenueCat setup
- `STOREKIT_SETUP_GUIDE.md` - StoreKit Configuration file setup

## Support Resources

- **App Store Connect API Docs**: https://developer.apple.com/documentation/appstoreconnectapi
- **RevenueCat App Store Connect Setup**: https://docs.revenuecat.com/docs/app-store-connect-api
- **Apple API Key Guide**: https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api

---

**Estimated Time**: 10-15 minutes
**Difficulty**: Easy (requires App Store Connect access)

