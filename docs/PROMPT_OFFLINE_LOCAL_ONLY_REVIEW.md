# Prompt: Full Offline/Local-Only App Review

**Use this prompt with Claude to review the entire Overtime+ codebase.** The goal is to get a concrete assessment of how feasible it is to remove all online database and user authentication, so that everything lives on the device, there is no cloud dependency, and the app works completely offline and locally with no sign-in process. Onboarding and other in-app flows (e.g. first-time setup) should remain where they make sense.

---

## Your task

Review the **entire** Overtime+ project and produce a structured report that:

1. **Assesses feasibility** – How easy or hard would it be to make the app 100% offline and local-only (no cloud DB, no user accounts/sign-in)?
2. **Maps current cloud/auth usage** – Where does the app currently depend on:
   - Online database (e.g. Supabase/Postgres)
   - User authentication (sign-in, sign-up, email verification, password reset, session)
   - Sync (upload/download, conflict resolution, queue)
   - Any other network-dependent features
3. **Lists required changes** – For each area (auth, data, sync, routing, subscriptions, etc.), what would have to change:
   - Files and modules to modify or remove
   - New or alternative flows (e.g. “no user” vs “local profile only”)
   - Data model or storage changes if any
   - Routing/navigation changes (e.g. app entry no longer gated by sign-in)
4. **Calls out risks and tradeoffs** – e.g. no cross-device sync, no account recovery, impact on subscriptions/paywall if applicable, and any breaking changes for existing users.
5. **Optional: high-level migration path** – If useful, a phased approach (e.g. “phase 1: remove auth gate, phase 2: remove sync, phase 3: remove Supabase”).

---

## Project context (for the reviewer)

- **Stack:** Expo (React Native), TypeScript, expo-router, Zustand, expo-sqlite.
- **Current architecture:**
  - **Auth:** Supabase Auth; routing in `app/index.tsx` sends users to `/auth/welcome` if no user, `/auth/verify-email` if not verified, `/onboarding/...` if onboarding incomplete, else `/(tabs)/home`.
  - **Data:** Local SQLite (`lib/db/sqlite.ts`) plus Supabase for remote/sync. Zustand stores (e.g. `lib/state/authStore.ts`, `shiftsStore`, `logsStore`, `templatesStore`, `profileStore`, `syncStore`, `deletedItemsStore`, `onboardingStore`) coordinate UI and persistence.
  - **Sync:** `lib/sync/queue.ts` and sync logic in `lib/supabase.ts`; `lib/state/syncStore.ts`.
  - **Auth surface:** `lib/state/authStore.ts`, `lib/auth/*` (storageAdapter, sqliteStorageAdapter, deeplinks, validation, errors, migrateAuthStorage), `app/auth/*` (welcome, sign-in, sign-up, verify-email, forgot-password, reset-password), `app/auth-callback.tsx`, `app/delete-account.tsx`, `app/clear-data.tsx`.
  - **Backend:** Supabase (Auth, DB, Edge Functions for delete-account, revenuecat-reconcile, revenuecat-webhook, auth-signup-guard). PDF templates may be loaded OTA (`templateOTAEnabled`).
  - **Subscriptions:** RevenueCat (`lib/subscription/revenuecat.ts`, `lib/state/subscriptionStore.ts`); Supabase functions for webhooks/reconciliation.
- **Desired end state:**
  - No online database; no Supabase (or equivalent) dependency for app runtime.
  - No user authentication or sign-in; app is “single local user” or “device user” only.
  - Entire app works offline and locally; no cloud sync.
  - Onboarding (and similar flows) can remain; only “account” and “cloud” are removed.

---

## Areas to explicitly consider

- **Entry and routing:** `app/index.tsx`, `app/_layout.tsx`, auth-based redirects, deep links (`lib/auth/deeplinks.ts`).
- **Auth store and session:** `lib/state/authStore.ts` (and any `user` / `emailVerified` / `hasCompletedOnboarding` usage); replacement with “local user” or “onboarding completed” only.
- **All Supabase usage:** `lib/supabase.ts`, every file that imports or calls Supabase (auth, DB, functions, storage).
- **Sync:** `lib/sync/queue.ts`, `lib/state/syncStore.ts`, and any code that pushes/pulls data to/from the cloud.
- **Stores that assume a user id or sync:** `shiftsStore`, `logsStore`, `templatesStore`, `shiftTemplatesStore`, `profileStore`, `deletedItemsStore`, `onboardingStore` – do they rely on `userId` or remote APIs?
- **Profile and identity:** `lib/storage/profile.ts`, `lib/state/profileStore.ts` – what becomes of “profile” when there is no account?
- **Delete account / clear data:** `app/delete-account.tsx`, `app/clear-data.tsx`, Supabase delete-account function; what replaces “delete account” (e.g. “clear all local data” only)?
- **Subscriptions and paywall:** RevenueCat and Supabase webhooks; how to handle subscriptions in a fully offline app (e.g. local-only entitlement checks, or removing paywall).
- **PDFs and templates:** `lib/storage/pdfStorage.ts`, `lib/pdf/templateLoader.ts`, OTA template loading; ensure templates can be bundled or loaded locally only.
- **Analytics and email:** Any analytics or email that hit remote services; decide keep/remove/stub for offline.
- **Tests:** `__tests__/*` – which tests assume auth or Supabase; what needs to change or be removed.

---

## Output format

Please structure your response as:

1. **Executive summary** (feasibility + 2–3 sentence overview).
2. **Current cloud/auth dependency map** (bullet list or table: feature → files → purpose).
3. **Change list by area** (Auth, Data/SQLite, Sync, Routing, Subscriptions, PDFs/Templates, Other).
4. **Risks and tradeoffs**.
5. **Optional: suggested migration phases**.

Keep the report actionable so a developer can use it to plan and implement the transition to a fully offline, local-only, no-sign-in app.
