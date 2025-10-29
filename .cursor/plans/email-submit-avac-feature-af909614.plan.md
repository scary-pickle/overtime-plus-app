<!-- af909614-8ae7-419f-86d9-362367c9ef04 cba97e01-2583-4c91-83b4-e3c8e1976aaf -->
# Email Submit AVAC Feature

## Overview

Implement a one-click "Submit AVAC" button that opens the user's email app with a pre-filled email (recipient, subject, body) and prompts them to attach the AVAC PDF. The recipient email is determined from hospital + department mapping stored in Supabase.

## Technical Approach

### Email Composition Method

Use `expo-mail-composer` to open the device's email app with pre-filled fields and automatic PDF attachment. This library:

- Works with any configured email app (Mail, Outlook, Gmail, etc.)
- Supports attachments (unlike `mailto:`)
- Allows users to review before sending
- Respects iOS default email app settings (Outlook if set as default)
- No backend costs or email service needed

### Recipient Database

Store hospital-department-to-email mappings in Supabase:

- Table: `avac_recipients`
- Columns: `hospital_id`, `department`, `recipient_email`, `recipient_name`
- Allows centralized updates without app releases
- Fallback to local data if offline

### Email Template

Store customizable email template in user profile/settings:

- Default: "Hello,\n\nPlease find attached my most recent AVAC.\n\nKind regards,\n{User Name}"
- User can edit template in settings
- Template saved to profile store
- Variables: `{User Name}`, `{Date}`, `{Total Hours}`

## Implementation Steps

### 1. Install Dependencies

Install `expo-mail-composer`:

```bash
npx expo install expo-mail-composer
```

### 2. Create Supabase Table for Recipients

Add migration or manual table creation:

- Table: `avac_recipients`
- Schema:
  - `id` (uuid, primary key)
  - `hospital_id` (text, references hospital identifier)
  - `department` (text)
  - `recipient_email` (text)
  - `recipient_name` (text, optional)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

### 3. Update Profile Type & Store

Extend `Profile` type in `types.ts`:

- Add `email: string` (user's QLD Health email)
- Add `emailTemplate?: string` (customizable email body template)

Update `lib/state/profileStore.ts`:

- Include new email fields in profile state
- Add validation for email field

### 4. Create Email Service Module

Create `lib/email/emailService.ts`:

- `getRecipientForDepartment(hospital: string, department: string)` - Fetch from Supabase with local fallback
- `composeAVACEmail(profile: Profile, pdfUri: string, recipientEmail: string)` - Build email with template
- `sendAVACEmail(profile: Profile, pdfUri: string)` - Main function to compose and open email app
- `parseEmailTemplate(template: string, variables: object)` - Replace template variables

### 5. Update Hospital Departments Data

Update `lib/data/hospitalDepartments.ts`:

- Add email addresses to `DepartmentDelegate` interface (already exists)
- Populate email addresses for each department delegate
- This serves as offline fallback data

### 6. Add Email Template Settings

Create `app/(tabs)/settings.tsx` (or update profile screen):

- Section for "Email Settings"
- Input field for user's email address
- Textarea for customizable email template
- Preview button to show rendered template
- Reset to default button
- Save to profile store

### 7. Add Submit Button to Exports Screen

Update `app/(tabs)/exports.tsx`:

- Add "Submit" button next to Share button for each export
- Icon: `<Ionicons name="mail" />`
- Color: Blue (#007AFF)
- On press: Call `sendAVACEmail()` function
- Show loading state while composing
- Handle errors (no email app, missing recipient, etc.)

### 8. Add Submit Button to PDF Viewer

Update `app/export/view.tsx`:

- Add "Submit via Email" button in header or bottom toolbar
- Same functionality as exports screen
- Allow submission directly from PDF preview

### 9. Error Handling & User Feedback

Implement comprehensive error handling:

- No email app configured → Show alert with instructions
- Recipient not found → Show alert to contact admin or use manual share
- Email composition cancelled → Silent (user chose to cancel)
- PDF file not found → Show error alert
- Offline mode → Use local fallback recipient data

### 10. Add Submission Tracking

Update `ExportBatch` type in `types.ts`:

- Add `submittedAt?: string` (ISO timestamp)
- Add `submittedVia?: 'email' | 'manual'`

Update `lib/state/logsStore.ts`:

- Add `markBatchAsSubmitted(batchId: string, method: 'email' | 'manual')` action
- Update export batch with submission metadata

### 11. Update Profile Screen

Update `app/(tabs)/profile.tsx`:

- Add email address field to profile form
- Show email template settings link
- Validate email format (@health.qld.gov.au when auth is implemented)

## Files to Create

- `lib/email/emailService.ts` - Email composition and sending logic
- `app/(tabs)/settings.tsx` - Email template settings screen (or add to profile)

## Files to Modify

- `package.json` - Add expo-mail-composer dependency
- `types.ts` - Extend Profile and ExportBatch types
- `lib/state/profileStore.ts` - Add email fields
- `lib/state/logsStore.ts` - Add submission tracking
- `lib/data/hospitalDepartments.ts` - Add recipient email addresses
- `app/(tabs)/exports.tsx` - Add submit button
- `app/export/view.tsx` - Add submit button
- `app/(tabs)/profile.tsx` - Add email field

## Handling Multiple Email Apps (iOS)

The `expo-mail-composer` library respects the user's default email app setting:

- If Outlook is set as default → Opens in Outlook
- If Mail is default → Opens in Mail
- If Gmail is default → Opens in Gmail
- User can set default in iOS Settings → [App Name] → Default Mail App

**User Instructions:**

If users have QLD Health email only in Outlook:

1. Go to iOS Settings
2. Scroll to Outlook
3. Tap "Default Mail App"
4. Select "Outlook"

Alternatively, the library will show an app picker if multiple email apps are available.

## Future Enhancements

- Track submission history per export batch
- Add "Resend" functionality for previously submitted AVACs
- Bulk submit multiple AVACs at once
- Add CC/BCC options in email settings
- Email delivery confirmation (requires backend)

## Testing Checklist

- [ ] Test with Outlook as default email app
- [ ] Test with Mail as default email app
- [ ] Test with no email app configured
- [ ] Test with missing recipient data
- [ ] Test offline mode with local fallback
- [ ] Test email template variable replacement
- [ ] Test PDF attachment inclusion
- [ ] Test on iOS and Android
- [ ] Test with long email templates
- [ ] Test submission tracking persistence

### To-dos

- [ ] Install expo-mail-composer package
- [ ] Extend Profile and ExportBatch types with email fields
- [ ] Create email service module with recipient lookup and template parsing
- [ ] Add recipient email addresses to hospital departments data
- [ ] Update profile store to include email fields and template
- [ ] Create or update settings screen with email template editor
- [ ] Add submit button to exports screen
- [ ] Add submit button to PDF viewer screen
- [ ] Implement submission tracking in logs store
- [ ] Add email address field to profile screen