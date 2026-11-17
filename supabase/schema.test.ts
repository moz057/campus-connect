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
