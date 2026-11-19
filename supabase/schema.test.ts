import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  a: "00000000-0000-4000-8000-000000000002",
  b: "00000000-0000-4000-8000-000000000003",
  c: "00000000-0000-4000-8000-000000000004",
  event: "10000000-0000-4000-8000-000000000001",
  future: "10000000-0000-4000-8000-000000000002",
  past: "10000000-0000-4000-8000-000000000003",
  other: "10000000-0000-4000-8000-000000000004",
};
async function actor(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function register(event: string, waitlist = false) {
  return (
    await db.query<{ id: string; status: string; qr_token: string }>(
      "select * from public.register_for_event($1,$2)",
      [event, waitlist],
    )
  ).rows[0];
}
let firstToken = "",
  promotedToken = "",
  otherToken = "";
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant all on storage.objects to authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;`);
  // gen_random_uuid is built into PostgreSQL. Supabase installs pgcrypto; PGlite omits that extension declaration.
  await db.exec(
    readFileSync(new URL("./schema.sql", import.meta.url), "utf8").replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  for (const [name, id] of Object.entries(ids).filter(([name]) =>
    ["admin", "a", "b", "c"].includes(name),
  ))
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id,
        name + "@usc.edu.ph",
        JSON.stringify({ full_name: name, student_id: name, role: "admin" }),
      ],
    );
  await db.query("update public.profiles set role='admin' where id=$1", [
    ids.admin,
  ]);
  for (const [id, start, end, deadline] of [
    [ids.event, "1 hour", "4 hours", "30 minutes"],
    [ids.future, "3 days", "3 days 4 hours", "2 days"],
    [ids.past, "-2 days", "-1 day", "-3 days"],
    [ids.other, "1 hour", "4 hours", "30 minutes"],
  ])
    await db.query(
      `insert into public.events(id,title,description,category,venue,start_time,end_time,capacity,registration_deadline,created_by) values($1,'Campus Meetup','A welcoming campus event.','Academic','Talamban',now()+$2::interval,now()+$3::interval,1,now()+$4::interval,$5)`,
      [id, start, end, deadline, ids.admin],
    );
  await db.exec(
    readFileSync(
      new URL(
        "./migrations/202611190001_organizations_leadership.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "./migrations/202611190002_event_registration_forms.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "./migrations/202611190003_organization_join_requests.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "./migrations/202611190004_promote_waitlist_on_capacity_increase.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe.sequential("Supabase schema and authorization", () => {
  it("ignores signup role metadata and denies self-promotion", async () => {
    await actor(ids.a);
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.profiles where id=$1",
          [ids.a],
        )
      ).rows[0].role,
    ).toBe("student");
    await expect(
      db.query("update public.profiles set role='admin' where id=$1", [ids.a]),
    ).rejects.toThrow("permission denied");
  });
  it("limits students to their own profile and blocks event creation", async () => {
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query(
        `insert into public.events(title,description,category,venue,start_time,end_time,capacity,registration_deadline,created_by) values('Bad event','Invalid student event.','Sports','Court',now()+interval '1 day',now()+interval '2 days',20,now(),$1)`,
        [ids.a],
      ),
    ).rejects.toThrow("row-level security");
  });
  it("allocates the final seat and rejects direct registration writes", async () => {
    const r = await register(ids.event);
    firstToken = r.qr_token;
    expect(r.status).toBe("registered");
    await expect(
      db.query(
        "insert into public.registrations(event_id,user_id) values($1,$2)",
        [ids.future, ids.a],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("rejects duplicate registration", async () => {
    await expect(register(ids.event)).rejects.toThrow("already registered");
  });
  it("provides anonymous aggregate counts without student records", async () => {
    await actor(null, "anon");
    expect(
      (
        await db.query<{ filled: number }>(
          "select * from public.event_counts() where event_id=$1",
          [ids.event],
        )
      ).rows[0].filled,
    ).toBe(1);
    await expect(
      db.query("select * from public.registrations"),
    ).rejects.toThrow("permission denied");
  });
  it("blocks overbooking and explicitly permits waitlisting", async () => {
    await actor(ids.b);
    await expect(register(ids.event)).rejects.toThrow("full");
    expect((await register(ids.event, true)).status).toBe("waitlisted");
  });
  it("cancels and promotes the next student, rotating ticket tokens", async () => {
    await actor(ids.a);
    await db.query("select public.cancel_registration($1)", [ids.event]);
    const cancelled = (
      await db.query<{ status: string; qr_token: string }>(
        "select * from public.registrations where event_id=$1",
        [ids.event],
      )
    ).rows[0];
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.qr_token).not.toBe(firstToken);
    await actor(ids.b);
    const promoted = (
      await db.query<{ status: string; qr_token: string }>(
        "select * from public.registrations where event_id=$1",
        [ids.event],
      )
    ).rows[0];
    expect(promoted.status).toBe("registered");
    promotedToken = promoted.qr_token;
  });
  it("denies students access to check-in functions and other tickets", async () => {
    expect(
      (await db.query("select * from public.registrations")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select public.check_in($1,$2)", [ids.event, promotedToken]),
    ).rejects.toThrow("Organizer access");
  });
  it("rejects wrong-event tickets and check-in outside the opening window", async () => {
    await actor(ids.c);
    otherToken = (await register(ids.other)).qr_token;
    await actor(ids.admin);
    await expect(
      db.query("select public.check_in($1,$2)", [ids.event, otherToken]),
    ).rejects.toThrow("invalid");
    await expect(
      db.query("select public.check_in($1,$2)", [ids.future, promotedToken]),
    ).rejects.toThrow("two hours");
  });
  it("checks in a valid ticket once and rejects replay", async () => {
    const a = await db.query("select * from public.check_in($1,$2)", [
      ids.event,
      promotedToken,
    ]);
    expect(a.rows).toHaveLength(1);
    await expect(
      db.query("select public.check_in($1,$2)", [ids.event, promotedToken]),
    ).rejects.toThrow("already checked in");
  });
  it("prevents cancellation after attendance and registration after the deadline", async () => {
    await actor(ids.b);
    await expect(
      db.query("select public.cancel_registration($1)", [ids.event]),
    ).rejects.toThrow("attended");
    await expect(register(ids.past)).rejects.toThrow("closed");
  });
  it("protects confirmed seats against reducing capacity", async () => {
    await actor(ids.admin);
    await expect(
      db.query("update public.events set capacity=0 where id=$1", [ids.event]),
    ).rejects.toThrow("Capacity cannot");
  });
  it("scopes event announcements to active registrants and organizers", async () => {
    await db.query(
      "insert into public.announcements(title,body,event_id,created_by) values('Event update','A registered student update.',$1,$2),('Global update','An update for everyone.',null,$2)",
      [ids.event, ids.admin],
    );
    await actor(ids.a);
    expect(
      (await db.query("select * from public.announcements")).rows,
    ).toHaveLength(1);
    await actor(ids.b);
    expect(
      (await db.query("select * from public.announcements")).rows,
    ).toHaveLength(2);
  });
  it("allows avatar uploads only within the authenticated user’s folder", async () => {
    await actor(ids.a);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('avatars',$1)",
      [ids.a + "/photo.jpg"],
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('avatars',$1)",
        [ids.b + "/photo.jpg"],
      ),
    ).rejects.toThrow("row-level security");
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('event-banners','bad.jpg')",
      ),
    ).rejects.toThrow("row-level security");
  });
  it("cascades deleted events into registration and attendance records", async () => {
    await actor(ids.admin);
    await db.query("select public.check_in($1,$2)", [ids.other, otherToken]);
    await db.query("delete from public.events where id=$1", [ids.other]);
    await db.exec("reset role");
    expect(
      (
        await db.query("select * from public.registrations where event_id=$1", [
          ids.other,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.attendance")).rows,
    ).toHaveLength(1);
  });
});

describe.sequential(
  "organization leadership and persistent notifications",
  () => {
    let org: string, otherOrg: string, ownEvent: string, outsideEvent: string;
    let nomination: string;
    const today = "((now() at time zone 'Asia/Manila')::date)";
    async function createEvent(organization: string) {
      return (
        await db.query<{ id: string }>(
          `insert into public.events(organization_id,title,description,category,venue,start_time,end_time,capacity,registration_deadline,created_by)
      values($1,'Organization workshop','A hands-on workshop for students.','Academic','Campus room',now()+interval '1 hour',
        now()+interval '2 hours',1,now()+interval '30 minutes',auth.uid()) returning id`,
          [organization],
        )
      ).rows[0].id;
    }
    async function appoint(student: string, start: number, end: number) {
      return db.query(
        `select * from public.appoint_leader($1,$2,'President',${today}+$3::int,${today}+$4::int)`,
        [org, student, start, end],
      );
    }
    async function nominate(student: string) {
      return (
        await db.query<{ id: string }>(
          `select * from public.nominate_leader($1,$2,'Secretary',${today},${today}+30,'Experienced volunteer')`,
          [org, student],
        )
      ).rows[0].id;
    }
    async function noticeCount(type: string) {
      return (
        await db.query("select id from public.notifications where type=$1", [
          type,
        ])
      ).rows.length;
    }
    it("preserves legacy links, requires an admin to create organizations, and restricts terms", async () => {
      await actor(ids.a);
      await expect(
        db.query(
          "select public.save_organization(null,'CIS Council','','','')",
        ),
      ).rejects.toThrow("admin");
      await expect(
        db.query(
          "select * from public.find_leadership_students(null,'Student')",
        ),
      ).rejects.toThrow("access");
      await actor(ids.admin);
      expect(
        (
          await db.query(
            "select * from public.events where organization_id is null",
          )
        ).rows.length,
      ).toBeGreaterThan(0);
      expect(
        (await db.query("select * from public.profiles")).rows,
      ).toHaveLength(1);
      for (const name of ["CIS Council", "Culture Council"]) {
        const { rows } = await db.query<{ id: string }>(
          "select * from public.save_organization(null,$1,'','','')",
          [name],
        );
        if (name === "CIS Council") org = rows[0].id;
        else otherOrg = rows[0].id;
      }
      ownEvent = await createEvent(org);
      outsideEvent = await createEvent(otherOrg);
      await appoint(ids.a, 1, 30);
      await actor(ids.a);
      await expect(createEvent(org)).rejects.toThrow("row-level security");
      await actor(ids.admin);
      await appoint(ids.a, -30, -1);
      await actor(ids.a);
      await expect(createEvent(org)).rejects.toThrow("row-level security");
      await actor(ids.admin);
      await appoint(ids.a, -1, 30);
      await appoint(ids.a, -1, 30);
      await actor(ids.a);
      expect(await noticeCount("appointed")).toBe(2);
    });

    it("limits organizer access to their own event and keeps private profiles and QR tokens out of the roster", async () => {
      await actor(ids.b);
      const ticket = await register(ownEvent);
      await register(outsideEvent);
      await actor(ids.a);
      expect(
        (await db.query("select * from public.registrations")).rows.map(
          (r) => r.user_id,
        ),
      ).not.toContain(ids.b);
      const roster = (
        await db.query("select * from public.managed_registrations()")
      ).rows;
      expect(roster.map((r) => r.event_id)).toEqual([ownEvent]);
      expect(roster[0]).not.toHaveProperty("qr_token");
      expect(
        (await db.query("select * from public.profiles where id=$1", [ids.b]))
          .rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select * from public.find_leadership_students($1,'b@usc.edu.ph')",
            [org],
          )
        ).rows,
      ).toHaveLength(0);
      const event = await createEvent(org);
      await expect(createEvent(otherOrg)).rejects.toThrow("row-level security");
      await expect(
        db.query("update public.events set organization_id=$1 where id=$2", [
          otherOrg,
          event,
        ]),
      ).rejects.toThrow("Only university admins");
      const denied = await db.query(
        "update public.events set venue='Other venue' where id=$1 returning id",
        [outsideEvent],
      );
      expect(denied.rows).toHaveLength(0);
      await expect(
        db.query("select public.check_in($1,$2)", [
          outsideEvent,
          ticket.qr_token,
        ]),
      ).rejects.toThrow("Organizer access");
      await expect(
        db.query("select public.cancel_managed_registration($1,$2)", [
          outsideEvent,
          ids.b,
        ]),
      ).rejects.toThrow("Organizer access");
      const checkIn = await db.query(
        "select * from public.check_in_registration($1,$2)",
        [ownEvent, ticket.id],
      );
      expect(checkIn.rows).toHaveLength(1);
      await expect(
        db.query("select public.check_in($1,$2)", [ownEvent, ticket.qr_token]),
      ).rejects.toThrow("already checked in");
      await db.query(
        "insert into public.announcements(title,body,organization_id,created_by) values('Leader update','Only for organization members',$1,auth.uid())",
        [org],
      );
      await expect(
        db.query(
          "insert into public.announcements(title,body,created_by) values('Campus update','A campus-wide announcement',auth.uid())",
        ),
      ).rejects.toThrow("row-level security");
    });

    it("prevents duplicate pending nominations and grants access only after admin approval", async () => {
      await actor(ids.a);
      nomination = await nominate(ids.b);
      await expect(nominate(ids.b)).rejects.toThrow("already pending");
      await expect(
        db.query("select public.review_leadership_nomination($1,true,'')", [
          nomination,
        ]),
      ).rejects.toThrow("admin");
      await expect(appoint(ids.b, 0, 30)).rejects.toThrow("admin");
      await actor(ids.b);
      expect(await noticeCount("nominated")).toBe(1);
      await expect(createEvent(org)).rejects.toThrow("row-level security");
      expect(
        (await db.query("select * from public.organization_memberships")).rows,
      ).toHaveLength(0);
      await actor(ids.admin);
      expect(await noticeCount("nomination_review")).toBe(1);
      await db.query(
        "select public.review_leadership_nomination($1,true,'Verified by Student Affairs')",
        [nomination],
      );
      await db.query(
        "select public.review_leadership_nomination($1,true,'Verified by Student Affairs')",
        [nomination],
      );
      await actor(ids.b);
      expect(await noticeCount("nomination_approved")).toBe(1);
      expect(
        (
          await db.query(
            "select message from public.notifications where type='nomination_approved'",
          )
        ).rows[0].message,
      ).toContain("Verified by Student Affairs");
      await createEvent(org);
      await expect(createEvent(otherOrg)).rejects.toThrow("row-level security");
    });

    it("records rejection and revocation once and immediately removes scoped access", async () => {
      await actor(ids.a);
      const rejected = await nominate(ids.c);
      await actor(ids.admin);
      await expect(
        db.query("select public.review_leadership_nomination($1,false,'')", [
          rejected,
        ]),
      ).rejects.toThrow("rejection reason");
      await db.query(
        "select public.review_leadership_nomination($1,false,'Term does not match the election')",
        [rejected],
      );
      await db.query("select public.revoke_leader($1,$2)", [org, ids.b]);
      await db.query("select public.revoke_leader($1,$2)", [org, ids.b]);
      expect(
        (
          await db.query(
            "select distinct action from public.leadership_history",
          )
        ).rows.map((row) => row.action),
      ).toEqual(
        expect.arrayContaining([
          "appointed",
          "term_changed",
          "nominated",
          "approved",
          "rejected",
          "revoked",
        ]),
      );
      await actor(ids.c);
      expect(await noticeCount("nomination_rejected")).toBe(1);
      await expect(createEvent(org)).rejects.toThrow("row-level security");
      await actor(ids.b);
      expect(await noticeCount("revoked")).toBe(1);
      await expect(createEvent(org)).rejects.toThrow("row-level security");
      await expect(
        db.query("update public.organization_memberships set revoked_at=null"),
      ).rejects.toThrow("permission denied");
    });

    it("generates waitlist, promotion, change and cancellation notices transactionally and protects read state", async () => {
      await actor(ids.a);
      const event = await createEvent(org);
      await actor(ids.b);
      await register(event);
      await actor(ids.c);
      const waitlisted = await register(event, true);
      expect(waitlisted.status).toBe("waitlisted");
      await expect(register(event, true)).rejects.toThrow("already registered");
      const notice = (
        await db.query<{ id: string }>(
          "select id from public.notifications where event_id=$1 and type='waitlisted'",
          [event],
        )
      ).rows[0];
      expect(notice).toBeTruthy();
      await db.query("select public.mark_notification_read($1,false)", [
        notice.id,
      ]);
      await actor(ids.a);
      await db.query("select public.cancel_managed_registration($1,$2)", [
        event,
        ids.b,
      ]);
      await db.query("select public.cancel_managed_registration($1,$2)", [
        event,
        ids.b,
      ]);
      await db.query(
        "update public.events set venue='Another venue' where id=$1",
        [event],
      );
      await db.query(
        "update public.events set venue='Another venue' where id=$1",
        [event],
      );
      expect(
        (
          await db.query("select * from public.notifications where id=$1", [
            notice.id,
          ])
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into public.notifications(recipient_id,type,title,message,destination) values($1,'fake','fake','fake','/')",
          [ids.a],
        ),
      ).rejects.toThrow("permission denied");
      await actor(ids.c);
      const rows = (
        await db.query(
          "select * from public.notifications where event_id=$1 order by created_at",
          [event],
        )
      ).rows;
      expect(rows.map((row) => row.type)).toEqual([
        "waitlisted",
        "waitlist_promoted",
        "event_changed",
      ]);
      expect(rows[0].read_at).toBeTruthy();
      expect(JSON.stringify(rows)).not.toContain(waitlisted.qr_token);
      await actor(ids.b);
      expect(await noticeCount("registration_cancelled")).toBe(1);
      await actor(ids.admin);
      await db.query("select public.archive_organization($1)", [org]);
      await db.query("select public.archive_organization($1)", [org]);
      await actor(ids.a);
      expect(await noticeCount("organization_archived")).toBe(1);
      await expect(createEvent(org)).rejects.toThrow(
        /archived|row-level security/,
      );
      await actor(ids.c);
      const cancellation = (
        await db.query(
          "select * from public.notifications where event_id=$1 and type='event_cancelled'",
          [event],
        )
      ).rows;
      expect(cancellation).toHaveLength(1);
      await expect(register(event)).rejects.toThrow("closed");
      expect(
        (
          await db.query(
            "select * from public.registrations where event_id=$1",
            [event],
          )
        ).rows,
      ).toHaveLength(1);
    });

    it("persists announcement receipts without exposing them to another account", async () => {
      await actor(ids.a);
      await db.query("select public.mark_notification_read(null,false)");
      expect(
        (await db.query("select * from public.announcement_reads")).rows.length,
      ).toBeGreaterThan(0);
      await actor(ids.b);
      expect(
        (await db.query("select * from public.announcement_reads")).rows,
      ).toHaveLength(0);
      await actor(ids.a);
      expect(
        (await db.query("select * from public.announcement_reads")).rows.length,
      ).toBeGreaterThan(0);
    });
  },
);

it("requires confirmation of the current event form for both seats and waitlists", async () => {
  const url = "https://forms.gle/campus-event";
  await actor(ids.admin);
  const {
    rows: [event],
  } = await db.query<{ id: string }>(
    `insert into public.events(title,description,category,venue,start_time,end_time,capacity,registration_deadline,created_by,registration_form_url,registration_form_required)
       values('Campus Form Meetup','A campus event with a form.','Academic','Talamban',now()+interval '2 days',now()+interval '3 days',1,now()+interval '1 day',$1,$2,true)
       returning id`,
    [ids.admin, url],
  );
  await expect(
    db.query(
      "update public.events set registration_form_url=null where id=$1",
      [event.id],
    ),
  ).rejects.toThrow("events_registration_form_required_check");
  await expect(
    db.query(
      "update public.events set registration_form_url='javascript:alert(1)' where id=$1",
      [event.id],
    ),
  ).rejects.toThrow("events_registration_form_url_check");
  const confirm = (waitlist: boolean, confirmedUrl: string) =>
    db.query<{ status: string }>(
      "select status from public.register_for_event($1,$2,$3)",
      [event.id, waitlist, confirmedUrl],
    );

  await actor(ids.a);
  await expect(register(event.id)).rejects.toThrow("Confirm you submitted");
  await expect(confirm(false, "https://forms.gle/old")).rejects.toThrow(
    "Confirm you submitted",
  );
  expect((await confirm(false, url)).rows[0].status).toBe("registered");

  await actor(ids.b);
  await expect(register(event.id, true)).rejects.toThrow(
    "Confirm you submitted",
  );
  expect((await confirm(true, url)).rows[0].status).toBe("waitlisted");

  await actor(ids.admin);
  await db.query(
    "update public.events set registration_form_required=false where id=$1",
    [event.id],
  );
  await actor(ids.c);
  expect((await register(event.id, true)).status).toBe("waitlisted");
});

it("keeps organization requests private until a scoped reviewer decides them", async () => {
  const applicant = "00000000-0000-4000-8000-000000000005";
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [
      applicant,
      "requester@example.test",
      JSON.stringify({
        full_name: "Join Test Student",
        student_id: "join-test",
        organization: "Fake",
      }),
    ],
  );
  expect(
    (
      await db.query("select organization from public.profiles where id=$1", [
        applicant,
      ])
    ).rows[0],
  ).toMatchObject({ organization: "" });
  await actor(ids.admin);
  const {
    rows: [org],
  } = await db.query<{ id: string }>(
    "select id from public.save_organization(null,'Membership Test Organization','','','')",
  );
  await db.query(
    "select public.appoint_leader($1,$2,'President',current_date-1,current_date+2)",
    [org.id, ids.a],
  );

  await actor(applicant);
  await expect(
    db.query("update public.profiles set organization='Fake' where id=$1", [
      applicant,
    ]),
  ).rejects.toThrow("permission denied");
  await db.query("select public.request_organization_membership($1)", [org.id]);
  await db.query("select public.request_organization_membership($1)", [org.id]);
  const {
    rows: [request],
  } = await db.query<{ id: string; status: string }>(
    "select * from public.list_organization_join_requests()",
  );
  expect(request.status).toBe("pending");
  expect(
    (await db.query("select * from public.organization_memberships")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("update public.organization_join_requests set status='approved'"),
  ).rejects.toThrow("permission denied");

  await actor(ids.b);
  expect(
    (await db.query("select * from public.list_organization_join_requests()"))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.review_organization_join_request($1,true)", [
      request.id,
    ]),
  ).rejects.toThrow("Active leadership");
  await actor(ids.a);
  expect(
    (await db.query("select * from public.list_organization_join_requests()"))
      .rows[0],
  ).toMatchObject({
    id: request.id,
    applicant_name: "Join Test Student",
    applicant_student_id: "join-test",
  });
  await db.query("select public.review_organization_join_request($1,false)", [
    request.id,
  ]);
  await actor(applicant);
  expect(
    (
      await db.query(
        "select status from public.list_organization_join_requests()",
      )
    ).rows,
  ).toEqual([{ status: "rejected" }]);
  await db.query("select public.request_organization_membership($1)", [org.id]);

  await actor(ids.a);
  await db.query("select public.review_organization_join_request($1,true)", [
    request.id,
  ]);
  await expect(
    db.query("select public.review_organization_join_request($1,true)", [
      request.id,
    ]),
  ).rejects.toThrow("already been decided");
  await actor(applicant);
  expect(
    (
      await db.query(
        "select organization_id,role from public.organization_memberships",
      )
    ).rows,
  ).toEqual([{ organization_id: org.id, role: "member" }]);
  expect(
    (
      await db.query(
        "select status from public.list_organization_join_requests()",
      )
    ).rows,
  ).toEqual([{ status: "approved" }]);
  expect(
    (
      await db.query(
        "select type from public.notifications where type='organization_join_approved'",
      )
    ).rows,
  ).toHaveLength(1);
});

it("seeds presentation data without duplicating or replacing existing records", async () => {
  await db.exec("reset role");
  const seed = readFileSync(
    new URL("./demo_seed.sql", import.meta.url),
    "utf8",
  );
  await db.exec(seed);
  const sampleId = "de000002-0000-4000-8000-000000000001";
  await db.exec(`
    update public.organizations set name='DEMO: Technology Circle'
      where id='de000001-0000-4000-8000-000000000001';
    update public.events set title='DEMO: Campus Web Design Lab',description='Original sample description.',venue='Existing venue'
      where id='de000002-0000-4000-8000-000000000001';
    update public.announcements set title='DEMO: Welcome to CampusConnect'
      where id='de000003-0000-4000-8000-000000000001';
  `);
  const before = (
    await db.query(
      "select start_time,end_time,registration_deadline,venue from public.events where id=$1",
      [sampleId],
    )
  ).rows[0];
  await db.exec(seed);
  await db.exec(seed);
  const refreshed = (
    await db.query(
      "select title,description,organization,start_time,end_time,registration_deadline,venue from public.events where id=$1",
      [sampleId],
    )
  ).rows[0];
  expect(refreshed).toMatchObject({
    ...before,
    title: "Campus Web Design Lab",
    organization: "Technology Circle",
    description: expect.stringContaining("What to bring"),
  });
  expect(
    (
      await db.query(
        "select id from public.organizations where id::text like 'de000001-%' and name not like 'DEMO:%'",
      )
    ).rows,
  ).toHaveLength(3);
  expect(
    (
      await db.query(
        "select id from public.events where id::text like 'de000002-%' and title not like 'DEMO:%' and organization_id is not null and registration_deadline > now()",
      )
    ).rows,
  ).toHaveLength(6);
  expect(
    (
      await db.query(
        "select id from public.announcements where id='de000003-0000-4000-8000-000000000001' and title='Welcome to CampusConnect'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select id from public.events where id=$1", [ids.event]))
      .rows,
  ).toHaveLength(1);
});

it("fills added capacity from the front of the waitlist while registration is open", async () => {
  await actor(ids.admin);
  const {
    rows: [event],
  } = await db.query<{ id: string }>(
    `
    insert into public.events(title,description,category,venue,start_time,end_time,capacity,registration_deadline,created_by)
    values ('Added seats','An event for testing new seats.','Academic','Talamban',now()+interval '1 day',now()+interval '2 days',1,now()+interval '1 hour',$1)
    returning id
  `,
    [ids.admin],
  );
  const confirmed = await register(event.id);
  const queued = [];
  for (const student of [ids.a, ids.b, ids.c]) {
    await actor(student);
    queued.push(await register(event.id, true));
  }

  await db.exec("reset role");
  for (const [index, registration] of queued.entries()) {
    await db.query(
      "update public.registrations set created_at=now()+$2::interval where id=$1",
      [registration.id, index - 3 + " minutes"],
    );
  }
  await actor(ids.admin);
  await db.query("update public.events set capacity=3 where id=$1", [event.id]);
  await actor(ids.a);
  const readOwnSeat = async () =>
    (
      await db.query<{ status: string; qr_token: string }>(
        "select status,qr_token from public.registrations where event_id=$1",
        [event.id],
      )
    ).rows[0];
  const promotionNotices = async () =>
    (
      await db.query(
        "select id from public.notifications where event_id=$1 and type='waitlist_promoted'",
        [event.id],
      )
    ).rows;
  for (const [index, student] of [ids.a, ids.b].entries()) {
    await actor(student);
    const seat = await readOwnSeat();
    expect(seat.status).toBe("registered");
    expect(seat.qr_token).not.toBe(queued[index].qr_token);
    expect(await promotionNotices()).toHaveLength(1);
  }
  await actor(ids.c);
  expect(await readOwnSeat()).toMatchObject({
    status: "waitlisted",
    qr_token: queued[2].qr_token,
  });
  expect(await promotionNotices()).toHaveLength(0);

  await actor(ids.admin);
  expect(await readOwnSeat()).toMatchObject({
    status: "registered",
    qr_token: confirmed.qr_token,
  });
  await db.query(
    "update public.events set capacity=4, registration_deadline=now()-interval '1 minute' where id=$1",
    [event.id],
  );
  await actor(ids.c);
  expect((await readOwnSeat()).status).toBe("waitlisted");
  expect(await promotionNotices()).toHaveLength(0);
});
