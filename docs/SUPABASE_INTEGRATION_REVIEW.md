# Supabase Integration Review

## Summary
This document reviews the Supabase database integration to identify any missing features, unlinked functionality, or logic issues that need to be addressed.

## ✅ What's Working Well

### 1. Store Integration
- **All stores properly handle userId**: LogsStore, ShiftsStore, ProfileStore all accept optional `userId` and fall back to `useAuthStore.getState().user?.id` if not provided
- **Background sync is non-blocking**: All Supabase sync operations happen in the background and won't fail the app if Supabase is unavailable
- **Offline-first approach**: Local SQLite is primary; Supabase is secondary for multi-device sync
- **Proper error handling**: Sync failures are logged but don't block local operations

### 2. Authentication Flow
- **Session management**: Properly checks session on app start and validates user existence
- **Onboarding sync**: Onboarding status is synced to Supabase user metadata
- **Email verification**: Properly tracked and synced

### 3. Data Sync
- **Profile sync**: Downloads from Supabase first, then falls back to local storage. Background syncs local changes.
- **Logs sync**: Merges remote and local logs, with remote taking precedence for conflicts
- **Shifts sync**: Similar merge strategy as logs
- **Export batches sync**: Properly synced to Supabase

## ⚠️ Issues Found

### Critical Issues

#### 1. Widget Data Provider Missing userId ✅ FIXED
**Location:** `lib/widget/widgetDataProvider.ts` (lines 28, 61)

**Issue:** 
```typescript
const logs = await database.getOvertimeLogs(); // ❌ No userId
```

**Problem:** 
- Widget data provider is called from native code (widgets) which may not have access to user context
- This could return logs from the wrong user in multi-user scenarios
- The widget needs to know which user's data to display

**Fix Implemented:** 
- ✅ Store current userId in SecureStore when user signs in (in authStore)
- ✅ Widget data provider reads userId from SecureStore before querying database
- ✅ AuthStore stores/clears userId in SecureStore on sign in/out
- ✅ Widget functions now pass userId to database queries

#### 2. Widget Confirm Screen Missing userId ✅ FIXED
**Location:** `app/widget/confirm.tsx` (line 37)

**Issue:**
```typescript
await Promise.all([loadProfile(), loadShifts(), loadLogs()]); // ❌ No userId
```

**Fix Implemented:**
```typescript
const { user } = useAuthStore();
await Promise.all([loadProfile(user?.id), loadShifts(user?.id), loadLogs(user?.id)]);
```

### Medium Priority Issues

#### 3. Shifts Screen Missing userId ✅ FIXED
**Location:** `app/(tabs)/shifts.tsx` (lines 32, 37)

**Fix Implemented:**
```typescript
const { user } = useAuthStore();
loadShifts(user?.id);
```

#### 4. Email Settings Missing userId ✅ FIXED
**Location:** `app/email-settings.tsx` (lines 58, 104)

**Fix Implemented:**
```typescript
const { user } = useAuthStore();
await saveProfile(updatedProfile, user?.id);
```

#### 5. Analytics Screen Missing userId
**Location:** `app/analytics/index.tsx` (line 45)

**Issue:**
```typescript
loadLogs(); // ❌ No userId
```

**Fix Required:**
```typescript
const { user } = useAuthStore();
loadLogs(user?.id);
```

### Low Priority Issues

#### 6. Clear Data Screen Missing userId
**Location:** `app/clear-data.tsx` (lines 55-56)

**Issue:**
```typescript
loadLogs(),
loadShifts(), // ❌ No userId
```

**Fix Required:** Pass userId explicitly (though this might be intentional for clearing all data)

## 🔍 Logic Review

### Profile Store Logic ✅
- **Correct**: Loads from Supabase first if authenticated, then falls back to local
- **Correct**: Background syncs local changes to Supabase
- **Correct**: Clears legacy profile when userId is provided

### Logs Store Logic ✅
- **Correct**: Loads from local first (fast), then syncs from Supabase in background
- **Correct**: Merges remote and local logs with remote taking precedence
- **Correct**: All CRUD operations sync to Supabase in background

### Shifts Store Logic ✅
- **Correct**: Same pattern as logs store
- **Correct**: Properly handles userId for all operations

### Onboarding Store Logic ✅
- **Correct**: Syncs onboarding status to Supabase user metadata
- **Correct**: Falls back to local storage if Supabase unavailable

### Auth Store Logic ✅
- **Correct**: Validates user existence on session check
- **Correct**: Clears session if user is deleted or invalid
- **Correct**: Checks onboarding status after authentication

## 📋 Recommendations

### High Priority
1. **Fix Widget Data Provider userId handling** - This is critical for multi-user scenarios
2. **Add userId to widget confirm screen** - Ensure widgets always use correct user data
3. **Add userId to shifts screen** - Explicit userId improves clarity and reliability

### Medium Priority
4. **Add userId to email settings** - Ensure profile saves are user-specific
5. **Add userId to analytics screen** - Ensure analytics show correct user data

### Low Priority
6. **Review clear data screen** - Determine if it should clear all data or just current user's data

## 🔄 Missing Features (Not Bugs)

### 1. Real-time Sync
- Current implementation uses background sync on load/change
- **Missing**: Real-time subscriptions for multi-device sync
- **Impact**: Changes on one device won't appear on another until app restart or manual refresh
- **Recommendation**: Consider adding Supabase real-time subscriptions for critical data (logs, shifts)

### 2. Conflict Resolution
- Current implementation: Remote wins for conflicts
- **Missing**: More sophisticated conflict resolution (last-write-wins, user choice, etc.)
- **Impact**: User changes might be overwritten by older remote data
- **Recommendation**: Implement timestamp-based conflict resolution or user-facing conflict resolution UI

### 3. Offline Queue
- Current implementation: Sync happens immediately in background
- **Missing**: Queue of pending sync operations for offline scenarios
- **Impact**: Changes made offline might not sync if app is closed before coming online
- **Recommendation**: Implement a sync queue that persists pending operations

### 4. Sync Status UI
- Current implementation: Sync happens silently
- **Missing**: User-facing sync status indicator
- **Impact**: Users don't know if their data is synced
- **Recommendation**: Add a sync status indicator in settings or profile screen

## ✅ Things That Are Correctly Implemented

1. **Offline-first architecture**: Local SQLite is primary, Supabase is secondary
2. **User isolation**: All data is properly scoped by userId
3. **Background sync**: Non-blocking sync operations
4. **Error handling**: Sync failures don't break the app
5. **Data merging**: Proper merge strategy for remote and local data
6. **Authentication integration**: Properly integrated with Supabase Auth
7. **Onboarding sync**: Onboarding status synced to Supabase
8. **Legacy data cleanup**: Clears old data when authenticated user signs in

## 🧪 Testing Checklist

After fixes:
- [ ] Test widget data provider with multiple users
- [ ] Verify all screens pass userId explicitly
- [ ] Test offline scenario - ensure data syncs when coming online
- [ ] Test multi-device sync - make change on one device, verify on another
- [ ] Test conflict resolution - make changes on both devices simultaneously
- [ ] Verify profile sync works correctly
- [ ] Verify logs/shifts sync correctly
- [ ] Verify export batches sync correctly

## 📝 Notes

- Most store methods correctly fall back to getting userId from authStore, which is good defensive programming
- However, explicitly passing userId is better for clarity and ensures it's always available when needed
- The widget data provider is a special case since it's called from native code - needs special handling
- All sync operations are non-blocking, which is excellent for UX
- The offline-first approach is well-implemented

