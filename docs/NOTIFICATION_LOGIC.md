# Notification Logic Overview

This document provides a comprehensive overview of all notification logic in the Overtime+ app, including what triggers notifications, when they're sent, and how they're managed.

## Notification Types

### 1. **8-Hour Active Shift Reminder** ✅ ACTIVE
**Type:** `active_shift_8hr_reminder`

**When Triggered:**
- Automatically scheduled when a user starts a new shift
- Scheduled 8 hours after the shift start time

**Notification Content:**
- **Title:** "Shift Reminder"
- **Body:** "You've been tracking a shift for 8 hours. Don't forget to end it!"

**Trigger Locations:**
1. `app/(tabs)/home.tsx` - Line 326
   - Called in `proceedStartShift()` when user clicks "Start Shift" button
2. `app/widget/confirm.tsx` - Line 128
   - Called in `handleStartShift()` when user starts shift from widget

**Cancellation:**
- Automatically cancelled when shift is ended (in `QuickEndShiftModal.tsx` - Line 245)
- Cancelled when active shift is reset (in `home.tsx` - Line 270)
- Cancelled when stale/abandoned shifts are detected (in `home.tsx` - Lines 100, 110, 133)
- **NEW:** All existing reminders are cancelled before scheduling a new one (prevents old notifications from firing)

**Implementation Details:**
- Notification ID format: `active_shift_reminder_{shiftId}`
- Only schedules if reminder time is in the future
- Uses channel: `overtime-reminders`
- Priority: HIGH
- Sound: Enabled

---

### 2. **Rostered Shift End Reminder** ⚠️ DEFINED BUT NOT ACTIVELY USED
**Type:** `shift_end_reminder`

**When Triggered:**
- Would be scheduled for rostered shift finish times
- Schedules notifications for the next 7 days based on user's usual shifts

**Notification Content:**
- **Title:** "Shift Ending Soon"
- **Body:** "Your rostered shift ends at {rosteredFinish}. Tap to end shift now."

**Method:** `scheduleRolling7Days(usualShifts: UsualShift[])`
- **Location:** `lib/notifications.ts` - Line 75
- **Status:** ⚠️ **NOT CURRENTLY CALLED** - Method exists but no code calls it

**Implementation Details:**
- Notification ID format: `overtime_{date}`
- Schedules for next 7 days
- Uses `reminderMinutes` setting (default: 0 = at rostered finish time)
- Uses channel: `overtime-reminders`
- Priority: HIGH
- Sound: Enabled

**To Activate:**
- Would need to call `notificationManager.scheduleRolling7Days(shifts)` when:
  - User adds/updates shifts
  - App initializes
  - Shifts are loaded

---

### 3. **Snooze Notification** ⚠️ DEFINED BUT NOT ACTIVELY USED
**Type:** `shift_end_snooze`

**When Triggered:**
- Would be scheduled when user snoozes a shift end reminder
- Reschedules notification for a later time (default: 10 minutes)

**Notification Content:**
- **Title:** "Shift Ending Soon (Snoozed)"
- **Body:** "Your shift reminder (snoozed for {snoozeMinutes} min). Tap to end shift now."

**Method:** `scheduleSnooze(originalDate: string, snoozeMinutes?: number)`
- **Location:** `lib/notifications.ts` - Line 135
- **Status:** ⚠️ **NOT CURRENTLY CALLED** - Method exists but no code calls it

**Implementation Details:**
- Notification ID format: `overtime_snooze_{timestamp}`
- Default snooze: 10 minutes (configurable via `snoozeMinutes` setting)
- Uses channel: `overtime-reminders`
- Priority: HIGH
- Sound: Enabled

**To Activate:**
- Would need to call `notificationManager.scheduleSnooze(date, minutes)` when:
  - User taps "Snooze" on a notification
  - Notification response handler processes snooze action

---

## Notification Settings

**Location:** `lib/notifications.ts` - Lines 21-31

```typescript
interface NotificationSettings {
  enabled: boolean;           // Master toggle (default: true)
  reminderMinutes: number;     // Minutes before rostered finish (default: 0)
  snoozeMinutes: number;       // Default snooze duration (default: 10)
}
```

**Current Defaults:**
- `enabled: true`
- `reminderMinutes: 0` (at rostered finish time)
- `snoozeMinutes: 10`

**Update Method:**
- `notificationManager.updateSettings(settings)` - Line 314

---

## Notification Cancellation Methods

### 1. `cancelActiveShiftReminder(shiftId: string)`
- Cancels a specific 8-hour reminder for a shift
- **Called from:**
  - `home.tsx` - Lines 100, 110, 133, 270 (stale shift cleanup, reset)
  - `QuickEndShiftModal.tsx` - Line 245 (when shift ends)

### 2. `cancelAllActiveShiftReminders()` ⭐ NEW
- Cancels ALL active shift reminder notifications
- **Called from:**
  - `scheduleActiveShiftReminder()` - Line 215 (before scheduling new reminder)
- **Purpose:** Prevents old notifications from firing when starting a new shift

### 3. `cancelNotificationsForDate(date: string)`
- Cancels rostered shift end reminder for a specific date
- **Status:** ⚠️ **NOT CURRENTLY CALLED** (would be used with rostered reminders)

### 4. `cancelAllNotifications()`
- Cancels all overtime notifications (rostered reminders and snoozes)
- **Called from:**
  - `scheduleRolling7Days()` - Line 78 (before scheduling new batch)
- **Status:** ⚠️ Only called by unused `scheduleRolling7Days()` method

---

## Notification Handler

**Location:** `lib/notifications.ts` - Lines 344-351

**Method:** `handleNotificationResponse(response: Notifications.NotificationResponse)`

**Current Implementation:**
- Only logs notification taps for `shift_end_reminder` and `shift_end_snooze` types
- Does not handle `active_shift_8hr_reminder` type
- **Status:** Basic implementation - could be enhanced to navigate to app screens

**Exported Handler:**
- `handleNotificationResponse()` - Line 358
- Should be registered in app root layout to handle notification taps

---

## Notification Permissions

**Location:** `lib/notifications.ts` - Lines 39-70

**Method:** `requestPermissions()`

**Called From:**
- `app/_layout.tsx` - Line 119 (on app initialization)

**Behavior:**
- Requests notification permissions on app start
- Configures Android notification channel (`overtime-reminders`)
- Returns `true` if permissions granted, `false` otherwise

---

## Notification Configuration

**Location:** `lib/notifications.ts` - Lines 11-19

**Global Settings:**
- `shouldShowAlert: true`
- `shouldPlaySound: true`
- `shouldSetBadge: false`
- `shouldShowBanner: true`
- `shouldShowList: true`

**Android Channel:**
- Name: "Overtime Reminders"
- Description: "Notifications for shift end times"
- Importance: HIGH
- Vibration: [0, 250, 250, 250]
- Light Color: #FF231F7C

---

## Summary of Active vs Unused Features

### ✅ **ACTIVELY USED:**
1. **8-Hour Active Shift Reminder** - Fully implemented and working
   - Scheduled when shift starts
   - Cancelled when shift ends or is reset
   - Prevents duplicate notifications

### ⚠️ **DEFINED BUT NOT USED:**
1. **Rostered Shift End Reminders** - Method exists but never called
2. **Snooze Functionality** - Method exists but never called
3. **Date-specific Cancellation** - Method exists but never called

---

## Recommendations for Enhancement

### 1. **Activate Rostered Shift Reminders**
- Call `scheduleRolling7Days()` when:
  - User adds/updates shifts in `shiftsStore.ts`
  - App initializes and loads shifts
  - User's shift schedule changes

### 2. **Implement Notification Tap Handling**
- Enhance `handleNotificationResponse()` to:
  - Navigate to home screen for `active_shift_8hr_reminder`
  - Navigate to end shift flow for `shift_end_reminder`
  - Handle snooze action for `shift_end_snooze`

### 3. **Add Notification Settings UI**
- Allow users to:
  - Toggle notifications on/off
  - Adjust reminder minutes before rostered finish
  - Change default snooze duration
  - View scheduled notifications

### 4. **Add More Notification Types** (Potential)
- Shift start reminders (X minutes before rostered start)
- Daily summary notifications
- Export completion notifications
- Data sync status notifications

---

## Files Involved

### Core Notification Logic:
- `lib/notifications.ts` - Main notification manager class

### Where Notifications Are Scheduled:
- `app/(tabs)/home.tsx` - 8-hour reminder on shift start
- `app/widget/confirm.tsx` - 8-hour reminder from widget

### Where Notifications Are Cancelled:
- `app/(tabs)/home.tsx` - Stale shift cleanup, reset active shift
- `components/QuickEndShiftModal.tsx` - When shift ends

### App Initialization:
- `app/_layout.tsx` - Permission requests

---

## Testing Checklist

- [ ] 8-hour reminder fires 8 hours after shift start
- [ ] 8-hour reminder cancelled when shift ends
- [ ] 8-hour reminder cancelled when shift is reset
- [ ] No duplicate notifications when starting new shift
- [ ] Old reminders don't fire when starting new shift
- [ ] Notifications work when app is in background
- [ ] Notifications work when app is closed
- [ ] Notification tap handling works (if implemented)

