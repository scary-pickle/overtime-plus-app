# Overtime+ Feature Roadmap

> **Note**: This roadmap is for the MVP/local-first version. Backend integration and user authentication will be added after these features are complete.

---

## 📋 Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Complete
- 🚫 Blocked/Deferred

---

## 🎯 Phase 1: Smart Features & Automation

### Auto-Complete Suggestions
- [ ] ⬜ **Recent Comments Auto-Fill**: Remember last 5 comments and offer as quick-select options
- [ ] ⬜ **Smart Category Detection**: Suggest category based on time patterns (after hours → Recall/Oncall)
- [ ] ⬜ **Auto-Calculate Meal Breaks**: Suggest meal break based on shift length (30min for 6+ hour shifts)

### Quick Actions & Templates
- [ ] ⬜ **Favorite Shift Templates**: Save common overtime scenarios as templates (e.g., "Weekend ED Call")
- [ ] ⬜ **One-Tap Logging**: "Quick Log Last Shift" button that duplicates yesterday's overtime
- [ ] ⬜ **Bulk Actions**: Select multiple draft logs and mark them all as ready at once
- [ ] ⬜ **Duplicate Log Feature**: Quick duplicate button for similar shifts (🌟 **Priority**)

---

## 🎨 Phase 2: User Experience Enhancements

### Visual Improvements
- [ ] ⬜ **Progress Indicators**: Show profile completion status (e.g., "4/6 sections complete")
- [x] ✅ **Visual Calendar View**: Monthly calendar showing days with shifts (color-coded by status) (🌟 **Priority**)
- [ ] ⬜ **Charts & Analytics Dashboard**: (🌟 **Priority**)
  - [ ] ⬜ Weekly/monthly overtime trends (line chart)
  - [ ] ⬜ Breakdown by category (pie chart)
  - [ ] ⬜ Comparison to previous periods
  - [ ] ⬜ "You've logged X hours this fortnight" summary card
- [ ] ⬜ **Empty State Illustrations**: Add friendly illustrations to empty states

### Navigation & Flow
- [ ] ⬜ **Bottom Sheet Quick Add**: Swipe up to quickly add log without leaving screen
- [ ] ⬜ **Contextual Help**: Add "?" tooltips explaining fields for new users
- [ ] ⬜ **Undo Actions**: Toast notification with undo after deleting/marking items (🌟 **Priority**)
- [ ] ⬜ **Search & Filter**: (🌟 **Priority**)
  - [ ] ⬜ Search logs by comments/date/category
  - [ ] ⬜ Filter by date range
  - [ ] ⬜ Filter by category
  - [ ] ⬜ Filter by overtime amount (e.g., ">2 hours")
- [ ] ⬜ **Swipe Gestures**: Swipe right to mark ready, swipe left to delete (🌟 **Priority**)
- [ ] ⬜ **Long-Press Menus**: Long-press on log for quick actions

---

## 🔔 Phase 3: Smart Notifications & Reminders

### Intelligent Reminders
- [ ] ⬜ **End of Week Summary**: "You have 3 draft logs from this week - review and submit?" (🌟 **Priority**)
- [ ] ⬜ **Submission Deadlines**: Customizable deadline reminders (e.g., "Forms due on 15th")
- [ ] ⬜ **Stale Draft Alerts**: "You have a draft from 3 days ago - review it?"
- [ ] ⬜ **Shift Pattern Reminders**: "You usually work Thursday nights - overtime today?"

### Notification Customization
- [ ] ⬜ **Quiet Hours**: Don't send notifications during sleep hours
- [ ] ⬜ **Custom Reminder Times**: Choose when to get weekly review reminders
- [ ] ⬜ **Notification Preferences**: Granular control over notification types

---

## ⌨️ Phase 4: Data Entry Simplification

### Smart Time Entry
- [ ] ⬜ **Round Time Buttons**: Quick buttons to round to nearest 15/30 minutes (🌟 **Priority**)
- [ ] ⬜ **Time Presets**: "Started Early (7:30 AM)", "Stayed Late (6:00 PM)" buttons
- [ ] ⬜ **Voice Input for Comments**: Voice-to-text for comments field
- [ ] ⬜ **Time Duration Input**: Option to enter "worked 2h 30min" instead of start/end times
- [ ] ⬜ **Time Picker Improvements**: Better time picker UX (consider iOS native picker)

### Copy Previous Log
- [ ] ⬜ **"Same as Yesterday"**: Auto-fill with previous day's shift times
- [ ] ⬜ **Copy From Template**: Quick-select from saved templates

---

## 📄 Phase 5: Export & Submission Features

### Enhanced PDF Features
- [ ] ⬜ **PDF Thumbnail Preview**: Show thumbnail in exports list
- [ ] ⬜ **Batch Naming Suggestions**: Auto-suggest names like "January 2025 Overtime"
- [ ] ⬜ **Multiple Export Formats**: Export as Excel/CSV for personal records
- [ ] ⬜ **Watermark Draft PDFs**: Visual indicator to prevent accidental submission
- [ ] ⬜ **PDF Compression**: Reduce file sizes for easier sharing

### Submission Tracking
- [ ] ⬜ **Submission History Timeline**: Visual timeline of submissions
- [ ] ⬜ **Multiple Email Recipients**: Save primary and backup delegates
- [ ] ⬜ **Pre-Submission Checklist**: "Have you reviewed all logs?" before sending
- [ ] ⬜ **Follow-up Reminders**: "Submitted 7 days ago - has it been processed?"
- [ ] ⬜ **Submission Notes**: Add notes to each submission (e.g., "Discussed with delegate")

---

## 👤 Phase 6: Profile & Settings Enhancements

### Simplified Onboarding
- [ ] ⬜ **Setup Wizard**: Step-by-step guided setup for first-time users
- [ ] ⬜ **Profile Import/Export**: QR code to share profile template with colleagues
- [ ] ⬜ **Profile Presets**: Common hospital/department combinations pre-filled
- [ ] ⬜ **Delegate Directory**: Searchable list of delegates by department

### Smart Defaults
- [ ] ⬜ **Remember Last Category**: Default to most frequently used category (🌟 **Priority**)
- [ ] ⬜ **Default Meal Break by Shift**: Different defaults for day/night shifts
- [ ] ⬜ **Auto-Fill from Previous**: Remember last used cost center, comments
- [ ] ⬜ **Settings Import/Export**: Backup and restore settings

---

## ✅ Phase 7: Validation & Error Prevention

### Smart Validation
- [ ] ⬜ **Overlapping Shifts Warning**: "You already logged overtime on this date"
- [ ] ⬜ **Unrealistic Hours Alert**: "16-hour shift detected - is this correct?"
- [ ] ⬜ **Weekend/Holiday Detection**: Suggest "Recall" for public holidays
- [ ] ⬜ **Missing Information Highlights**: Visual indicators for incomplete drafts

### Pre-Submission Checks
- [ ] ⬜ **Final Review Screen**: Summary of all logs before export with warnings
- [ ] ⬜ **Calculation Verification**: Show detailed breakdown of overtime calculation
- [ ] ⬜ **Duplicate Detection**: Warn if similar log already exists

---

## 🤝 Phase 8: Collaboration Features (Offline)

### Share & Template Features
- [ ] ⬜ **Share Templates**: Export/import shift templates via QR/file
- [ ] ⬜ **Export Settings**: Share app configuration with colleagues
- [ ] ⬜ **Common Patterns Library**: Pre-built templates for common scenarios

---

## 💾 Phase 9: Data Management & Backup

### Local Data Management
- [ ] ⬜ **Archive Old Logs**: Auto-archive logs older than 12 months
- [ ] ⬜ **Export All Data**: Export complete data as JSON/CSV for backup
- [ ] ⬜ **Smart Cleanup**: "Delete all exported logs older than 90 days?"
- [ ] ⬜ **Storage Usage Indicator**: Show PDF storage usage with cleanup options
- [ ] ⬜ **Data Import**: Import logs from CSV/Excel
- [ ] ⬜ **Backup Reminders**: Remind users to backup their data monthly

### Data Insights
- [ ] ⬜ **Export Counter**: "You've exported 12 AVAC forms this year"
- [ ] ⬜ **Lifetime Statistics**: Total overtime logged since installation
- [ ] ⬜ **Export Data Dashboard**: Visual summary of all exports

---

## ♿ Phase 10: Accessibility & Usability

### For All Users
- [ ] ⬜ **Dark Mode Polish**: Ensure all screens have consistent dark mode
- [ ] ⬜ **Font Size Options**: Adjustable text size for readability
- [ ] ⬜ **Color-Blind Friendly**: Status indicators use both color and icons/patterns
- [ ] ⬜ **Haptic Feedback**: Subtle vibrations for confirmations
- [ ] ⬜ **VoiceOver/TalkBack**: Screen reader support
- [ ] ⬜ **High Contrast Mode**: Option for better visibility

### Performance & Polish
- [ ] ⬜ **Loading States**: Skeleton screens instead of blank pages
- [ ] ⬜ **Offline Indicator**: Clear indicator when offline (with reassurance)
- [ ] ⬜ **Confirmation Toasts**: Feedback for all actions ("Log saved", "Marked as ready")
- [ ] ⬜ **Animation Polish**: Smooth transitions between screens
- [ ] ⬜ **Pull to Refresh**: Add pull-to-refresh on all list screens

---

## 🐛 Known Issues to Fix

### Critical
- [ ] ⬜ **Auto Profile Refresh**: Remove manual refresh buttons, make automatic
- [ ] ⬜ **Sync Issues**: Investigate profile sync/load issues on home screen

### Medium Priority
- [ ] ⬜ **Simplify Re-export UX**: The current flow is complex with multiple steps
- [ ] ⬜ **No Data Loss Warning**: Warn users that data is local-only (pre-backend)
- [ ] ⬜ **Better Error Messages**: More helpful error messages throughout app

### Nice to Have
- [ ] ⬜ **Improved Time Entry**: Typing times is slow - add presets/shortcuts
- [ ] ⬜ **Batch Operations**: More bulk actions across the app
- [ ] ⬜ **Better Empty States**: More helpful CTAs and illustrations

---

## 🎯 Quick Wins (Implement First for Maximum Impact)

These features provide the most value for the least effort:

1. ✅ **Visual Calendar View** - Makes patterns visible at a glance (**COMPLETE**)
2. [ ] ⬜ **Duplicate Log Feature** - Massive time-saver for repetitive work
3. [ ] ⬜ **Weekly Summary Notification** - Catches forgotten drafts
4. [ ] ⬜ **Time Rounding Buttons** - Speeds up data entry significantly
5. [ ] ⬜ **Swipe Gestures on Cards** - Modern, intuitive interaction
6. [ ] ⬜ **Smart Comment Suggestions** - Saves typing time
7. [ ] ⬜ **Monthly Analytics Dashboard** - Visual insights into patterns
8. [ ] ⬜ **Undo Actions** - Prevents accidental deletion anxiety
9. [ ] ⬜ **Search/Filter Logs** - Essential as data grows
10. [ ] ⬜ **Remember Last Category** - Smart default selection

---

## 🚀 Phase 11: Backend Integration (Future)

> **Note**: These features will be implemented after the local MVP is complete

- [ ] 🚫 **User Authentication**: Sign up, login, password reset
- [ ] 🚫 **Cloud Backup**: Automatic sync to Supabase
- [ ] 🚫 **Multi-Device Sync**: Real-time sync across devices
- [ ] 🚫 **Team Features**: Share with colleagues, team statistics
- [ ] 🚫 **Admin Dashboard**: View organization-wide overtime patterns
- [ ] 🚫 **Delegate Portal**: Allow delegates to review submissions
- [ ] 🚫 **Email Integration**: Direct submission to delegates via backend
- [ ] 🚫 **Audit Trail**: Track all changes to logs
- [ ] 🚫 **Role-Based Access**: Different permissions for users/admins

---

## 📊 Progress Tracking

### Current Sprint Focus
- Next feature TBD (see Quick Wins section)

### Recently Completed
- ✅ Visual Calendar View (Shifts Screen) - October 30, 2025
- ✅ Quick Shift Tracking (Start/End Shift)
- ✅ SMO Support (Different AVAC template)
- ✅ Email Export with Templates
- ✅ Re-export Functionality
- ✅ Stale Draft Detection

### Next Up
- Duplicate log feature
- Search and filter functionality
- Time rounding buttons

---

## 📝 Notes

- All features should maintain offline-first functionality
- Prioritize simplicity and ease of use
- Test thoroughly before marking as complete
- Consider user feedback for feature prioritization
- Keep accessibility in mind for all new features

---

**Last Updated**: October 30, 2025
**Current Version**: v1.0-MVP
**Target Version**: v2.0 (before backend integration)

