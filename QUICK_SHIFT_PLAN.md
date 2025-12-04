# Quick Add Shift Feature - Implementation Plan

## Overview
Create a simple, fast way to add shifts with minimal input. Users can either create quick one-off shifts or build shift patterns with different times for different days.

## User Flow

### 1. Entry Point - Shifts Screen Modal
- **Location**: Blue `+` button in shifts screen (`app/(tabs)/shifts.tsx`)
- **Current Behavior**: Directly navigates to `/shifts/new`
- **New Behavior**: Opens a modal (similar to logs screen) with two options:
  - **"Create Shift Pattern"** → Navigate to existing `/shifts/new` screen
  - **"Quick Shift"** → Open new Quick Shift modal

### 2. Quick Shift Modal Structure

#### Top Section: Template Shifts
- Display saved shift templates (from `useShiftTemplatesStore`)
- Horizontal scrollable list of template pills
- Each template shows: label + time (e.g., "Day Shift · 07:00 - 15:00")
- When tapped:
  - Pre-fills start/finish times
  - User still needs to select date
  - Assumes 30 minute meal break

#### Main Input Section
- **Date Picker**: Calendar picker component (reuse `CalendarPicker`)
- **Start Time**: Time input (reuse `TimeInput` component)
- **Finish Time**: Time input (reuse `TimeInput` component)
- **Repeat?** Pill Button:
  - Default: "Never" (no repeat)
  - When tapped: Opens small picker with options:
    - Never (default)
    - Weekly
    - Biweekly
  - Visual indicator when repeat is enabled

#### Added Shifts Section (Bottom)
- Shows list of shifts that have been added in this session
- Each shift shows:
  - Date (formatted nicely)
  - Time range (e.g., "07:00 - 15:00")
  - Repeat status if applicable
  - Remove button (X icon)
- Only visible when at least one shift has been added

#### Action Buttons
- **"Add Shift"**: Adds current shift to the list, clears form (keeps date), ready for next
- **"Save"**: Saves all added shifts and closes modal
- **"Add Another Shift"**: After adding, shows option to add more or save

## Data Structure

### Quick Shift Entry (temporary, in-memory)
```typescript
type QuickShiftEntry = {
  id: string; // temporary ID for list management
  date: string; // ISO date
  startTime: string; // "HH:mm"
  finishTime: string; // "HH:mm"
  mealBreakMinutes: number; // default 30
  repeatType: 'never' | 'weekly' | 'biweekly';
};
```

### Conversion to UsualShift
When saving, convert each `QuickShiftEntry` to `UsualShift`:
- For "never": `type: 'custom'`, `activeFrom: date`, `activeTo: date`
- For "weekly": `type: 'weekly'`, `dayOfWeek: date.getDay()`, `activeFrom: date`
- For "biweekly": `type: 'biweekly'`, `dayOfWeek: date.getDay()`, `weekIndex: 1 or 2`, `activeFrom: date`

## Implementation Details

### Files to Create/Modify

1. **`app/(tabs)/shifts.tsx`**
   - Modify `handleAddShift()` to open modal instead of direct navigation
   - Add modal state and animation (similar to logs screen)
   - Add two menu options

2. **`app/shifts/quick-add.tsx`** (NEW)
   - New screen/modal for quick shift creation
   - Template selection at top
   - Date/time inputs
   - Repeat selector
   - Added shifts list
   - Save functionality

3. **Components** (reuse existing):
   - `CalendarPicker` - for date selection
   - `TimeInput` - for time inputs
   - `SharedTimePickerProvider` - for time picker context

### State Management
- Use local component state for:
  - Selected template
  - Current form inputs (date, start, finish)
  - Repeat type
  - List of added shifts
- Use stores:
  - `useShiftTemplatesStore` - for templates
  - `useShiftsStore` - for saving shifts
  - `useAuthStore` - for user ID

### Validation
- Date must be selected
- Start time must be provided
- Finish time must be provided
- Finish time should be after start time (or next day for overnight shifts)
- At least one shift must be added before saving

### UI/UX Considerations
- Modal should be dismissible by tapping outside
- Smooth animations (match logs screen modal style)
- Dark mode support
- Keyboard handling for time inputs
- Clear visual feedback when shift is added
- Show count of added shifts in button text

## Edge Cases
1. **Overnight shifts**: Finish time before start time = next day (already handled in time utils)
2. **Template selection**: If user changes times after selecting template, clear template selection
3. **Repeat logic**: For biweekly, need to determine week 1 vs week 2 based on date
4. **Date validation**: Prevent selecting past dates? (or allow for historical shifts)
5. **Empty templates**: If no templates exist, hide template section or show helpful message

## Future Enhancements (Not in Initial Implementation)
- Save quick shift as template
- Bulk date selection
- Copy shift to multiple dates
- Undo last added shift

## Questions to Clarify
1. Should we allow selecting past dates for quick shifts?
2. For biweekly repeats, should we auto-determine week 1/2 or ask user?
3. Should quick shifts have labels, or auto-generate from date/time?
4. Should there be a limit on how many shifts can be added in one session?

