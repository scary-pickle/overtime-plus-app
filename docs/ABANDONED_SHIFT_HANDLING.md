# Abandoned Shift Handling - Current State & Recommendations

## Current Logic

### What Exists

1. **Stale Draft Detection (Date-based)**
   - Location: `app/(tabs)/home.tsx` lines 88-111
   - Logic: If an active shift draft is from a previous day (`activeDraft.date < today`), it automatically clears the `isActiveShift` flag
   - Result: Draft remains in database but is no longer marked as active
   - **Limitation**: Only checks date, not time elapsed

2. **Active Shift Prevention**
   - Location: `app/(tabs)/home.tsx` lines 201-208
   - Logic: Prevents starting a new shift if one is already active
   - Prevents multiple active shifts simultaneously

3. **Notifications (Roster-based)**
   - Location: `lib/notifications.ts`
   - Logic: Schedules notifications based on rostered finish times
   - **Limitation**: Not based on actual shift start time, only roster schedule

### What's Missing

1. **No 8-Hour Reminder**
   - No notification when a shift has been active for 8 hours
   - Users may forget to end their shift

2. **No Time-Based Cleanup**
   - No automatic deletion/reset after a certain time period
   - Abandoned drafts can accumulate indefinitely

3. **No Duration-Based Stale Detection**
   - Only checks if draft is from previous day
   - Doesn't check if shift has been active for too long (e.g., 24+ hours)

## Implementation Status: ✅ COMPLETED

### 1. 8-Hour Reminder Notification ✅

**Implementation:**
- ✅ Added `scheduleActiveShiftReminder()` method to `lib/notifications.ts`
- ✅ Schedules notification 8 hours after shift starts
- ✅ Notification: "You've been tracking a shift for 8 hours. Don't forget to end it!"
- ✅ Automatically cancels reminder when shift is ended
- ✅ Works for shifts started from home screen and widget

**Files Modified:**
- `lib/notifications.ts` - Added `scheduleActiveShiftReminder()` and `cancelActiveShiftReminder()` methods
- `app/(tabs)/home.tsx` - Schedules reminder in `proceedStartShift()`
- `app/widget/confirm.tsx` - Schedules reminder when starting from widget
- `components/QuickEndShiftModal.tsx` - Cancels reminder when shift ends

### 2. 24-Hour Automatic Cleanup ✅

**Implementation:**
- ✅ Added `getHoursElapsedSinceShiftStart()` helper function to `lib/time.ts`
- ✅ Enhanced `checkActiveShift()` in `home.tsx` to check time elapsed
- ✅ If shift has been active for 24+ hours, automatically marks as stale
- ✅ Clears `isActiveShift` flag and cancels any pending reminders
- ✅ Draft remains in database but is no longer active

**Files Modified:**
- `lib/time.ts` - Added `getHoursElapsedSinceShiftStart()` function
- `app/(tabs)/home.tsx` - Enhanced `checkActiveShift()` to check 24-hour threshold

### 3. Auto-Reset When New Shift Starts ✅

**Implementation:**
- ✅ Checks if a new shift is about to start based on roster
- ✅ If within 30 minutes of rostered start time, automatically resets abandoned shift
- ✅ Clears `isActiveShift` flag and cancels reminders
- ✅ Allows user to start fresh shift without manual cleanup

**Logic:**
- When checking active shift, also checks today's roster
- If roster exists and current time is within ±30 minutes of rostered start time
- Automatically marks old shift as stale and clears active flag
- User can then start new shift normally

**Files Modified:**
- `app/(tabs)/home.tsx` - Enhanced `checkActiveShift()` to check roster and auto-reset

### 4. Enhanced Stale Detection ✅

**Previous:** Only checked if `date < today`
**Current:** Checks both date AND time elapsed since shift started

**Implementation:**
- Checks if draft is from previous day (existing logic)
- Checks if shift has been active for 24+ hours (new)
- Checks if new shift is about to start (new)
- All checks clear active flag and cancel reminders

## How It Works

### When Shift Starts:
1. User presses "Start Shift" button
2. Draft log created with `isActiveShift: true`
3. 8-hour reminder notification scheduled automatically
4. Reminder will fire 8 hours after shift start time

### When Shift Ends:
1. User completes shift in `QuickEndShiftModal`
2. `isActiveShift` flag cleared
3. 8-hour reminder automatically cancelled
4. Shift marked as ready/exported

### When Shift is Abandoned:
1. Home screen checks active shift on load and every minute
2. If shift is from previous day → auto-clear
3. If shift has been active 24+ hours → auto-clear
4. If new shift is about to start (within 30 min of roster) → auto-clear
5. Draft remains in database but is no longer active
6. User can manually complete it later if needed

### When New Shift is About to Start:
1. System detects roster for today
2. Checks if current time is within ±30 minutes of rostered start
3. If yes, automatically clears any abandoned shift
4. User can start new shift normally
5. Old draft remains for 24 hours before being cleaned up (via existing cleanup logic)

## Benefits

1. **8-Hour Reminder:** Prevents users from forgetting to end shifts
2. **24-Hour Cleanup:** Prevents abandoned shifts from accumulating
3. **Auto-Reset:** Seamless experience when starting new shifts
4. **Data Preservation:** Drafts are kept (just marked inactive) so users can complete them later if needed

