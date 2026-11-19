# CampusConnect

A responsive Student Organization & Event Management System for the University of San Carlos. React 19 + Vite + TypeScript + Tailwind CSS 4, React Router, Supabase Auth/PostgreSQL/RLS, FullCalendar, Recharts, qrcode.react, and html5-qrcode.

## Folder structure

```
campusconnect/
├── src/
│   ├── components/    Layout, event cards, QR ticket, shared UI
│   ├── contexts/      Auth, data access, toast messages
│   ├── data/          Browser demo data
│   ├── lib/           Supabase client, types, validation, CSV and uploads
│   ├── pages/         Student and organizer routes
│   ├── App.tsx        Router and protected routes
│   ├── main.tsx
│   └── styles.css     Tailwind import and responsive USC theme
├── public/images/     Local stock photography
├── supabase/
│   ├── schema.sql     Tables, indexes, auth trigger, RLS, RPCs, storage policies
│   ├── seed.sql       Optional example events and a global announcement
│   └── schema.test.ts PostgreSQL integration and authorization smoke tests
├── .env.example
├── package.json
└── vite.config.ts
```

## Setup: 1. Create your Supabase project

1. Create a project at https://supabase.com/dashboard in your organization. Choose a suitable database region and a strong database password.
2. In the SQL Editor, run `supabase/schema.sql` once for a fresh project, then apply the files in `supabase/migrations` in filename order. For an existing CampusConnect project, apply only the migrations it has yet to receive.
3. In **Authentication → Providers**, enable Email/Password. Email confirmation is recommended. Configure an SMTP provider before real student onboarding; Supabase's default email delivery has limits.
4. In **Authentication → URL Configuration**, set the Site URL to your production origin. Add the full production `/auth/callback` URL and `http://localhost:5173/auth/callback` for local signup tests. Use the actual Vite port.
5. The SQL creates two public image buckets, `avatars` (2 MB) and `event-banners` (5 MB), with MIME restrictions and upload policies. Never place private documents in these public buckets.

## Setup: 2. Configure and run the app

Requires Node.js 22.12+ (or another version supported by Vite 7) and npm.

```sh
npm install
cp .env.example .env.local
```

Open `.env.local` and replace both placeholders:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-legacy-anon-key
```

Find these in Supabase **Project Settings → API** / **API Keys**. Use the project URL and a **publishable** key (or the legacy **anon** key). Never put a `service_role`, secret API key, database password, or access token in a Vite variable or client-side code. Browser keys are public; RLS and restricted RPCs enforce authorization.

```sh
npm run dev
```

Open the exact URL printed by Vite, normally `http://localhost:5173`.

Without valid Supabase variables, open `/login` and choose **Student**, **Student Leader**, or **Organizer** (university admin). Demo accounts and workflows are stored in the browser. To try the demo while keeping your existing `.env.local`, override `VITE_SUPABASE_URL` in the terminal running Vite with `https://YOUR_PROJECT.supabase.co`. Use a separate browser profile for a fresh demo.

Vite injects these values **at build time**. Restart Vite after changing environment variables. For production, set them in the build environment and rebuild; changing hosting runtime variables cannot reconfigure an existing static bundle.

## Setup: 3. Assign the first university admin

1. Visit `/register`, create a student account, and confirm its email.
2. As the database owner in the SQL Editor, run the following after replacing the email with your verified organizer's email:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('organizer@usc.edu.ph');
```

3. Log out and back in (or refresh) to load the updated role.
4. Open `/admin` to create the first event. Optionally run `supabase/seed.sql` for sample events first. The seed does not create users or assign roles.

Only a trusted database administrator can assign university admin access. Signup creates a student profile. University admins manage organization leadership from **Manage organizations**.

## Features, in implementation order

1. **Foundation:** PostgreSQL tables, foreign keys, unique registrations, indexes, RLS, storage policies and account creation trigger.
2. **Accounts:** signup, email confirmation, login/logout, protected student and admin routes, editable profiles and photo uploads.
3. **Discovery:** landing/discovery page, event cards, keyword/category/date/organization/availability filters, grid/list views and event detail pages.
4. **Calendar:** FullCalendar month/week views, category filter, event click navigation. Calendar and form inputs use device-local time; detail pages and tickets explicitly display Philippine Time (Asia/Manila).
5. **Registration:** one-click confirmation/cancellation, capacity indicator, duplicate prevention, optional waitlist, promotion before the deadline, QR tickets and print/save as PDF.
6. **Communication:** campus, organization, and event announcements, personal workflow notifications, and a shared unread count with database-backed read state.
7. **Management:** recognized organizations, scoped organizer workspaces, leadership appointments and nominations, event management, registrant search and cancellation, and QR or manual check-in.
8. **Reports:** per-event and aggregate metrics, daily registration chart for the last 14 days, attendance comparison, registrant detail and CSV export.

## Important behavior

- `register_for_event` and `cancel_registration` lock the parent event row, serializing seat allocation. The `(event_id,user_id)` unique constraint also prevents duplicates. Direct client mutation of registrations and attendance is revoked.
- Confirmed QR tokens are unique random UUIDs. Tokens rotate on re-registration, cancellation and waitlist promotion. Tickets should be treated as private bearer tokens. Students present tickets; only an organizer can record check-in. Wrong-event, cancelled, waitlisted and already-used tickets are rejected.
- Check-in opens two hours before an event in the real database. Organizers can reconcile attendance later. For easy testing, demo check-in is available at any time.
- Cancellation closes when an event starts and cannot cancel an already-attended ticket. Promotion selects the earliest waitlisted row before the registration deadline.
- Lowering event capacity below confirmed registrations is blocked by both UI validation and a database trigger.
- University admins oversee all events. Student leaders can manage events, attendance, announcements, and reports only for active organizations in which they have an approved, unrevoked appointment. Philippine calendar dates determine the term, including both endpoints.
- Public users can browse events, recognized organizations, and seat counts. Profile and QR ticket records are private to the account owner. Organizer rosters expose only reporting and attendance fields for events the organizer manages. Leadership lookup returns student name and student ID.
- Announcements and personal notifications share a feed. Personal notifications are generated within the database transaction that records the change. Announcements appear once in the feed. Supported clients refresh on navigation, on window focus, and through the **Refresh** button.
- CSV export neutralizes spreadsheet formula prefixes and quotes cells containing commas, quotes, and newlines.
- Image links and uploaded profile photos are public. Demo image uploads are limited to 500 KB to fit browser storage. The campus and activity photos are illustrative stock images from Unsplash, not official USC photography; the graduation-cap mark is a placeholder, not an official university seal.

## Build, test and deployment

```sh
npm test
npm run build
npm run preview
```

`npm test` covers demo student/organizer workflows in a simulated DOM, event validation, CSV safety, and a PostgreSQL-compatible integration test for schema/RLS/registration/check-in rules. The SQL tests use in-memory PGlite with small stubs for Supabase's auth/storage schemas; they do not replace testing against your actual Supabase project or validate simultaneous multi-connection requests.

Vercel uses the repository-root `vercel.json` for React Router deep links. A Vite production build outputs to `dist/`. Netlify and Cloudflare Pages can use the fallback in `public/_redirects`. Camera scanning requires HTTPS or localhost and camera permission.

Email delivery, real Supabase Storage, and camera hardware require separate connected-environment checks.


## Apply the organization and leadership migration

Use [202611190001_organizations_leadership.sql](supabase/migrations/202611190001_organizations_leadership.sql). Review it on a disposable Supabase project or local database first. For an existing project, take a database backup, then run the migration once as the database owner in the SQL Editor. Run the original schema first only when setting up a fresh database. The migration runs in one transaction. Deploy the matching frontend after it completes.

Existing accounts, roles, events, registrations, attendance, and announcements are retained. Existing events keep their original organization text and initially have a null organization ID. University admins can manage these legacy events until they assign them to recognized organizations.

1. Review the legacy labels in the SQL Editor. This query is read-only.

   ```sql
   select organization, count(*) as events
   from public.events
   where organization_id is null
   group by organization
   order by organization;
   ```

2. Create the recognized organizations in **Manage organizations**. Open each legacy event in **Edit event** and select its verified organization. Campus-wide events can keep a null organization ID. For a batch assignment, use a reviewed list of exact event IDs and the verified organization ID in a transaction.
3. Review student leadership separately. Free-text profile affiliations never grant access. Use **Direct appointment** or approve a nomination. Retain existing admin roles and use the trusted database operation above for initial admin assignments.

Archiving an organization ends its leaders' management access, cancels upcoming events, and preserves event, registration, and attendance records. Students can see their cancelled entries in **My registrations → Cancelled**. Admins can still see archived records and reject unresolved nominations for that organization. Deleting an event is a separate, explicit action that keeps the existing cascading deletion behavior. The browser-only announcement read flags from the earlier version may appear unread once when switching to persistent receipts.

## External event forms

Apply [202611190002_event_registration_forms.sql](supabase/migrations/202611190002_event_registration_forms.sql) after the organization and leadership migration and before deploying the matching frontend. Existing events have no form requirement. Authorized event editors can add an external form link and optionally require students to confirm they submitted it before registering or joining the waitlist. CampusConnect does not receive or verify external form responses.

## Test the three roles

Run the checks below in the browser demo or a disposable Supabase project. Use separate browser profiles for simultaneous connected roles. In demo mode, the header's **Demo** link lets you switch roles.

- **Student** — Register for a one-seat future event, waitlist a second student, and cancel the first registration. Verify promotion, the updated QR ticket, and the separate private in-app notifications. Use the Unread filter, mark one or all as read, and reload. In a connected test project, sign in from a second browser to verify the read state persists there too.
- **Student Leader** — Select an organization, create and edit its events, manage registrants, post an announcement, and export a report. Check that a second organization's event and admin-only tools are unavailable. Nominate a registered student within your organization and verify that the pending nomination grants no access.
- **University Admin** — Create and edit a recognized organization. Directly appoint a student and edit their term. Approve one nomination and reject another with a reason. Check the nominee and nominator notifications and the leadership history. Verify the start and end date boundaries, then revoke an active appointment and archive an organization with an upcoming event.
- **Attendance** — Within two hours of a connected test event, scan or manually check in a confirmed registrant. Verify that wrong-event, waitlisted, cancelled, and replayed tickets are rejected. Demo check-in is available any time.

The automated database tests apply the baseline, seed existing users and events, then apply the incremental migration in PGlite. They exercise RLS, appointment terms, nomination decisions, notification privacy and read receipts, and the original registration and check-in paths. The browser tests exercise demo workflows. They do not use the live database.