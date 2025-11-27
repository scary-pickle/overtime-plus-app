# Future Enhancements

This document tracks planned enhancements that are documented as TODOs in the codebase.

## Widget Native Module Bridge (Phase 2)

**Location:** `lib/widget/widgetStatusUpdater.ts`

**Current Status:** Phase 2 feature - Not implemented. All references to `updateWidgetStatus()` have been removed from the codebase.

**Enhancement:** Implement native module bridge for widget status updates:
- **iOS:** Use `UserDefaults(suiteName: "group.com.overtimeplus.app")` with App Groups
- **Android:** Use `SharedPreferences` with name "overtime_prefs"

**Why:** Proper App Groups/SharedPreferences integration is required for widgets to access shared data. Native widgets cannot access AsyncStorage - they require App Groups (iOS) or SharedPreferences (Android).

**Priority:** Phase 2 - Widget functionality depends on this. See `lib/widget/widgetStatusUpdater.ts` for detailed implementation notes.

---

## Network Status Detection

**Location:** `lib/supabase.ts` (lines 2161-2162)

**Current Status:** `isOnline` is hardcoded to `true`, `autoSync` is hardcoded to `false`

**Enhancement:** 
1. Implement network status detection using `@react-native-community/netinfo`
2. Add user preference for auto-sync setting
3. Update `syncStatus` object to reflect actual network state and user preferences

**Why:** 
- Network detection enables smarter sync behavior (only sync when online)
- Auto-sync preference gives users control over background sync

**Priority:** Medium - Improves user experience and battery life

---

## Supabase Email Recipient Lookup

**Location:** `lib/email/emailService.ts` (line 43)

**Current Status:** Using local fallback data from `hospitalDepartments.ts`

**Enhancement:** Implement Supabase lookup for email recipients:
- Create Supabase table/view for hospital/department email mappings
- Query Supabase when backend is ready
- Fall back to local data if Supabase lookup fails

**Why:** Centralized email recipient management in Supabase allows for easier updates without app releases.

**Priority:** Low - Current local fallback works, but centralized management would be better

---

## Notes

- All TODOs are documented here for tracking
- None of these are blocking for production release
- These can be implemented incrementally in future releases






