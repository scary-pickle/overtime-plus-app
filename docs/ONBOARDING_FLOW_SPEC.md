# Overtime+ Revised Onboarding Flow (Spec)

## Goal
Help first-time users understand the app's core workflow before they reach the Home screen:

1. Set up the minimum profile details needed to use the app.
2. Understand where the major features live (`Home`, `Logs`, `Shifts`, `Exports`, `Profile`).
3. Create one guided log so the user learns the core data model (times, category, status).
4. Reach Home knowing what to do next.

## Design Principles
- Teach the product loop, not just form fields.
- Label what is required now vs later.
- Avoid misleading copy (optional fields must be optional).
- Never imply a feature is enabled when setup failed or was skipped.
- Use explicit completion CTAs (avoid ambiguous `Next` on final actions).

## Revised Screen Order
1. `Welcome`
2. `How Overtime+ Works` (new)
3. `Profile Setup`
4. `Automatic Shift Tracking` (location permissions)
5. `Create Your First Log` (guided)
6. `You're Ready` (completion + feature map)

## Screen Spec

### 1) Welcome
Purpose:
- Set expectations for setup duration and what the user will learn.

Primary content:
- Value statement (track overtime, generate AVAC PDFs, offline/local).
- A short "What you'll do in setup" list:
  - Add profile basics
  - Learn the app tabs
  - Create a sample/real first log

CTA:
- `Start Setup`

Secondary:
- None required.

### 2) How Overtime+ Works (New)
Purpose:
- Teach the app mental model before forms.

Primary content:
- A 5-card overview mapped to actual tabs:
  - `Home`: Start/end shift, quick create log, recent logs
  - `Logs`: Draft / Ready / Exported states
  - `Shifts`: Save roster patterns and quick shifts
  - `Exports`: Generate AVAC PDF bundles and track submission status
  - `Profile`: Complete delegate/email details for exporting/submitting
- "Typical workflow" summary:
  - Log time -> mark ready -> export PDF -> submit/share -> track status

CTA:
- `Continue to Profile Setup`

Secondary:
- Optional back button to Welcome.

### 3) Profile Setup
Purpose:
- Capture minimum details needed to use the app and generate logs.

Required now:
- Full name
- Payroll number
- Hospital
- Department
- SMO toggle
- Pay level (if not SMO)

Can be completed later:
- Organisation Unit No
- Delegate details
- Recipient email / email template preferences (in Email Settings)

UX rules:
- Optional fields clearly marked "Optional / can add later".
- Validation only blocks on truly required fields.
- Inline helper text explains why each section matters.

CTA:
- `Continue`

### 4) Automatic Shift Tracking (Location Permissions)
Purpose:
- Explain optional background geofence tracking and privacy.

Primary content:
- What auto tracking does (arrive/leave detection, draft creation).
- Privacy/local-only message.
- Clear "optional" positioning.

State rules:
- If permission granted and geofence starts successfully -> show success state and `Continue`.
- If permission denied or setup incomplete -> do not imply enabled state.
- User can always choose `Set up later in Settings`.

CTAs:
- `Enable Location Access` (only enabled when setup prerequisites are satisfied)
- `Continue without Auto Tracking` (or `Set up later in Settings`)

### 5) Create Your First Log (Guided)
Purpose:
- Teach the core log fields and overtime calculation with hands-on entry.

Primary content:
- Step-by-step guided form with field hints and calculation preview.
- Review screen summarizing values and overtime calculation.

Copy rules:
- Review hint must match actual available actions.
- Final CTA must explicitly indicate save + navigation outcome.

CTA (final review):
- `Save First Log & Open Home`

Skip flow:
- Clear confirmation that user can create logs later from Home/Logs.

### 6) You're Ready (Completion)
Purpose:
- Reinforce where major features live before entering Home.

Primary content:
- Short checklist of what setup completed.
- "Where to go next" feature map (tabs and what each tab does).
- Optional recommendation:
  - `Next: Add your shift pattern in Shifts for faster logging`

CTA:
- `Open Home`

## Content/Copy Corrections (Required)
- Do not ask for or store the user's own email address; only collect recipient/template preferences if needed.
- Do not claim "Auto-filled from your email" unless the app actually auto-fills it.
- Do not show `Next` when the action completes onboarding and navigates to Home.
- Do not describe draft/ready choices in onboarding unless those choices are exposed in the onboarding UI.

## Implementation Scope (This iteration)
This spec can be implemented incrementally. For the first pass, prioritize:

1. Add `How Overtime+ Works` screen and route it into onboarding.
2. Fix optional/required copy + validation mismatches.
3. Fix location permission flow so failure/deny does not silently advance as success.
4. Update onboarding completion/review CTAs and copy to be explicit.
5. Add a feature map to the completion screen so users understand tabs before entering Home.
