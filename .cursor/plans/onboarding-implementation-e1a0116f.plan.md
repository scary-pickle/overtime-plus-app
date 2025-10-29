<!-- e1a0116f-b3a7-4d77-b5e9-492c1220e766 d9d2fa3e-ade3-4f83-bae2-cff1f402e5c3 -->
# Onboarding Implementation Plan

## Overview

Create a comprehensive onboarding flow for the Overtime+ app that guides new users through profile setup, feature demonstrations, and initial app configuration. This onboarding integrates with the Supabase authentication system and ensures users understand all core functionality before accessing the main app.

## Implementation Steps

### 1. Create Onboarding Store

Create `lib/state/onboardingStore.ts`:

- Track onboarding completion status
- Store onboarding progress (steps completed)
- Manage demo data creation
- Handle onboarding state persistence
- Actions: `completeOnboarding`, `resetOnboarding`, `setStepComplete`, `createDemoData`

### 2. Create Onboarding Screens

Create `app/onboarding/` directory with screens:

**`app/onboarding/_layout.tsx`**:
- Stack navigator for onboarding flow
- Disable back navigation during onboarding
- Custom header styling

**`app/onboarding/welcome.tsx`**:
- App introduction and branding
- Brief overview of what Overtime+ does
- "Get Started" button to begin onboarding
- Skip option for returning users

**`app/onboarding/profile-setup.tsx`**:
- Step-by-step profile completion
- Form validation with helpful error messages
- Auto-generation of employee initials
- Hospital and department selection
- Delegate information collection
- Progress indicator showing completion percentage

**`app/onboarding/features-demo.tsx`**:
- Interactive demonstration of core features
- Animated walkthrough of main screens
- Feature highlights with tooltips
- "Try it yourself" interactive elements
- Skip option for experienced users

**`app/onboarding/shift-setup.tsx`**:
- Guide users to create their first usual shift
- Explain benefits of shift patterns
- Pre-populate common shift examples
- Show how shifts pre-fill overtime logs

**`app/onboarding/notifications-setup.tsx`**:
- Explain notification benefits
- Request notification permissions
- Configure reminder settings
- Test notification functionality

**`app/onboarding/complete.tsx`**:
- Onboarding completion celebration
- Summary of what was set up
- Quick access to main features
- "Start Using App" button

### 3. Create Onboarding Components

**`components/onboarding/OnboardingProgress.tsx`**:
- Progress bar showing current step
- Step indicators (dots or numbers)
- Current step title and description

**`components/onboarding/FeatureCard.tsx`**:
- Reusable card for feature demonstrations
- Icon, title, description, and action button
- Consistent styling across onboarding

**`components/onboarding/DemoOverlay.tsx`**:
- Semi-transparent overlay for feature highlights
- Animated tooltips and callouts
- Interactive elements to guide user attention

**`components/onboarding/StepIndicator.tsx`**:
- Visual progress indicator
- Completed, current, and upcoming steps
- Smooth animations between steps

### 4. Update Authentication Flow

Modify `app/index.tsx`:
- Check if user is authenticated AND has completed onboarding
- Redirect to onboarding if authenticated but onboarding incomplete
- Redirect to auth if not authenticated
- Redirect to main app if both complete

### 5. Create Demo Data System

Create `lib/demo/demoData.ts`:
- Sample overtime logs for demonstration
- Example shift patterns
- Mock profile data for testing
- Demo export batches

Create `lib/demo/demoActions.ts`:
- Functions to create demo data
- Clean up demo data after onboarding
- Reset to real user data

### 6. Add Onboarding State Management

Update `lib/state/authStore.ts`:
- Add `hasCompletedOnboarding` field
- Check onboarding status during auth flow
- Handle onboarding completion

Update `lib/state/profileStore.ts`:
- Trigger onboarding completion when profile is complete
- Sync onboarding status with Supabase

### 7. Create Interactive Tutorials

**`components/onboarding/TutorialOverlay.tsx`**:
- Step-by-step interactive tutorials
- Highlight specific UI elements
- Guide users through key workflows
- Skip and replay options

**`components/onboarding/FeatureWalkthrough.tsx`**:
- Animated demonstrations of app features
- Show real data in context
- Explain benefits and use cases

### 8. Add Onboarding Analytics

Create `lib/analytics/onboarding.ts`:
- Track onboarding completion rates
- Monitor which steps users skip
- Identify common drop-off points
- A/B test different onboarding flows

### 9. Update Navigation Flow

Modify `app/_layout.tsx`:
- Add onboarding screens to navigation stack
- Handle onboarding-specific navigation
- Prevent access to main app during onboarding

### 10. Create Onboarding Content

**`lib/content/onboardingContent.ts`**:
- Centralized onboarding text and copy
- Feature descriptions and benefits
- Help text and tooltips
- Localization support structure

**`lib/content/featureHighlights.ts`**:
- Key features to highlight during onboarding
- Benefits and use cases
- Visual assets and icons

### 11. Add Onboarding Validation

Create `lib/validation/onboardingValidation.ts`:
- Validate profile completion
- Check required permissions
- Ensure demo data is created
- Verify onboarding prerequisites

### 12. Create Onboarding Settings

Add to `app/(tabs)/profile.tsx`:
- "Reset Onboarding" option in settings
- "View Tutorial" option for re-learning
- Onboarding status indicator

## Onboarding Flow Steps

### Step 1: Welcome & Introduction
- App branding and welcome message
- Brief overview of Overtime+ capabilities
- Benefits of using the app
- "Get Started" or "Skip" options

### Step 2: Profile Setup
- **Personal Information**:
  - Full name (auto-generate initials)
  - Payroll number
  - Service enquiry number (optional)
- **Organizational Details**:
  - Organization unit number and name
  - Location (hospital selection)
  - Pay level
- **Delegate Information**:
  - Delegate name and position
  - Phone number with area code
- **Settings**:
  - Timezone (default: Australia/Brisbane)
  - Concurrent employment default

### Step 3: Features Demonstration
- **Home Screen Tour**:
  - Today's overview card
  - Quick action buttons
  - Statistics display
  - Recent logs section
- **Logging Overtime**:
  - How to create a new log
  - Time input and calculation
  - Category selection
  - Comments and additional details
- **Shift Management**:
  - Creating usual shift patterns
  - Weekly vs biweekly patterns
  - How shifts pre-fill logs
- **Export Functionality**:
  - Generating AVAC PDFs
  - Batch export process
  - Sharing and saving

### Step 4: Shift Pattern Setup
- Guide to create first usual shift
- Explain benefits of shift patterns
- Show common shift examples
- Demonstrate how it pre-fills logs

### Step 5: Notifications Setup
- Request notification permissions
- Explain reminder benefits
- Configure reminder timing
- Test notification functionality

### Step 6: Interactive Tutorial
- **Create Your First Log**:
  - Guided walkthrough of log creation
  - Real-time feedback and validation
  - Show minutes calculation
- **Export Your First PDF**:
  - Demonstrate export process
  - Show PDF preview
  - Explain sharing options

### Step 7: Onboarding Complete
- Celebration animation
- Summary of what was set up
- Quick access to main features
- Option to view full tutorial again

## Key Features to Demonstrate

### Core Functionality
1. **Profile Management**
   - Complete employee details
   - Delegate information
   - Auto-generated initials

2. **Overtime Logging**
   - Quick log creation
   - Time input and validation
   - Minutes calculation (rounded to 5)
   - Category selection
   - Comments and notes

3. **Shift Patterns**
   - Weekly and biweekly patterns
   - Active date ranges
   - Meal break configuration
   - Pre-filling log times

4. **Export System**
   - AVAC PDF generation
   - Batch export functionality
   - PDF preview and sharing
   - Export status tracking

5. **Notifications**
   - Shift end reminders
   - Snooze functionality
   - Notification settings

### Advanced Features
1. **Data Management**
   - Local storage security
   - Offline functionality
   - Data synchronization

2. **Time Calculations**
   - Automatic overtime calculation
   - Rounding to nearest 5 minutes
   - Meal break deductions

3. **Export Options**
   - Multiple log batching
   - PDF customization
   - Email sharing

## User Experience Considerations

### Onboarding Principles
- **Progressive Disclosure**: Show features gradually
- **Interactive Learning**: Let users try features hands-on
- **Contextual Help**: Provide help when needed
- **Skip Options**: Allow experienced users to skip
- **Progress Indication**: Show completion status
- **Celebration**: Acknowledge completion

### Accessibility
- Screen reader support
- High contrast mode
- Large text options
- Voice-over navigation
- Keyboard navigation

### Performance
- Lazy load onboarding screens
- Optimize animations
- Minimize memory usage
- Fast screen transitions

## Integration with Authentication

### Flow Integration
1. User completes authentication
2. Check if onboarding is complete
3. If incomplete → redirect to onboarding
4. If complete → redirect to main app
5. Onboarding completion triggers auth state update

### Data Persistence
- Store onboarding status in Supabase
- Sync with local storage
- Handle offline scenarios
- Maintain state across app restarts

## Key Files to Create/Modify

**New Files**:
- `lib/state/onboardingStore.ts`
- `lib/demo/demoData.ts`
- `lib/demo/demoActions.ts`
- `lib/analytics/onboarding.ts`
- `lib/content/onboardingContent.ts`
- `lib/content/featureHighlights.ts`
- `lib/validation/onboardingValidation.ts`
- `app/onboarding/_layout.tsx`
- `app/onboarding/welcome.tsx`
- `app/onboarding/profile-setup.tsx`
- `app/onboarding/features-demo.tsx`
- `app/onboarding/shift-setup.tsx`
- `app/onboarding/notifications-setup.tsx`
- `app/onboarding/complete.tsx`
- `components/onboarding/OnboardingProgress.tsx`
- `components/onboarding/FeatureCard.tsx`
- `components/onboarding/DemoOverlay.tsx`
- `components/onboarding/StepIndicator.tsx`
- `components/onboarding/TutorialOverlay.tsx`
- `components/onboarding/FeatureWalkthrough.tsx`

**Modified Files**:
- `app/index.tsx` - Add onboarding flow logic
- `app/_layout.tsx` - Add onboarding navigation
- `lib/state/authStore.ts` - Add onboarding status
- `lib/state/profileStore.ts` - Trigger onboarding completion
- `app/(tabs)/profile.tsx` - Add onboarding reset option
- `types.ts` - Add onboarding-related types

## Success Metrics

### Completion Rates
- Overall onboarding completion rate
- Step-by-step completion rates
- Time to complete onboarding
- Drop-off points identification

### User Engagement
- Feature adoption after onboarding
- Time to first log creation
- Time to first export
- Return user rates

### User Satisfaction
- Onboarding experience ratings
- Feature understanding scores
- Help request frequency
- Support ticket reduction

## Testing Strategy

### Manual Testing
- Complete onboarding flow end-to-end
- Test all skip options
- Verify data persistence
- Test offline scenarios
- Validate all form inputs

### User Testing
- Observe real users going through onboarding
- Identify confusion points
- Measure completion times
- Gather feedback on clarity

### A/B Testing
- Test different onboarding flows
- Compare completion rates
- Optimize based on data

## Future Enhancements

### Phase 2 Features
- Video tutorials
- Interactive animations
- Personalized onboarding paths
- Advanced feature discovery

### Analytics Integration
- Detailed user behavior tracking
- Conversion funnel analysis
- Feature usage correlation
- Onboarding optimization insights

### Localization
- Multi-language support
- Regional customization
- Cultural adaptation
- Accessibility improvements

### To-dos

- [ ] Create onboarding store with state management
- [ ] Build onboarding screen components and navigation
- [ ] Implement profile setup with validation and auto-generation
- [ ] Create interactive feature demonstrations
- [ ] Add shift pattern setup guidance
- [ ] Implement notification permission and setup flow
- [ ] Create demo data system for hands-on learning
- [ ] Build tutorial overlay and walkthrough components
- [ ] Integrate onboarding flow with authentication system
- [ ] Add onboarding analytics and tracking
- [ ] Create onboarding content and copy management
- [ ] Implement onboarding validation and error handling
- [ ] Add onboarding reset and tutorial replay options
- [ ] Test complete onboarding flow and user experience
- [ ] Optimize onboarding performance and accessibility
