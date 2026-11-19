-- CampusConnect · run once in a new Supabase project's SQL Editor.
-- Authorization is enforced in PostgreSQL, including atomic capacity allocation.
-- After the baseline, apply the files in supabase/migrations in filename order.
begin;
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  student_id text unique,
  course text not null default '',
  year_level integer check (year_level between 1 and 6),
  organization text not null default '',
  avatar_url text,
  role text not null default 'student' check (role in ('student','admin'))
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 10 and 10000),
  category text not null,
  organization text not null default 'University of San Carlos',
  venue text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  banner_url text,
  capacity integer not null check (capacity between 1 and 100000),
  registration_deadline timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (registration_deadline <= start_time)
);
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','waitlisted','cancelled')),
  qr_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique(event_id,user_id)
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.profiles(id) on delete set null
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 3 and 5000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_start_idx on public.events(start_time);
create index registrations_user_idx on public.registrations(user_id);
create index registrations_capacity_idx on public.registrations(event_id,status,created_at);
create index announcements_date_idx on public.announcements(created_at desc);

-- A client cannot self-assign admin privileges, including through signup metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,student_id,course,year_level,organization)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120),
    nullif(new.raw_user_meta_data->>'student_id',''),
    coalesce(new.raw_user_meta_data->>'course',''),null,
    coalesce(new.raw_user_meta_data->>'organization',''));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.handle_new_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.attendance enable row level security;
alter table public.announcements enable row level security;

create policy profile_read on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
create policy profile_edit on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy event_read on public.events for select to anon,authenticated using (true);
create policy event_create on public.events for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());
create policy event_edit on public.events for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy event_delete on public.events for delete to authenticated using (public.is_admin());
create policy registration_read on public.registrations for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy attendance_read on public.attendance for select to authenticated
using (public.is_admin() or exists(select 1 from public.registrations r
  where r.id = registration_id and r.user_id = auth.uid()));
create policy announcement_read on public.announcements for select to authenticated
using (event_id is null or public.is_admin() or exists(select 1 from public.registrations r
  where r.event_id = announcements.event_id and r.user_id = auth.uid() and r.status <> 'cancelled'));
create policy announcement_create on public.announcements for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());
create policy announcement_edit on public.announcements for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy announcement_delete on public.announcements for delete to authenticated using (public.is_admin());

-- Column grants stop users changing their role even though they own the profile.
revoke all on public.profiles,public.events,public.registrations,public.attendance,public.announcements from anon,authenticated;
grant select on public.events to anon,authenticated;
grant select on public.profiles,public.registrations,public.attendance,public.announcements to authenticated;
grant update(full_name,student_id,course,year_level,organization,avatar_url) on public.profiles to authenticated;
grant insert,update,delete on public.events,public.announcements to authenticated;

-- Public aggregate exposes seat counts without exposing student data or QR tokens.
create function public.event_counts() returns table(event_id uuid,filled bigint,waitlisted bigint)
language sql stable security definer set search_path = '' as $$
select e.id,count(r.id) filter(where r.status='registered'),count(r.id) filter(where r.status='waitlisted')
from public.events e left join public.registrations r on r.event_id=e.id group by e.id;
$$;

-- All competing registrations/cancellations lock the same event row first.
create function public.register_for_event(p_event_id uuid,p_waitlist boolean default false)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.registrations; occupied bigint; desired text;
begin
  if auth.uid() is null then raise exception 'Please log in to register.'; end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if now() >= e.registration_deadline or now() >= e.start_time then raise exception 'Registration has closed.'; end if;
  select * into r from public.registrations where event_id=e.id and user_id=auth.uid();
  if found and r.status <> 'cancelled' then raise exception 'You already registered for this event.'; end if;
  select count(*) into occupied from public.registrations where event_id=e.id and status='registered';
  desired := 'registered';
  if occupied >= e.capacity then
    if not p_waitlist then raise exception 'This event is full. You can join the waitlist.'; end if;
    desired := 'waitlisted';
  end if;
  insert into public.registrations(event_id,user_id,status) values(e.id,auth.uid(),desired)
  on conflict(event_id,user_id) do update set status=excluded.status,qr_token=gen_random_uuid(),created_at=now()
  returning * into r;
  return r;
end; $$;

create function public.cancel_registration(p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.registrations; promoted uuid;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if now() >= e.start_time then raise exception 'An event that has started cannot be cancelled.'; end if;
  select * into r from public.registrations where event_id=e.id and user_id=auth.uid() for update;
  if not found or r.status='cancelled' then raise exception 'Active registration not found.'; end if;
  if exists(select 1 from public.attendance where registration_id=r.id) then raise exception 'An attended registration cannot be cancelled.'; end if;
  update public.registrations set status='cancelled',qr_token=gen_random_uuid() where id=r.id;
  if r.status='registered' and now() < e.registration_deadline then
    select id into promoted from public.registrations where event_id=e.id and status='waitlisted' order by created_at,id limit 1;
    update public.registrations set status='registered',qr_token=gen_random_uuid() where id=promoted;
  end if;
end; $$;

create function public.check_in(p_event_id uuid,p_qr_token uuid) returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare r public.registrations; a public.attendance; event_start timestamptz;
begin
  if not public.is_admin() then raise exception 'Organizer access required.'; end if;
  select start_time into event_start from public.events where id=p_event_id;
  if event_start is null then raise exception 'Event not found.'; end if;
  if now() < event_start - interval '2 hours' then raise exception 'Check-in opens two hours before the event.'; end if;
  select * into r from public.registrations where event_id=p_event_id and qr_token=p_qr_token for update;
  if not found or r.status <> 'registered' then raise exception 'This ticket is invalid for this event.'; end if;
  insert into public.attendance(registration_id,checked_in_by) values(r.id,auth.uid())
  on conflict(registration_id) do nothing returning * into a;
  if a.id is null then raise exception 'This student has already checked in.'; end if;
  return a;
end; $$;

-- Prevent lowering capacity below confirmed registrations.
create function public.guard_event_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity < (select count(*) from public.registrations where event_id=new.id and status='registered')
  then raise exception 'Capacity cannot be below confirmed registrations.'; end if;
  return new;
end; $$;
create trigger event_capacity_guard before update of capacity on public.events
for each row execute function public.guard_event_capacity();
revoke all on function public.guard_event_capacity() from public;
revoke all on function public.event_counts() from public;
revoke all on function public.register_for_event(uuid,boolean) from public;
revoke all on function public.cancel_registration(uuid) from public;
revoke all on function public.check_in(uuid,uuid) from public;
grant execute on function public.event_counts() to anon,authenticated;
grant execute on function public.register_for_event(uuid,boolean),public.cancel_registration(uuid),public.check_in(uuid,uuid) to authenticated;

-- Public image buckets; upload/update/delete remain restricted by owner and role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']),
('event-banners','event-banners',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy image_read on storage.objects for select to anon,authenticated using (bucket_id in ('avatars','event-banners'));
create policy avatar_insert on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_update on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy banner_insert on storage.objects for insert to authenticated with check (bucket_id='event-banners' and public.is_admin());
create policy banner_update on storage.objects for update to authenticated using (bucket_id='event-banners' and public.is_admin()) with check (bucket_id='event-banners' and public.is_admin());
create policy banner_delete on storage.objects for delete to authenticated using (bucket_id='event-banners' and public.is_admin());
commit;
