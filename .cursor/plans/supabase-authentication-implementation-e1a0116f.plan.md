<!-- e1a0116f-b3a7-4d77-b5e9-492c1220e766 d9d2fa3e-ade3-4f83-bae2-cff1f402e5c3 -->
# Supabase Authentication Implementation

## Overview

Add authentication to the Overtime+ app using Supabase, requiring email verification before app access, restricting signups to @health.qld.gov.au email addresses, and maintaining persistent sessions for up to 1 year.

## Implementation Steps

### 1. Install Dependencies

Install the Supabase JavaScript client library:

- `@supabase/supabase-js` - Official Supabase client

### 2. Configure Supabase Client

Update `lib/supabase.ts`:

- Replace stub implementation with real Supabase client initialization
- Configure session persistence using `expo-secure-store` for token storage
- Set session refresh token expiry to 1 year
- Implement auth state change listener

### 3. Create Auth Context & Store

Create `lib/state/authStore.ts`:

- Zustand store for auth state management
- Track: `user`, `session`, `isAuthenticated`, `isLoading`, `emailVerified`
- Actions: `signUp`, `signIn`, `signOut`, `checkSession`, `resendVerification`
- Validate email domain (@health.qld.gov.au) before signup
- Handle auth state persistence across app restarts

### 4. Create Authentication Screens

Create `app/auth/` directory with screens:

**`app/auth/welcome.tsx`**:

- Landing screen with app branding
- "Sign In" and "Sign Up" buttons
- Brief description of the app

**`app/auth/sign-in.tsx`**:

- Email and password input fields
- Sign in button with loading state
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Error handling and display

**`app/auth/sign-up.tsx`**:

- Email input (validate @health.qld.gov.au domain)
- Password input (with strength requirements)
- Confirm password input
- Terms acceptance checkbox
- Sign up button with loading state
- Show domain restriction message
- "Already have an account? Sign in" link
- Error handling

**`app/auth/verify-email.tsx`**:

- Email verification pending screen
- Display user's email address
- "Resend verification email" button
- "Check verification status" button
- Logout option
- Instructions for checking email

**`app/auth/forgot-password.tsx`**:

- Email input for password reset
- Submit button
- Success/error messaging
- Back to sign in link

### 5. Update Root Layout for Auth Flow

Modify `app/_layout.tsx`:

- Check auth state on app initialization
- Redirect to auth screens if not authenticated
- Redirect to email verification if email not verified
- Only initialize app data (database, profile, etc.) after authentication
- Add auth state listener to handle session changes

### 6. Update Index Route

Modify `app/index.tsx`:

- Check authentication status
- Redirect to `/auth/welcome` if not authenticated
- Redirect to `/auth/verify-email` if email not verified
- Redirect to `/(tabs)/home` if authenticated and verified

### 7. Add Auth Navigation Stack

Update `app/_layout.tsx` Stack configuration:

- Add auth screens to navigation stack
- Configure appropriate presentation modes
- Set up proper header styles

### 8. Implement Supabase Backend Setup

Document required Supabase configuration:

**Database Tables**:

- `profiles` table: user_id (FK to auth.users), profile_data (JSONB), created_at, updated_at
- `overtime_logs` table: id, user_id (FK), log_data (JSONB), created_at, updated_at
- `shifts` table: id, user_id (FK), shift_data (JSONB), created_at, updated_at
- `export_batches` table: id, user_id (FK), batch_data (JSONB), created_at

**Row Level Security (RLS)**:

- Enable RLS on all tables
- Users can only read/write their own data
- Policy: `user_id = auth.uid()`

**Email Templates**:

- Customize email verification template
- Add branding and clear instructions

**Auth Settings**:

- Enable email confirmation requirement
- Set session expiry to 1 year (31536000 seconds)
- Configure email domain whitelist or use custom validation

### 9. Update Profile Store Integration

Modify `lib/state/profileStore.ts`:

- Link profile data to authenticated user
- Sync profile to Supabase after local save
- Load profile from Supabase on first login
- Handle profile conflicts (local vs remote)

### 10. Add Sign Out Functionality

Update `app/(tabs)/profile.tsx`:

- Add "Sign Out" button in settings section
- Clear local auth state and Supabase session
- Redirect to auth welcome screen
- Optionally keep local data or clear it

### 11. Implement Session Persistence

Create `lib/auth/session.ts`:

- Store auth tokens in `expo-secure-store`
- Auto-restore session on app launch
- Handle token refresh automatically
- Clear tokens on explicit logout

### 12. Add Email Domain Validation

Create `lib/auth/validation.ts`:

- Validate email format
- Check domain is @health.qld.gov.au
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Display helpful error messages

### 13. Update Environment Configuration

Update `.env` and `env.example`:

- Add Supabase URL and anon key placeholders
- Document required environment variables
- Add instructions for obtaining credentials

### 14. Handle Auth Errors

Implement comprehensive error handling:

- Network errors (offline mode)
- Invalid credentials
- Email already exists
- Email not verified
- Session expired
- Rate limiting

### 15. Add Loading States

Implement loading indicators for:

- Initial auth check on app launch
- Sign in/sign up operations
- Email verification status checks
- Session refresh operations

## Key Files to Create/Modify

**New Files**:

- `lib/state/authStore.ts`
- `lib/auth/session.ts`
- `lib/auth/validation.ts`
- `app/auth/_layout.tsx`
- `app/auth/welcome.tsx`
- `app/auth/sign-in.tsx`
- `app/auth/sign-up.tsx`
- `app/auth/verify-email.tsx`
- `app/auth/forgot-password.tsx`

**Modified Files**:

- `lib/supabase.ts` - Replace stub with real implementation
- `app/_layout.tsx` - Add auth flow logic
- `app/index.tsx` - Add auth redirects
- `app/(tabs)/profile.tsx` - Add sign out button
- `lib/state/profileStore.ts` - Add Supabase sync
- `types.ts` - Add auth-related types

## Security Considerations

- Store tokens securely using `expo-secure-store`
- Never log sensitive auth data
- Implement proper RLS policies in Supabase
- Use HTTPS for all API calls
- Handle token refresh transparently
- Clear sensitive data on logout

## User Experience Flow

1. User opens app → Check auth state
2. Not authenticated → Show welcome screen
3. User signs up with @health.qld.gov.au email
4. Email validation happens client-side
5. Supabase sends verification email
6. User redirected to verify-email screen
7. User clicks link in email
8. App checks verification status
9. Once verified → Access granted to main app
10. Session persists for 1 year or until logout
11. On subsequent app opens → Auto-login if session valid

### To-dos

- [ ] Install @supabase/supabase-js package
- [ ] Create email domain and password validation utilities
- [ ] Create session persistence manager using expo-secure-store
- [ ] Create Zustand auth store with signup, signin, signout actions
- [ ] Replace stub Supabase implementation with real client
- [ ] Add authentication-related TypeScript types
- [ ] Create auth screens: welcome, sign-in, sign-up, verify-email, forgot-password
- [ ] Update root layout to handle auth flow and redirects
- [ ] Update index route with auth-based redirects
- [ ] Add sign out button to profile screen
- [ ] Update environment configuration files with Supabase setup instructions
- [ ] Create documentation for Supabase backend setup (tables, RLS, email templates)