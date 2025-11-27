# How to Get P8 Key, Key ID, and Issuer ID from App Store Connect

## Step 1: Go to App Store Connect

1. **Navigate to:** https://appstoreconnect.apple.com
2. **Sign in** with your Apple Developer account

## Step 2: Access Users and Access

1. Click **"Users and Access"** in the top navigation bar
2. Click on the **"Keys"** tab (next to "Users", "Sandbox Testers", etc.)

## Step 3: Create or Find Your App Store Connect API Key

### If You Don't Have a Key Yet:

1. **Click the "+" button** (or "Generate API Key" button)
2. **Enter a name** for the key (e.g., "RevenueCat Integration" or "Overtime+ Subscriptions")
3. **Select Access Level:**
   - Choose **"App Manager"** or **"Admin"** (needed for in-app purchases)
4. **Click "Generate"**
5. **Download the key immediately:**
   - ⚠️ **IMPORTANT:** You can only download the `.p8` file ONCE
   - Click **"Download API Key"** button
   - Save the file somewhere safe (it will be named like `AuthKey_XXXXXXXXXX.p8`)

### If You Already Have a Key:

1. Find your key in the list
2. If you haven't downloaded it yet, you can download it
3. If you already downloaded it, you'll need to use the file you saved

## Step 4: Get the Key ID

1. **In the Keys list**, you'll see your key
2. **Key ID** is displayed in the table (it's a 10-character string like `ABC123DEFG`)
3. **Copy this Key ID** - you'll need it for RevenueCat

## Step 5: Get the Issuer ID

1. **Still on the Keys page**, look at the top of the page
2. **Issuer ID** is displayed near the top (it's a UUID like `57246542-96fe-1a63-e053-0824d0110a29`)
3. **Copy this Issuer ID** - you'll need it for RevenueCat

## Step 6: Upload to RevenueCat

Now you have all three pieces:

1. **P8 Key File:** The `.p8` file you downloaded (e.g., `AuthKey_XXXXXXXXXX.p8`)
2. **Key ID:** The 10-character string from the Keys table
3. **Issuer ID:** The UUID from the top of the Keys page

### In RevenueCat:

1. Go to your iOS app settings in RevenueCat
2. Find "In-app purchase key configuration" section
3. **Upload the P8 file:**
   - Drag and drop the `.p8` file, or click to select it
   - File should be named like `AuthKey_XXXXXXXXXX.p8` or `SubscriptionKey_XXXXXXXXXX.p8`
4. **Enter Key ID:** Paste the Key ID you copied
5. **Enter Issuer ID:** Paste the Issuer ID you copied
6. **Save**

## Important Notes

### ⚠️ Security:
- **Never commit the `.p8` file to Git** - add it to `.gitignore`
- **Keep the file secure** - it provides access to your App Store Connect account
- **If you lose the file**, you'll need to create a new key

### 📝 File Naming:
- RevenueCat expects: `SubscriptionKey_XXXXXXXXXX.p8` or `AuthKey_XXXXXXXXXX.p8`
- If your file has a different name, you can rename it (the `.p8` extension is what matters)

### 🔑 Key Permissions:
- The key needs **App Manager** or **Admin** access to work with in-app purchases
- If you get errors, check the key's access level

## Quick Checklist

- [ ] Go to App Store Connect → Users and Access → Keys
- [ ] Create new key (or use existing)
- [ ] Download `.p8` file (save it securely!)
- [ ] Copy Key ID (10 characters)
- [ ] Copy Issuer ID (UUID)
- [ ] Upload all three to RevenueCat

## Troubleshooting

### "Key file not found"
- Make sure you downloaded the `.p8` file
- Check the file extension is `.p8` (not `.p8.txt`)

### "Invalid Key ID"
- Make sure you copied the full 10-character Key ID
- It should be all uppercase letters and numbers

### "Invalid Issuer ID"
- Make sure you copied the full UUID
- It should include all dashes (format: `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)

### "Access Denied" errors
- Check the key has "App Manager" or "Admin" access level
- You may need to create a new key with proper permissions


