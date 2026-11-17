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
2. Open **SQL Editor → New query**. Paste the entire contents of `supabase/schema.sql`, then run it **once on a fresh project**. It runs in a transaction. Do not run repeatedly against an existing populated schema; use reviewed migrations for later changes.
3. In **Authentication → Providers**, enable Email/Password. Email confirmation is recommended. Configure an SMTP provider before real student onboarding; Supabase's default email delivery has limits.
4. In **Authentication → URL Configuration**, set Site URL to your production origin. Add `http://localhost:5173/**` and your production origin's `/**` path as allowed redirect URLs. Adjust the localhost port if Vite chooses a different one.
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

Without valid environment variables the app starts in **demo mode**. Demo student and organizer roles are available at `/login`. Edits are stored only in browser localStorage. There is no production role switch when Supabase is connected. Demo data and demo accounts are never uploaded to Supabase. To reset the demo, remove `cc-session` and `cc-data-v1` from the browser's Local Storage and refresh.

Vite injects these values **at build time**. Restart Vite after changing environment variables. For production, set them in the build environment and rebuild; changing hosting runtime variables cannot reconfigure an existing static bundle.

## Setup: 3. Create the first organizer

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

Only a trusted database administrator can assign organizer roles. Signup metadata always creates a `student` profile; students cannot update the `role` column. Client routes are only a usability layer; PostgreSQL policies and RPC checks enforce the same boundaries.

## Features, in implementation order

1. **Foundation:** PostgreSQL tables, foreign keys, unique registrations, indexes, RLS, storage policies and account creation trigger.
2. **Accounts:** signup, email confirmation, login/logout, protected student and admin routes, editable profiles and photo uploads.
3. **Discovery:** landing/discovery page, event cards, keyword/category/date/organization/availability filters, grid/list views and event detail pages.
4. **Calendar:** FullCalendar month/week views, category filter, event click navigation. Calendar and form inputs use device-local time; detail pages and tickets explicitly display Philippine Time (Asia/Manila).
5. **Registration:** one-click confirmation/cancellation, capacity indicator, duplicate prevention, optional waitlist, promotion before the deadline, QR tickets and print/save as PDF.
6. **Communication:** global and event-specific announcements, per-user browser read state, notification bell/feed, and soon-starting banners on event details and registrations.
7. **Organizer management:** dashboard, create/edit/delete events, banner uploads, registrant lists, camera QR scanning and manual check-in.
8. **Reports:** per-event and aggregate metrics, daily registration chart for the last 14 days, attendance comparison, registrant detail and CSV export.

## Important behavior

- `register_for_event` and `cancel_registration` lock the parent event row, serializing seat allocation. The `(event_id,user_id)` unique constraint also prevents duplicates. Direct client mutation of registrations and attendance is revoked.
- Confirmed QR tokens are unique random UUIDs. Tokens rotate on re-registration, cancellation and waitlist promotion. Tickets should be treated as private bearer tokens. Students present tickets; only an organizer can record check-in. Wrong-event, cancelled, waitlisted and already-used tickets are rejected.
- Check-in opens two hours before an event in the real database. Organizers can reconcile attendance later. For easy testing, demo check-in is available at any time.
- Cancellation closes when an event starts and cannot cancel an already-attended ticket. Promotion selects the earliest waitlisted row before the registration deadline.
- Lowering event capacity below confirmed registrations is blocked by both UI validation and a database trigger.
- All organizers have campus-wide event administration permissions, as requested. This model does not isolate organizers by organization.
- Public users can browse event information and aggregate seat counts. Student profiles, tickets, and attendance require authentication. Students can read their own records; organizers can read all for management/reporting. Event-specific announcements are visible only to active registrants and organizers.
- Announcement read state is device-local; announcements themselves are durable in Supabase. Waitlist promotions appear when data refreshes; no push/email notification or realtime subscription service is included.
- CSV export neutralizes spreadsheet formula prefixes and quotes cells containing commas, quotes, and newlines.
- Image links and uploaded profile photos are public. Demo image uploads are limited to 500 KB to fit browser storage. The campus and activity photos are illustrative stock images from Unsplash, not official USC photography; the graduation-cap mark is a placeholder, not an official university seal.

## Build, test and deployment

```sh
npm test
npm run build
npm run preview
```

`npm test` covers demo student/organizer workflows in a simulated DOM, event validation, CSV safety, and a PostgreSQL-compatible integration test for schema/RLS/registration/check-in rules. The SQL tests use in-memory PGlite with small stubs for Supabase's auth/storage schemas; they do not replace testing against your actual Supabase project or validate simultaneous multi-connection requests.

Deploy the generated `dist/` folder to a static host. Configure an **SPA fallback** so routes such as `/events/…` and `/admin/reports` return `index.html`. For Netlify/Cloudflare Pages, the included `public/_redirects` is copied into the build. For other hosts, configure their equivalent rewrite. Always use HTTPS; browser camera scanning requires a secure context (HTTPS or localhost), camera permission, and supported hardware.

The hosted preview supplied with this project uses demo mode until rebuilt with your project's public configuration. Live Supabase email delivery, storage, and camera hardware must be verified after connection.

## Manual acceptance checks with your Supabase project

- Sign up two students and one approved organizer. Verify confirmation, login/logout, own-profile editing, and denied access to `/admin` from a student account.
- Create an event with capacity 1 and a future deadline. Register student A; verify duplicate registration is rejected. Student B should be offered a waitlist, then promoted when A cancels before the deadline.
- Verify students cannot read another student's registration/QR token or change their own role through a direct API request.
- Within the check-in window, scan or manually mark a confirmed ticket. Reusing the ticket, scanning for a different event, or using a waitlisted/cancelled ticket must fail.
- Check event edits, deletion cascade, event-specific announcement visibility, CSV contents, photo/banner uploads, and month/week calendar navigation.
- Test on a phone at narrow widths, with a screen reader, and with a physical camera. Keyboard tab order, focus visibility, input labels, empty/error/loading states and reduced-motion support are included; a complete accessibility audit has not been performed.
