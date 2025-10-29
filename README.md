# Overtime+ 

A React Native app (Expo Go compatible) that automates Queensland Health AVAC overtime forms.

## Features

### MVP (Expo Go Compatible)
- **Profile Management**: Store employee details, delegate information, and employee initials
- **Usual Shifts**: Save recurring roster patterns (weekly/biweekly) for quick logging
- **Quick Log**: Preload rostered times, enter actual times, live minutes calculation
- **Batch Export**: Generate pixel-perfect AVAC PDFs with multiple rows
- **Reminders**: Local notifications at rostered finish times with snooze
- **Offline First**: Secure local storage with optional Supabase sync

### Phase 2 (Custom Dev Build)
- iOS Home/Lock Screen widgets + Live Activities
- Android ongoing notifications via Foreground Service
- Background geofencing for auto start/stop
- Advanced notification actions

## Tech Stack

- **Expo SDK** (TypeScript) + Expo Router
- **State**: Zustand for simple, persistent state management
- **Database**: expo-sqlite for local storage
- **Security**: expo-secure-store for profile encryption
- **Forms**: react-hook-form + zod validation
- **Time**: dayjs with timezone support
- **Notifications**: expo-notifications (local)
- **PDF**: pdf-lib with absolute positioning
- **Backend**: Supabase (optional, stubbed for offline-first)

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device with Expo Go)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd Overtime+
   npm install
   ```

2. **Start the development server:**
   ```bash
   npx expo start
   ```

3. **Run on device:**
   - Install Expo Go on your phone
   - Scan the QR code from the terminal
   - Or press `i` for iOS simulator, `a` for Android emulator

### Environment Setup (Optional)

For Supabase sync (offline-first by default):

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## Project Structure

```
/app
  /(tabs)/          # Tab navigation screens
    home.tsx         # Today's overview and quick actions
    log.tsx          # Overtime logs list with filters
    shifts.tsx       # Usual shifts management
    profile.tsx      # Profile and settings
  /log/
    new.tsx          # Quick log creation
  /export/
    preview.tsx      # PDF preview and sharing
/lib
  /db/
    sqlite.ts        # Database schema and CRUD
  /state/            # Zustand stores
    profileStore.ts
    shiftsStore.ts
    logsStore.ts
  /pdf/              # PDF generation
    buildAVAC.ts
    /maps/
      qld_avac_v85.ts
  time.ts            # Time utilities
  roster.ts          # Roster logic
  notifications.ts   # Local notifications
  capabilities.ts    # Feature flags
  supabase.ts        # Backend sync (stubbed)
/components/         # Reusable UI components
  TimeInput.tsx
  LogCard.tsx
  ShiftCard.tsx
  EmptyState.tsx
  LateBadge.tsx
```

## Usage

### 1. Set Up Profile
- Complete your employee details
- Add delegate information
- Auto-generate employee initials from full name
- Configure notification settings

### 2. Create Usual Shifts
- Add weekly or biweekly shift patterns
- Set active date ranges
- Configure meal break times

### 3. Log Overtime
- Select date (preloads rostered times)
- Enter actual start/finish times
- Add comments and category
- Save as draft or mark ready

### 4. Export AVAC Forms
- Select ready logs for export
- Generate PDF with profile data
- Share via email or save to files

## Data Model

### Profile
- Employee details (name, payroll, org unit, location)
- Delegate information (name, position, phone)
- Employee initials (auto-generated from full name)
- Default cost centre and settings

### UsualShift
- Recurring patterns (weekly/biweekly)
- Day of week and time ranges
- Active date periods

### OvertimeLog
- Date and actual times
- Rostered times (preloaded)
- Minutes calculation (rounded to 5)
- Category and comments
- Status (draft/ready/exported)

### ExportBatch
- Generated PDF metadata
- Log count and total minutes
- Submission tracking

## Validation Rules

- **Time Format**: HH:mm (24-hour)
- **Cost Centre**: 6 digits
- **Minimum Shift**: 30 minutes
- **Rounding**: Nearest 5 minutes
- **Categories**: Overtime, Oncall, Recall, Change shift, Change shift - cancel leave

## PDF Generation

- Uses `pdf-lib` for client-side PDF creation
- Placeholder background template (replace with actual AVAC v8.5)
- Absolute positioning for text placement
- Handles pagination for >10 rows
- Saves to device storage for sharing

## Notifications

- Local notifications at rostered finish times
- Rolling 7-day schedule
- Snooze functionality (10/20/30 minutes)
- Tap to open "End shift now?" modal

## Offline Support

- All data stored locally in SQLite
- Profile encrypted in SecureStore
- Works without internet connection
- Optional Supabase sync when online

## Development

### Adding New Features
- Follow the established patterns in `/lib`
- Use TypeScript for type safety
- Test with Expo Go compatibility
- Add feature flags in `capabilities.ts`

### Database Changes
- Update schema in `/lib/db/sqlite.ts`
- Add migration logic
- Update stores accordingly

### PDF Customization
- Modify coordinates in `/lib/pdf/maps/qld_avac_v85.ts`
- Replace background image in `/assets/pdf/`
- Adjust font sizes and positioning

## Testing

### Manual Testing Checklist
- [ ] Create and complete profile
- [ ] Add usual shift patterns
- [ ] Create overtime logs with preloaded times
- [ ] Verify minutes calculation (rounded to 5)
- [ ] Generate and share PDF
- [ ] Test notifications at rostered finish
- [ ] Verify offline functionality

### Test Data
The app includes placeholder data for testing:
- Sample shift patterns
- Mock overtime logs
- Test profile information

## Troubleshooting

### Common Issues

1. **Expo Go compatibility**: All features work in Expo Go
2. **Notifications not working**: Check permissions in device settings
3. **PDF generation fails**: Ensure sufficient storage space
4. **Database errors**: Clear app data and restart

### Debug Mode
Set `EXPO_PUBLIC_DEBUG_MODE=true` in `.env` for verbose logging.

## Phase 2 Migration

When ready for custom dev build:

1. **Enable capabilities** in `capabilities.ts`
2. **Add native dependencies**:
   - ActivityKit (iOS Live Activities)
   - Foreground Service (Android)
   - Background Location (geofencing)
3. **Implement widgets** and **Live Activities**
4. **Add geofencing** logic
5. **Test on physical devices**

## Contributing

1. Fork the repository
2. Create feature branch
3. Follow TypeScript and React Native best practices
4. Test with Expo Go
5. Submit pull request

## License

Private project for Queensland Health overtime automation.

## Support

For issues or questions:
1. Check this README
2. Review code comments
3. Test with sample data
4. Verify Expo Go compatibility

---

**Note**: This is an MVP implementation focused on Expo Go compatibility. Phase 2 features require custom dev builds and are currently stubbed with feature flags.
