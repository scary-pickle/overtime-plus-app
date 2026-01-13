# Notification System Improvements

## Priority Ranking

### 🔥 **Priority 1: High Value, Low Effort** (Implement First)

#### 1. **Notification Tap Handling** ⭐ CRITICAL
**Why:** Users tap notifications expecting to be taken to the relevant screen. Currently, taps are only logged.

**Implementation:**
- Enhance `handleNotificationResponse()` to navigate based on notification type
- Register notification listener in `app/_layout.tsx`
- Handle deep linking for each notification type

**Benefits:**
- Better UX - users can quickly access relevant screens
- Reduces friction in workflow
- Makes notifications actionable

**Effort:** Low (2-3 hours)

---

#### 2. **Activate Rostered Shift End Reminders** ⭐ HIGH VALUE
**Why:** This feature is already built but unused. Users should be reminded when their rostered shift ends.

**Implementation:**
- Call `scheduleRolling7Days()` when:
  - Shifts are loaded on app init
  - User adds/updates/deletes shifts
  - User's shift schedule changes

**Benefits:**
- Proactive reminders at shift end time
- Helps users remember to end shifts on time
- Reduces forgotten shifts

**Effort:** Medium (4-6 hours)

---

### ⚡ **Priority 2: Medium Value, Medium Effort**

#### 3. **Shift Start Reminders** 🆕 NEW FEATURE
**Why:** Users might forget to start tracking their shift. Remind them X minutes before rostered start.

**Implementation:**
- Add `scheduleShiftStartReminder()` method
- Schedule for each rostered shift start time
- Configurable reminder time (e.g., 15 minutes before)
- Cancel when shift is actually started

**Benefits:**
- Prevents missed shift tracking
- Helps users start shifts on time
- Complements end reminders

**Effort:** Medium (4-5 hours)

---

#### 4. **Notification Settings UI** 🎛️
**Why:** Users should control their notification preferences.

**Implementation:**
- Add settings section in Profile screen
- Toggle notifications on/off
- Adjust reminder minutes before rostered finish
- Change default snooze duration
- View scheduled notifications list

**Benefits:**
- User control and customization
- Better user experience
- Reduces notification fatigue

**Effort:** Medium-High (6-8 hours)

---

#### 5. **Snooze Functionality** 🔄
**Why:** Users sometimes need to delay reminders. The method exists but isn't connected.

**Implementation:**
- Add notification actions (Snooze button)
- Connect to existing `scheduleSnooze()` method
- Handle snooze in notification response handler
- Show snooze duration in notification

**Benefits:**
- Flexibility for users
- Reduces notification dismissal
- Better user control

**Effort:** Medium (3-4 hours)

---

### 💡 **Priority 3: Nice to Have**

#### 6. **Smart Notification Cancellation**
**Why:** Automatically cancel notifications when they're no longer relevant.

**Implementation:**
- Cancel rostered reminders when shift is already logged
- Cancel start reminders when shift is already started
- Cancel end reminders when shift is already ended
- Smart cleanup on app launch

**Benefits:**
- Cleaner notification queue
- No irrelevant notifications
- Better user experience

**Effort:** Low-Medium (2-3 hours)

---

#### 7. **Notification History/Logging**
**Why:** Help debug notification issues and understand user behavior.

**Implementation:**
- Log when notifications are scheduled/cancelled
- Store notification history (optional, for debugging)
- Add debug view to see scheduled notifications

**Benefits:**
- Easier debugging
- Better understanding of notification behavior
- Helps identify issues

**Effort:** Low (1-2 hours)

---

#### 8. **Daily Summary Notifications** 📊
**Why:** Help users track their weekly progress.

**Implementation:**
- Send daily summary at end of day
- Show total hours logged today
- Show pending logs count
- Optional: weekly summary

**Benefits:**
- Encourages consistent logging
- Helps users track progress
- Increases engagement

**Effort:** Medium (4-5 hours)

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)
1. ✅ Notification Tap Handling
2. ✅ Smart Notification Cancellation

### Phase 2: Core Features (Week 2)
3. ✅ Activate Rostered Shift End Reminders
4. ✅ Shift Start Reminders

### Phase 3: User Control (Week 3)
5. ✅ Notification Settings UI
6. ✅ Snooze Functionality

### Phase 4: Enhancements (Week 4+)
7. ✅ Notification History/Logging
8. ✅ Daily Summary Notifications

---

## Implementation Details

### 1. Notification Tap Handling

**Files to Modify:**
- `lib/notifications.ts` - Enhance `handleNotificationResponse()`
- `app/_layout.tsx` - Register notification listener

**Code Changes:**
```typescript
// In lib/notifications.ts
handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const { data } = response.notification.request.content;
  const router = require('expo-router').useRouter();
  
  switch (data?.type) {
    case 'active_shift_8hr_reminder':
      // Navigate to home screen (where user can end shift)
      router.push('/(tabs)/home');
      break;
      
    case 'shift_end_reminder':
    case 'shift_end_snooze':
      // Navigate to home screen to end shift
      router.push('/(tabs)/home');
      break;
      
    case 'shift_start_reminder':
      // Navigate to home screen to start shift
      router.push('/(tabs)/home');
      break;
  }
}

// In app/_layout.tsx
useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener(
  handleNotificationResponse
);
  
  return () => subscription.remove();
}, []);
```

---

### 2. Activate Rostered Shift End Reminders

**Files to Modify:**
- `lib/state/shiftsStore.ts` - Call `scheduleRolling7Days()` after shift operations
- `app/_layout.tsx` - Call after shifts are loaded

**Code Changes:**
```typescript
// In shiftsStore.ts - after addShift, updateShift, deleteShift
await notificationManager.scheduleRolling7Days(get().shifts);

// In app/_layout.tsx - after loadShifts
const { shifts } = useShiftsStore.getState();
await notificationManager.scheduleRolling7Days(shifts);
```

---

### 3. Shift Start Reminders

**New Method in `lib/notifications.ts`:**
```typescript
async scheduleShiftStartReminder(
  shiftId: string,
  shiftDate: string,
  rosteredStart: string,
  reminderMinutes: number = 15
): Promise<void> {
  // Schedule notification X minutes before rostered start
  // Similar to scheduleActiveShiftReminder but for start time
}
```

**Integration:**
- Call when scheduling rostered reminders
- Cancel when shift is actually started
- Include in `scheduleRolling7Days()` logic

---

### 4. Notification Settings UI

**New File:** `app/notification-settings.tsx`

**Features:**
- Toggle master switch
- Reminder minutes slider (0-60 minutes)
- Snooze duration picker (5, 10, 15, 30 minutes)
- View scheduled notifications list
- Test notification button

**Storage:**
- Use AsyncStorage or SQLite to persist settings
- Update `notificationManager.settings` when changed

---

## Testing Checklist

For each implemented feature:

- [ ] Notification fires at correct time
- [ ] Notification content is accurate
- [ ] Notification tap navigates correctly
- [ ] Notification is cancelled when appropriate
- [ ] Works when app is in background
- [ ] Works when app is closed
- [ ] Works across timezone changes
- [ ] Handles edge cases (no shifts, no roster, etc.)

---

## Metrics to Track

- Notification delivery rate
- Notification tap rate
- Time from notification to action
- User notification preferences
- Notification-related errors

---

## Future Considerations

1. **Rich Notifications** - Add action buttons directly in notifications
2. **Notification Grouping** - Group related notifications
3. **Quiet Hours** - Don't send notifications during sleep hours
4. **Custom Sounds** - Different sounds for different notification types
5. **Notification Analytics** - Track which notifications are most effective







