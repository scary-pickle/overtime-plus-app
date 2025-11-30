# Notification Ideas & Recommendations

## ✅ Implemented Notifications

1. **Shift Start Reminder** - 15 min before rostered start
2. **Shift End Reminder** - At rostered finish time
3. **8-Hour Active Shift Reminder** - 8 hours after manual shift start
4. **Unexported Logs Reminder** - When 10+ logs ready, with back-off policy
5. **Unsubmitted AVAC Reminder** - 7 days after export
6. **Incomplete Draft Reminders** - Daily at 9am for drafts older than 3 days
7. **Weekly Summary** - Every Sunday at 8am

---

## 💡 Additional Notification Ideas

### High Priority (Recommended)

#### 1. **Incomplete Draft Reminders** ⭐
**Why:** Users might forget about incomplete drafts
- **Trigger:** Draft logs older than 3 days
- **Frequency:** Daily at 9am until completed
- **Message:** "You have {count} incomplete draft log(s) from {dates}. Complete them to export!"
- **Value:** Prevents lost work, encourages completion

#### 2. **Weekly Summary** 📊
**Why:** Help users track their progress
- **Trigger:** Every Sunday at 8am
- **Message:** "Weekly summary: {totalHours} hours logged, {pendingCount} logs pending export"
- **Value:** Encourages consistent logging, shows progress

#### 3. **Export Reminder (Before Deadline)** ⏰
**Why:** Remind users before submission deadlines
- **Trigger:** Configurable (e.g., 2 days before month end)
- **Message:** "Don't forget to export and submit your logs before the deadline!"
- **Value:** Prevents missed deadlines

### Medium Priority

#### 4. **Long-Running Draft Alert** ⚠️
**Why:** Alert for drafts that seem abandoned
- **Trigger:** Draft with missing critical fields for 7+ days
- **Frequency:** Once per week
- **Message:** "You have draft logs missing required information. Complete them to export!"
- **Value:** Helps users fix incomplete logs

#### 5. **Export Success Confirmation** ✅
**Why:** Confirm successful exports
- **Trigger:** Immediately after export
- **Message:** "AVAC form exported successfully! Don't forget to submit it."
- **Value:** Confirms action, reminds about submission

#### 6. **Monthly Export Reminder** 📅
**Why:** Monthly reminder to export
- **Trigger:** 1st of each month at 9am (if logs exist)
- **Message:** "New month! Export your logs from last month."
- **Value:** Encourages regular exports

### Low Priority (Nice to Have)

#### 7. **Shift Pattern Changes** 🔄
**Why:** Alert when shift schedule changes
- **Trigger:** When shifts are added/updated/deleted
- **Message:** "Your shift schedule has been updated. Review your notifications."
- **Value:** Keeps users informed

#### 8. **Data Sync Status** 🔄
**Why:** Alert if sync fails repeatedly
- **Trigger:** After 3 failed sync attempts
- **Message:** "Having trouble syncing your data. Check your connection."
- **Value:** Helps users troubleshoot

#### 9. **Profile Incomplete Reminder** 📝
**Why:** Remind users to complete profile
- **Trigger:** If profile incomplete for 7+ days
- **Frequency:** Weekly
- **Message:** "Complete your profile to enable all features!"
- **Value:** Ensures users can use full functionality

---

## Implementation Priority

### Phase 1 (Completed)
- ✅ Unsubmitted AVAC Reminder (7 days)

### Phase 2 (Completed)
- ✅ Incomplete Draft Reminders
- ✅ Weekly Summary

### Phase 3 (Future)
- Export Reminder (Before Deadline)
- Long-Running Draft Alert

---

## Notification Best Practices

1. **Don't Overwhelm:** Limit to 2-3 notifications per day max
2. **Actionable:** Every notification should have a clear action
3. **Timing:** Use quiet hours (don't send late at night)
4. **Grouping:** Group related notifications when possible
5. **Dismissible:** Allow users to dismiss/snooze
6. **Settings:** Let users customize which notifications they receive

