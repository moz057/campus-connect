# CampusConnect checkpoint

Paused on November 19, 2026, with the organization and leadership update implemented and tested locally. Resume on the GitHub branch `feature/organization-leadership`, based on `main` at commit `2a6f302`.

## Goal and agreed requirements

- Keep student registration, waitlists, QR tickets, calendar, announcements, and profile editing working.
- Keep university privileges in `profiles.role` and grant organization leadership through approved, time-limited memberships. University admins manage recognized organizations, appointments, revocations, and nomination decisions. Student leaders manage only their own organizations and can nominate registered students.
- Enforce permissions in Supabase. Keep private profiles, QR tokens, and personal notifications scoped to their intended readers. Generate notifications in the same transaction as the change.
- Preserve test accounts and existing records. The separate branch is approved for saving the paused work to GitHub. Get explicit permission before merging to `main`, deploying to production, or changing the live database. Keep secrets out of commits and documentation.

## Completed work and files

| Area | Completed work and files |
| --- | --- |
| Database | Added organizations, memberships, nomination review, audit history, notifications, announcement read receipts, event organization IDs, scoped management policies, and transactional notification triggers. Updated `supabase/schema.sql` with the fresh-install sequence and added `supabase/migrations/202611190001_organizations_leadership.sql`. |
| Organization workflows | Added the directory, admin management and review screens, student leadership page, demo workflows, and organization selector. Changed `src/App.tsx`, `src/components/Layout.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/OrganizationContext.tsx`, `src/pages/Auth.tsx`, and `src/pages/Organizations.tsx`. |
| Events and reporting | Scoped dashboards, event management, registrant cancellation, check-in, rosters, and reports. Added visibility and ticket handling for archived organization events. Changed `src/contexts/DataContext.tsx`, `src/lib/supabase.ts`, `src/lib/types.ts`, `src/lib/utils.ts`, and `src/pages/Attendance.tsx`, `Calendar.tsx`, `Dashboard.tsx`, `Discover.tsx`, `EventDetails.tsx`, `EventForm.tsx`, `Registrations.tsx`, and `Reports.tsx` under that directory. |
| Notification interface and styling | Added the combined feed, unread badge, filters, read actions, and refresh behavior. Changed `src/pages/Notifications.tsx`, `src/contexts/ToastContext.tsx`, and `src/styles.css`. |
| Tests and setup | Updated `src/App.test.tsx`, `supabase/schema.test.ts`, and `README.md`. The README describes incremental migration, manual organization mapping, and role checks. |

## Verification and migration status

- Node 22.22.0, Vitest — **41 passed** across 4 files. The browser tests cover the demo nomination and approval flow. Database tests cover existing data, role boundaries, nomination review, expiry and revocation, notification privacy and retries, waitlist promotion, and check-in.
- Node 22.22.0, `tsc -b` and `vite build` — **passed**.
- `git -c core.safecrlf=false diff --check` — **passed** before this checkpoint was added.
- The incremental migration was applied in the local PGlite test database after installing the baseline and seeding existing users and events. Hosted Supabase and the production deployment were left untouched.

## Unfinished work and exact next steps

1. Open the [local demo](http://localhost:5174/login). Try **Student**, **Student Leader**, and **Organizer** (university admin), then run the role checks in the README. Review the layout at a mobile width.
2. If a disposable Supabase test project is available, apply the baseline on a fresh test database or use a copy of the existing schema and representative records. Apply the migration once. Use separate browser profiles to verify cross-device read state, concurrent registrations, Storage uploads, and physical QR scanning. These connected checks are still pending.
3. Wait for explicit approval before changing production. Once approved, back up the production database, apply only the incremental migration to the existing project, then push and deploy the matching frontend. Verify current accounts and records still work.
4. After approval, review legacy events with a null organization ID. Assign recognized organizations by verified event ID or through **Edit event**. Campus-wide events may retain a null organization ID. Free-text affiliations grant no leadership permissions.

## Known behavior and running commands

- Archiving ends leadership access and cancels upcoming events while keeping event, registration, and attendance records. Explicit event deletion retains the existing cascade behavior.
- Previously browser-only announcement read flags may appear unread on the first visit after rollout. The new read receipts persist in Supabase. Refresh occurs on navigation, window focus, or through the notification page's **Refresh** action.
- At the checkpoint, the original computer had Vite servers on ports `5173` (regular preview) and `5174` (account-free demo). On another computer, install dependencies and start Vite locally. The README explains how to run the demo without connecting to Supabase.
