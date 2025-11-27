# RevenueCat Test Store vs App Store Sandbox - Explained

## Two Different Testing Environments

### 1. RevenueCat Test Store (What You're Using Now)

**Your logs show:**
```
WARN [RevenueCat] ⚠️ Using a Test Store API key.
The Test Store is for development only. Never use a Test Store API key in production.
Test Store purchases are simulated, do not use StoreKit, and generate no revenue.
```

**What this means:**
- ✅ **Customers appear in:** RevenueCat Dashboard → Customers
- ❌ **Do NOT appear in:** App Store Connect → Sandbox Purchases
- ❌ **Do NOT use StoreKit:** Completely simulated by RevenueCat
- ✅ **Works in simulator:** No StoreKit configuration needed
- ✅ **Instant:** No waiting for App Store processing

**Where to find customers:**
- RevenueCat Dashboard → Customers
- Search for your user ID: `75e54308-4d12-485e-9516-da024793ab28`

### 2. App Store Connect Sandbox (Real StoreKit Testing)

**What this is:**
- ✅ **Customers appear in:** App Store Connect → Users and Access → Sandbox Testers
- ✅ **Purchases appear in:** App Store Connect → Sales and Trends → Sandbox Purchases
- ✅ **Uses real StoreKit:** Requires actual device (not simulator)
- ✅ **More realistic:** Tests actual App Store flow
- ❌ **Requires setup:** Need sandbox testers, StoreKit config, etc.

**When to use:**
- Testing on real devices
- Final testing before production
- Testing actual App Store purchase flow

## Why Your Customer Isn't in App Store Sandbox

**You're using RevenueCat Test Store**, which:
- Simulates purchases without StoreKit
- Doesn't create App Store sandbox transactions
- Only creates customers in RevenueCat Dashboard

## Where Your Customer Actually Is

Based on your logs, your customer **exists in RevenueCat**:

1. ✅ Customer created: `GET '/v1/subscribers/75e54308-4d12-485e-9516-da024793ab28'`
2. ✅ Purchase recorded: `POST '/v1/receipts' (200)`
3. ✅ CustomerInfo updated: `CustomerInfo updated from network`

**Find it here:**
- RevenueCat Dashboard → Customers
- Search: `75e54308-4d12-485e-9516-da024793ab28`

## Switching to Real Sandbox Testing

If you want to test with **real App Store sandbox**:

### Step 1: Get Production API Key
1. RevenueCat Dashboard → Project Settings → API Keys
2. Copy the **Public API Key** (NOT the test one)
3. Update `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=your_production_key_here
   ```

### Step 2: Set Up Sandbox Tester
1. App Store Connect → Users and Access → Sandbox Testers
2. Create a sandbox tester account
3. Use this account on your test device

### Step 3: Test on Real Device
1. Sign out of App Store on device
2. Run app
3. When prompted, sign in with sandbox tester
4. Purchase will appear in App Store Connect → Sandbox Purchases

### Step 4: Customer Will Appear in Both
- RevenueCat Dashboard → Customers
- App Store Connect → Sandbox Purchases

## Current Setup (Test Store) - Summary

**What works:**
- ✅ Testing subscription logic
- ✅ Testing paywall UI
- ✅ Testing webhook integration
- ✅ Testing subscription status updates
- ✅ Works in iOS Simulator

**What doesn't work:**
- ❌ Won't appear in App Store Connect sandbox
- ❌ Not real StoreKit transactions
- ❌ Can't test actual App Store purchase flow

**Where customers are:**
- ✅ RevenueCat Dashboard → Customers (search for user ID)

## Recommendation

**For now (development):**
- Keep using Test Store API key
- Find customers in RevenueCat Dashboard
- This is perfect for testing your integration

**Before production:**
- Switch to production API key
- Test with real sandbox on device
- Verify purchases appear in App Store Connect

## Quick Check: Is Customer in RevenueCat?

1. Go to RevenueCat Dashboard
2. Click "Customers" in sidebar
3. Search for: `75e54308-4d12-485e-9516-da024793ab28`
4. If found → Customer exists! ✅
5. If not found → Check project, filters, or refresh dashboard

The customer **should be there** based on your logs showing successful API calls.


