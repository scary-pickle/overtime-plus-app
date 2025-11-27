# Code Review Findings - Placeholder Information & Faulty Logic

## Summary
This document contains findings from a thorough review of the Overtime+ app for placeholder information and faulty logic.

## Critical Issues

### 1. Hardcoded "Total Hours" in Email Service ⚠️
**Location:** `lib/email/emailService.ts`
**Lines:** 79, 122, 258

**Issue:** The "Total Hours" template variable is hardcoded to '0' or `Math.floor(0 / 60)`. This should be calculated from the actual logs being exported.

**Impact:** Email templates will always show "0" hours regardless of actual overtime logged.

**Fix Required:** 
- Modify email service functions to accept ExportBatch or logs array
- Calculate total hours from ExportBatch.totalMinutes or sum of log minutes
- Update function signatures: `composeAVACEmail`, `sendAVACEmailViaMailto`, `getAVACRecipientInfo`, `sendAVACEmail`

### 2. Widget Status Updater is Placeholder ⚠️
**Location:** `lib/widget/widgetStatusUpdater.ts`
**Lines:** 13-14, 24-27, 33-35

**Issue:** The widget status updater is documented as a placeholder that won't work with native widgets. It uses AsyncStorage which doesn't work with App Groups/SharedPreferences that native widgets need.

**Impact:** Widgets won't receive real-time updates when shift status changes.

**Fix Required:**
- Create native module bridge for iOS (App Groups UserDefaults) and Android (SharedPreferences)
- Or document that this is intentionally incomplete for Phase 2

## TODO/Placeholder Items

### 3. Supabase Implementation Stubs
**Location:** `lib/supabase.ts`
**Status:** ✅ Intentionally incomplete - This is a stub for Phase 2

All Supabase functions are marked with TODOs but this appears intentional as noted in the file comments. The app is designed to work offline-first.

### 4. Supabase Recipient Lookup in Email Service
**Location:** `lib/email/emailService.ts`
**Line:** 40

**Issue:** TODO comment indicates Supabase lookup should be implemented, but currently falls back to local data.

**Status:** ⚠️ Should work with local fallback, but TODO indicates incomplete feature.

### 5. Text Input Modal for Shift Label
**Location:** `app/shifts/new.tsx`
**Line:** 385

**Issue:** TODO comment about implementing text input modal. Currently uses Alert.prompt which may not work on all platforms.

**Impact:** May fail on platforms that don't support Alert.prompt.

## Console.log Statements

Multiple console.log statements found throughout production code. While these may be useful for debugging, consider:

1. Using a logging service for production builds
2. Removing debug console.logs in production
3. Converting to console.error for actual errors

**Files with console.log:**
- `app/(tabs)/home.tsx` (lines 92, 382)
- `app/(tabs)/profile.tsx` (lines 95, 100, 109)
- `app/(tabs)/exports.tsx` (multiple)
- `lib/pdf/buildAVAC.ts` (many debug logs)
- And many more...

**Recommendation:** Use a production-safe logging utility that can be disabled in production builds.

## Logic Issues

### 6. Debug Console Log in Home Screen
**Location:** `app/(tabs)/home.tsx`
**Line:** 382-387

**Issue:** Debug console.log that prints profile information - should be removed or made conditional.

### 7. Email Template Variable Calculation
**Location:** `lib/email/emailService.ts`

**Issue:** As mentioned in Critical Issue #1, Total Hours is hardcoded. Need to:
1. Get logs associated with ExportBatch
2. Calculate total hours from logs or use ExportBatch.totalMinutes
3. Format as hours (e.g., convert minutes to hours)

## Recommendations

### High Priority
1. **Fix Total Hours calculation** - This affects user communication accuracy
2. **Remove or conditionally disable debug console.logs** - Clean up production code
3. **Complete widget status updater** OR document it as Phase 2 feature

### Medium Priority
4. **Replace Alert.prompt** in shifts/new.tsx with proper modal component
5. **Implement logging utility** for production-safe logging

### Low Priority
6. **Document intentional TODOs** (Supabase stub)
7. **Review console.log usage** - Keep only essential error logging

## Testing Checklist

After fixes:
- [ ] Verify email templates show correct total hours
- [ ] Test shift label input on all platforms
- [ ] Verify widget updates (if implemented)
- [ ] Check console output in production build

