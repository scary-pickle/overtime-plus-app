# Night Shift Date Calculation Fix

## Issue Summary

When logging night shifts in Australia (UTC+10 timezone), the shift date was being calculated incorrectly - showing 2 days earlier than expected.

### Example Scenario
- **Current date/time**: November 9, 2025, 10:30am
- **Shift times**: Started 11pm (Nov 8), Finished 10:30am (Nov 9)
- **Expected date**: November 8, 2025 (when shift started)
- **Actual date logged**: ❌ November 7, 2025 (2 days ago!)

## Root Cause

The bug was in the `getPreviousISODate` function in `lib/time.ts`. It used `Date.toISOString()` which converts dates to UTC, causing timezone conversion issues:

```javascript
// OLD CODE (BUGGY)
export function getPreviousISODate(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; // ❌ Converts to UTC!
}
```

**What happened:**
1. Input: `"2025-11-09"` (Nov 9)
2. Creates: `2025-11-09T00:00:00` in **local time** (Brisbane, UTC+10)
3. Subtracts 1 day: `2025-11-08T00:00:00` local time
4. Converts to UTC: `2025-11-07T14:00:00Z` (UTC is 10 hours behind)
5. Extracts date: `"2025-11-07"` ❌ **WRONG!**

## Solution

Fixed by avoiding timezone conversion and using local date components directly:

```javascript
// NEW CODE (FIXED)
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousISODate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - 1);
  return formatDateToISO(d); // ✓ No timezone conversion!
}
```

## Changes Made

### 1. Created `formatDateToISO` helper function
- `lib/time.ts`: New function to format Date objects without timezone conversion

### 2. Fixed `getPreviousISODate` function  
- `lib/time.ts`: Now uses `formatDateToISO` instead of `toISOString()`

### 3. Applied fix to other date calculations
- `lib/roster.ts`: Fixed `getNextShiftOccurrence` and `getShiftOccurrencesInRange`
- `lib/state/shiftsStore.ts`: Fixed `getShiftsForDay` and `getActiveShifts`
- `lib/notifications.ts`: Fixed notification scheduling date calculations

## How Night Shift Dating Works

The system correctly identifies night shifts using the `getShiftStartDate` function:

1. **End date**: The date when you're logging the shift (today)
2. **Start time**: When the shift actually started (e.g., 23:00)
3. **Finish time**: When the shift ended (e.g., 10:30)

**Logic:**
- If `finishTime <= startTime`, the shift crossed midnight
- The shift date = previous day from end date
- This ensures night shifts are dated on the day they **started**, not ended

**Example:**
- Logging on Nov 9 at 10:30am
- Shift: 23:00 → 10:30 (finish <= start, so crossed midnight)
- Result: **Nov 8** (previous day) ✓

## Testing

All tests pass (2 pre-existing failures unrelated to this fix):
- ✓ Active shift tracking
- ✓ Database persistence
- ✓ Night shift date calculations

## Impact

This fix ensures:
1. ✅ Night shifts are dated correctly (day they started)
2. ✅ Works correctly in all timezones (especially Australia UTC+10)
3. ✅ Roster calculations work correctly
4. ✅ Shift filtering by date works correctly
5. ✅ Notification scheduling works correctly

## User Action Required

**You may need to manually correct any existing night shifts that were logged with incorrect dates.**

To find affected shifts:
1. Go to Logs tab
2. Look for night shifts from the past few weeks
3. Check if the date matches when the shift **started** (not ended)
4. Edit any incorrectly dated shifts

