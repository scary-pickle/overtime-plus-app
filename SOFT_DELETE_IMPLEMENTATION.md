# Soft Delete Implementation

## Overview

This document describes the implementation of a soft delete system with a "Recently Deleted" feature for the Overtime+ app. This prevents deleted items from being automatically re-downloaded from the cloud and allows users to restore accidentally deleted data.

## Features Implemented

### 1. Soft Delete System
- When users delete logs, shifts, or export batches, items are marked with a `deleted_at` timestamp instead of being permanently removed
- Deleted items are hidden from normal app views but retained in the database
- Items are automatically permanently deleted after 30 days

### 2. Recently Deleted Screen
- Accessible from Profile → Settings → Recently Deleted
- Shows all deleted items from the past 30 days
- Displays deletion time relative to now (e.g., "2 days ago")
- Separate sections for logs, shifts, and export batches

### 3. Restore Functionality
- Users can restore any deleted item with a single tap
- Restored items immediately appear back in their original locations
- Restoration syncs to cloud automatically

### 4. Permanent Delete
- Users can permanently delete items before the 30-day auto-cleanup
- Confirmation dialog prevents accidental permanent deletion
- "Clean Up Old Items" button to manually trigger 30-day cleanup

### 5. Auto-Cleanup
- Runs automatically when app starts (for authenticated users)
- Permanently deletes items deleted more than 30 days ago
- Logs cleanup results to console

## Technical Implementation

### Database Changes

#### Migration (lib/db/sqlite.ts)
Added `deleted_at` column to three tables:
- `usual_shifts`
- `overtime_logs`
- `export_batches`

#### Updated Query Methods
All GET methods now filter out deleted items:
```sql
WHERE deleted_at IS NULL
```

#### New Methods Added
- `getDeletedLogs()` - Retrieve deleted logs
- `getDeletedShifts()` - Retrieve deleted shifts
- `getDeletedExportBatches()` - Retrieve deleted export batches
- `restoreLog()` - Clear deleted_at to restore
- `restoreShift()` - Clear deleted_at to restore
- `restoreExportBatch()` - Clear deleted_at to restore
- `permanentlyDeleteLog()` - Hard delete from database
- `permanentlyDeleteShift()` - Hard delete from database
- `permanentlyDeleteExportBatch()` - Hard delete from database
- `cleanupOldDeletedItems()` - Remove items older than 30 days

### Type Updates (types.ts)

Added optional `deletedAt?: string` field to:
- `OvertimeLog`
- `UsualShift`
- `ExportBatch`

### Supabase Sync Updates (lib/supabase.ts)

#### Upload Methods
All upload methods now include `deleted_at` field:
- `logsSync.uploadLog()` - Syncs deleted_at timestamp
- `shiftsSync.uploadShift()` - Syncs deleted_at timestamp
- `exportSync.uploadExportBatch()` - Syncs deleted_at timestamp

#### Download Methods
All download methods filter out deleted items:
```typescript
deleted_at=is.null
```

#### Delete Methods
All delete methods already used soft delete (set `deleted_at`):
- `logsSync.deleteLog()` - Sets deleted_at in cloud
- `shiftsSync.deleteShift()` - Sets deleted_at in cloud
- `exportSync.deleteExportBatch()` - Sets deleted_at in cloud

### New Store (lib/state/deletedItemsStore.ts)

Created dedicated Zustand store for managing deleted items:

**State:**
- `deletedLogs: OvertimeLog[]`
- `deletedShifts: UsualShift[]`
- `deletedBatches: ExportBatch[]`
- `isLoading: boolean`
- `error: string | null`

**Actions:**
- `loadDeletedItems()` - Load all deleted items
- `restoreLog()` - Restore a deleted log
- `restoreShift()` - Restore a deleted shift
- `restoreBatch()` - Restore a deleted export batch
- `permanentlyDeleteLog()` - Permanently delete a log
- `permanentlyDeleteShift()` - Permanently delete a shift
- `permanentlyDeleteBatch()` - Permanently delete an export batch
- `cleanupOldItems()` - Clean up items older than 30 days

### UI Components

#### Recently Deleted Screen (app/recently-deleted.tsx)
- Full-screen view with header, back button, and cleanup button
- Info banner explaining 30-day auto-delete
- List of all deleted items sorted by deletion date
- Each item shows:
  - Icon based on type (document, calendar, folder)
  - Title and subtitle with relevant details
  - Relative deletion time
  - Restore button (green)
  - Permanent delete button (red)
- Empty state when no deleted items
- Pull-to-refresh support

#### Profile Settings Link (app/(tabs)/profile.tsx)
Added navigation link in Settings section:
- "Recently Deleted" → "Restore or permanently delete"
- Placed after Email Settings for easy access

### App Integration (app/_layout.tsx)

Auto-cleanup runs on app initialization:
```typescript
// Auto-cleanup deleted items older than 30 days
const { cleanupOldItems } = useDeletedItemsStore.getState();
const result = await cleanupOldItems(user.id);
```

## User Flow

### Deleting an Item
1. User taps delete on a log, shift, or export batch
2. Item is marked with current timestamp in `deleted_at`
3. Item immediately disappears from main view
4. Item is synced to cloud with `deleted_at` set
5. Item appears in Recently Deleted screen

### Restoring an Item
1. User navigates to Profile → Settings → Recently Deleted
2. User taps restore button on an item
3. Confirmation dialog appears
4. On confirmation:
   - `deleted_at` is cleared in local database
   - Item reappears in main app views
   - Change syncs to cloud
   - Main store reloads to show restored item

### Permanent Deletion
1. User taps permanent delete button on an item
2. Destructive confirmation dialog appears
3. On confirmation:
   - Item is hard-deleted from local database
   - Item removed from Recently Deleted view
   - Cloud version will auto-delete after 30 days

### Auto-Cleanup
1. Runs automatically when app starts (for logged-in users)
2. Finds items with `deleted_at` older than 30 days
3. Permanently deletes those items from local database
4. Logs count of cleaned up items to console

## Benefits

1. **Prevents Re-Download Issues**: Deleted items won't reappear from cloud sync
2. **Safety Net**: Users can recover accidentally deleted items
3. **Data Hygiene**: Automatic cleanup after 30 days prevents database bloat
4. **User Control**: Manual permanent delete and cleanup options
5. **Cloud Sync**: Deletion state syncs across devices
6. **Privacy**: Old deleted data is automatically purged

## Testing Recommendations

1. **Soft Delete**: Delete various items and verify they disappear from main views
2. **Recently Deleted View**: Verify deleted items appear in Recently Deleted screen
3. **Restore**: Test restoring items and verify they reappear in main views
4. **Permanent Delete**: Test permanent deletion and verify items are removed
5. **Auto-Cleanup**: Mock dates to test 30-day cleanup logic
6. **Cloud Sync**: Test deletion/restore across multiple devices
7. **Offline Mode**: Test deletion/restore when offline and verify sync when back online

## Database Schema Impact

The migration adds `deleted_at TEXT` column to existing tables. This is backward compatible - existing rows will have `NULL` values for this field, which is the correct default state (not deleted).

## Performance Considerations

- All queries now include `WHERE deleted_at IS NULL` filter
- Deleted items are indexed normally (no performance impact)
- Cleanup query runs once per app launch (minimal overhead)
- Recently Deleted screen loads separately (doesn't impact main app)

## Future Enhancements

Possible improvements for future versions:

1. **Search in Recently Deleted**: Add search/filter functionality
2. **Bulk Operations**: Select multiple items to restore or delete at once
3. **Configurable Retention**: Allow users to set custom retention period
4. **Deletion Reasons**: Add optional reason field for audit trail
5. **Statistics**: Show storage space saved by cleaning up old items
6. **Export Deleted Items**: Allow exporting list of deleted items for record keeping

