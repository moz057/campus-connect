-- Run once after the original CampusConnect schema. Existing rows remain in place.
begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  logo_url text not null default '',
  faculty_adviser text not null default '' check (char_length(faculty_adviser) <= 160),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index organization_name_unique on public.organizations(lower(trim(name)));

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations,
  student_id uuid not null references public.profiles on delete cascade,
  role text not null check (role in ('member','leader')),
  position text,
  term_start date,
  term_end date,
  appointed_by uuid references public.profiles on delete set null,
  appointed_at timestamptz,
  revoked_by uuid references public.profiles on delete set null,
  revoked_at timestamptz,
  unique (organization_id, student_id),
  check (role = 'member' or (position is not null and term_start is not null and term_end is not null and term_end >= term_start))
);
create index membership_student_idx on public.organization_memberships(student_id, organization_id);

create table public.leadership_nominations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations,
  nominee_id uuid not null references public.profiles on delete cascade,
  nominated_by uuid references public.profiles on delete set null,
  position text not null,
  term_start date not null,
  term_end date not null check (term_end >= term_start),
  explanation text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  reason text
);
create unique index nomination_pending_unique on public.leadership_nominations(organization_id, nominee_id) where status = 'pending';
create index nomination_actor_idx on public.leadership_nominations(nominated_by, nominee_id);

create table public.leadership_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations,
  student_id uuid references public.profiles on delete set null,
  actor_id uuid references public.profiles on delete set null,
  nomination_id uuid references public.leadership_nominations on delete set null,
  action text not null check (action in ('appointed','term_changed','revoked','approved','rejected','nominated')),
  details jsonb not null,
  created_at timestamptz not null default now()
);
create index leadership_history_org_idx on public.leadership_history(organization_id, created_at desc);

alter table public.events add column organization_id uuid references public.organizations,
  add column cancelled_at timestamptz;
create index events_organization_idx on public.events(organization_id);
alter table public.announcements add column organization_id uuid references public.organizations,
  add constraint announcement_audience_check check (event_id is null or organization_id is null);
create index announcements_organization_idx on public.announcements(organization_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  organization_id uuid references public.organizations,
  event_id uuid references public.events on delete set null,
  nomination_id uuid references public.leadership_nominations on delete set null,
  destination text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index notifications_event_idx on public.notifications(event_id);
create index notifications_nomination_idx on public.notifications(nomination_id);

create table public.announcement_reads (
  recipient_id uuid references public.profiles on delete cascade,
  announcement_id uuid references public.announcements on delete cascade,
  read_at timestamptz not null default now(),
  primary key (recipient_id, announcement_id)
);
create index announcement_reads_announcement_idx on public.announcement_reads(announcement_id);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.leadership_nominations enable row level security;
alter table public.leadership_history enable row level security;
alter table public.notifications enable row level security;
alter table public.announcement_reads enable row level security;

create function public.leads_organization(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.organization_id=p_org and m.student_id=auth.uid() and m.role='leader'
      and o.archived_at is null and m.revoked_at is null
      and (statement_timestamp() at time zone 'Asia/Manila')::date between m.term_start and m.term_end
  );
$$;

create function public.can_manage_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events e where e.id=p_event
    and (public.is_admin() or public.leads_organization(e.organization_id)));
$$;

create function public.can_read_announcement(p_event uuid,p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_event is not null then public.can_manage_event(p_event) or exists (
      select 1 from public.registrations where event_id=p_event and user_id=auth.uid() and status <> 'cancelled'
    )
    when p_org is null then true
    else public.is_admin() or exists (select 1 from public.organization_memberships
      where organization_id=p_org and student_id=auth.uid())
  end;
$$;

create policy organization_read on public.organizations for select to anon,authenticated using (true);
create policy membership_read on public.organization_memberships for select to authenticated
using (student_id=auth.uid() or public.is_admin());
create policy nomination_read on public.leadership_nominations for select to authenticated
using (nominee_id=auth.uid() or nominated_by=auth.uid() or public.is_admin());
create policy history_read on public.leadership_history for select to authenticated
using (public.is_admin());
create policy notification_read on public.notifications for select to authenticated using (recipient_id=auth.uid());
create policy announcement_receipt_read on public.announcement_reads for select to authenticated using (recipient_id=auth.uid());

revoke all on public.organizations, public.organization_memberships, public.leadership_nominations,
  public.leadership_history, public.notifications, public.announcement_reads from anon, authenticated;
grant select on public.organizations to anon,authenticated;
grant select on public.organization_memberships,public.leadership_nominations,public.leadership_history,
  public.notifications,public.announcement_reads to authenticated;

drop policy event_create on public.events;
drop policy event_edit on public.events;
drop policy event_delete on public.events;
create policy event_create on public.events for insert to authenticated
with check (created_by=auth.uid() and (public.is_admin() or public.leads_organization(organization_id)));
create policy event_edit on public.events for update to authenticated
using (public.is_admin() or public.leads_organization(organization_id))
with check (public.is_admin() or public.leads_organization(organization_id));
create policy event_delete on public.events for delete to authenticated
using (public.is_admin() or public.leads_organization(organization_id));
revoke update on public.events from authenticated;
grant update(title,description,category,organization,organization_id,venue,start_time,end_time,
  banner_url,capacity,registration_deadline) on public.events to authenticated;

create function public.guard_event_organization() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org public.organizations;
begin
  if tg_op='UPDATE' and new.organization_id is distinct from old.organization_id
    and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only university admins may reassign events.';
  end if;
  if new.organization_id is not null then
    if tg_op='INSERT' or new.organization_id is distinct from old.organization_id then
      select * into org from public.organizations where id=new.organization_id for share;
      if org.archived_at is not null then raise exception 'This organization is archived.'; end if;
    else
      select * into org from public.organizations where id=new.organization_id;
      if org.archived_at is not null and new.cancelled_at is null and new.start_time > now() then
        raise exception 'An archived organization cannot schedule upcoming events.';
      end if;
    end if;
    new.organization := org.name;
  end if;
  return new;
end; $$;
create trigger event_scope_guard before insert or update of organization_id,organization,start_time on public.events
for each row execute function public.guard_event_organization();

drop policy registration_read on public.registrations;
create policy registration_read on public.registrations for select to authenticated using (user_id=auth.uid());
drop policy profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid());
drop policy attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
using (public.is_admin() or exists(select 1 from public.registrations r where r.id=registration_id));

-- Organizer roster excludes QR credentials and unrelated profile fields.
create function public.managed_registrations()
returns table(id uuid,event_id uuid,user_id uuid,status text,created_at timestamptz,
  full_name text,student_id text,course text,year_level integer,attendance_id uuid,
  checked_in_at timestamptz,checked_in_by uuid)
language sql stable security definer set search_path = '' as $$
  select r.id,r.event_id,r.user_id,r.status,r.created_at,p.full_name,p.student_id,p.course,p.year_level,
    a.id,a.checked_in_at,a.checked_in_by
  from public.registrations r join public.profiles p on p.id=r.user_id
  left join public.attendance a on a.registration_id=r.id
  where public.can_manage_event(r.event_id);
$$;

drop policy announcement_read on public.announcements;
drop policy announcement_create on public.announcements;
drop policy announcement_edit on public.announcements;
drop policy announcement_delete on public.announcements;
create policy announcement_read on public.announcements for select to authenticated
using (public.can_read_announcement(event_id,organization_id));
create policy announcement_create on public.announcements for insert to authenticated
with check (created_by=auth.uid() and (public.is_admin() or public.can_manage_event(event_id) or public.leads_organization(organization_id)));
create policy announcement_edit on public.announcements for update to authenticated
using (public.is_admin() or public.can_manage_event(event_id) or public.leads_organization(organization_id))
with check (public.is_admin() or public.can_manage_event(event_id) or public.leads_organization(organization_id));
create policy announcement_delete on public.announcements for delete to authenticated
using (public.is_admin() or public.can_manage_event(event_id) or public.leads_organization(organization_id));
revoke update on public.announcements from authenticated;
grant update(title,body,event_id,organization_id) on public.announcements to authenticated;

create function public.guard_announcement_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.event_id,new.organization_id) is distinct from (old.event_id,old.organization_id)
    and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only university admins may change an announcement audience.';
  end if;
  return new;
end; $$;
create trigger announcement_scope_guard before update of event_id,organization_id on public.announcements
for each row execute function public.guard_announcement_scope();

create function public.can_upload_event_banner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.organization_memberships m where m.student_id=auth.uid()
      and public.leads_organization(m.organization_id)
  );
$$;
drop policy banner_insert on storage.objects;
create policy banner_insert on storage.objects for insert to authenticated with check (
  bucket_id='event-banners' and public.can_upload_event_banner()
    and (storage.foldername(name))[1]=auth.uid()::text
);
-- Existing administrator update/delete controls remain. Leaders upload under their own ID.

create function public.record_event_attendance(p_event uuid,p_ticket uuid,p_registration uuid)
returns public.attendance language plpgsql security definer set search_path = '' as $$
declare r public.registrations; a public.attendance; e public.events;
begin
  if not public.can_manage_event(p_event) then raise exception 'Organizer access required for this event.'; end if;
  select * into e from public.events where id=p_event for update;
  if not found or e.cancelled_at is not null then raise exception 'This event is unavailable.'; end if;
  if now() < e.start_time - interval '2 hours' then raise exception 'Check-in opens two hours before the event.'; end if;
  select * into r from public.registrations where event_id=p_event
    and ((p_registration is null and qr_token=p_ticket) or id=p_registration) for update;
  if not found or r.status <> 'registered' then raise exception 'This ticket is invalid for this event.'; end if;
  insert into public.attendance(registration_id,checked_in_by) values(r.id,auth.uid())
  on conflict(registration_id) do nothing returning * into a;
  if a.id is null then raise exception 'This student has already checked in.'; end if;
  return a;
end; $$;

create or replace function public.check_in(p_event_id uuid,p_qr_token uuid)
returns public.attendance language sql security definer set search_path = '' as $$
  select public.record_event_attendance(p_event_id,p_qr_token,null);
$$;
create function public.check_in_registration(p_event_id uuid,p_registration_id uuid)
returns public.attendance language sql security definer set search_path = '' as $$
  select public.record_event_attendance(p_event_id,null,p_registration_id);
$$;

create function public.add_notification(p_recipient uuid,p_type text,p_title text,p_message text,
  p_destination text,p_org uuid default null,p_event uuid default null,p_nomination uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications(recipient_id,type,title,message,destination,organization_id,event_id,nomination_id)
  select p_recipient,p_type,p_title,p_message,p_destination,p_org,p_event,p_nomination where p_recipient is not null;
$$;

create function public.save_organization(p_org uuid,p_name text,p_description text,p_logo_url text,p_adviser text)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare org public.organizations;
begin
  if not public.is_admin() then raise exception 'University admin access required.'; end if;
  if coalesce(p_logo_url,'') <> '' and p_logo_url !~ '^https?://' then raise exception 'Enter an HTTP or HTTPS logo URL.'; end if;
  if p_org is null then
    insert into public.organizations(name,description,logo_url,faculty_adviser,created_by)
    values(trim(p_name),trim(p_description),trim(p_logo_url),trim(p_adviser),auth.uid()) returning * into org;
  else
    update public.organizations set name=trim(p_name),description=trim(p_description),logo_url=trim(p_logo_url),
      faculty_adviser=trim(p_adviser) where id=p_org returning * into org;
    if not found then raise exception 'Organization not found.'; end if;
  end if;
  return org;
end; $$;

create function public.archive_organization(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare org public.organizations;
begin
  if not public.is_admin() then raise exception 'University admin access required.'; end if;
  update public.organizations set archived_at=now() where id=p_org and archived_at is null returning * into org;
  if not found then return; end if;
  update public.events set cancelled_at=now()
    where organization_id=p_org and start_time > now() and cancelled_at is null;
  perform public.add_notification(m.student_id,'organization_archived','Organization archived',
    org.name || ' was archived. Its upcoming events were cancelled and leadership access has ended.',
    '/organizations/' || org.id,org.id)
  from public.organization_memberships m where m.organization_id=p_org and m.role='leader'
    and m.revoked_at is null and m.term_end >= (now() at time zone 'Asia/Manila')::date;
end; $$;

create function public.find_leadership_students(p_org uuid,p_query text)
returns table(id uuid,full_name text,student_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.leads_organization(p_org)) then
    raise exception 'Organization leadership access required.';
  end if;
  if char_length(trim(coalesce(p_query,''))) < 2 then return; end if;
  return query select p.id,p.full_name,p.student_id from public.profiles p
    where p.role='student' and (strpos(lower(p.full_name),lower(trim(p_query))) > 0
      or strpos(lower(coalesce(p.student_id,'')),lower(trim(p_query))) > 0)
    order by p.full_name,p.id limit 20;
end; $$;

create function public.leadership_people() returns table(id uuid,full_name text,student_id text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.full_name,p.student_id from public.profiles p where p.id=auth.uid()
    or exists(select 1 from public.leadership_nominations n where
      (n.nominee_id=auth.uid() or n.nominated_by=auth.uid() or public.is_admin())
      and p.id in (n.nominee_id,n.nominated_by,n.reviewed_by))
    or (public.is_admin() and (
      exists(select 1 from public.organization_memberships m where p.id=m.student_id)
      or exists(select 1 from public.leadership_history h where p.id in (h.actor_id,h.student_id))
    ));
$$;

create function public.validate_leadership_term(p_org uuid,p_student uuid,p_position text,p_start date,p_end date)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare org public.organizations;
begin
  select * into org from public.organizations where id=p_org for update;
  if not found or org.archived_at is not null then raise exception 'Choose an active organization.'; end if;
  if not exists(select 1 from public.profiles where id=p_student and role='student') then
    raise exception 'Choose a registered student.';
  end if;
  if char_length(trim(coalesce(p_position,''))) not between 2 and 120
    or p_start is null or p_end is null or p_end < p_start then
    raise exception 'Enter a position and valid term dates.';
  end if;
  return org;
end; $$;

create function public.apply_leadership_appointment(p_org uuid,p_student uuid,p_position text,p_start date,p_end date,
  p_nomination uuid default null)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare org public.organizations; previous public.organization_memberships; appointed public.organization_memberships; action_name text;
begin
  if not public.is_admin() then raise exception 'University admin access required.'; end if;
  org := public.validate_leadership_term(p_org,p_student,p_position,p_start,p_end);
  select * into previous from public.organization_memberships where organization_id=p_org and student_id=p_student;
  if previous.role='leader' and previous.revoked_at is null
    and (previous.position,previous.term_start,previous.term_end)=(trim(p_position),p_start,p_end) then
    return previous;
  end if;
  action_name := case when previous.role='leader' and previous.revoked_at is null
    and previous.term_end >= (now() at time zone 'Asia/Manila')::date then 'term_changed' else 'appointed' end;
  insert into public.organization_memberships(organization_id,student_id,role,position,term_start,term_end,appointed_by,appointed_at)
  values(p_org,p_student,'leader',trim(p_position),p_start,p_end,auth.uid(),now())
  on conflict (organization_id,student_id) do update set role='leader',position=excluded.position,
    term_start=excluded.term_start,term_end=excluded.term_end,appointed_by=excluded.appointed_by,
    appointed_at=excluded.appointed_at,revoked_by=null,revoked_at=null
  returning * into appointed;
  insert into public.leadership_history(organization_id,student_id,actor_id,nomination_id,action,details)
  values(p_org,p_student,auth.uid(),p_nomination,action_name,
    jsonb_build_object('previous',to_jsonb(previous),'appointment',to_jsonb(appointed)));
  if p_nomination is null then
    perform public.add_notification(p_student,action_name,
      case when action_name='appointed' then 'Leadership appointment' else 'Leadership appointment updated' end,
      format('%s appointed you as %s for %s through %s.',org.name,appointed.position,p_start,p_end),
      '/organizations/' || org.id,p_org);
  end if;
  return appointed;
end; $$;

create function public.appoint_leader(p_org uuid,p_student uuid,p_position text,p_start date,p_end date)
returns public.organization_memberships language sql security definer set search_path = '' as $$
  select public.apply_leadership_appointment(p_org,p_student,p_position,p_start,p_end);
$$;

create function public.revoke_leader(p_org uuid,p_student uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare membership public.organization_memberships; org public.organizations;
begin
  if not public.is_admin() then raise exception 'University admin access required.'; end if;
  select * into org from public.organizations where id=p_org for update;
  update public.organization_memberships set revoked_at=now(),revoked_by=auth.uid()
    where organization_id=p_org and student_id=p_student and role='leader' and revoked_at is null
    returning * into membership;
  if not found then return; end if;
  insert into public.leadership_history(organization_id,student_id,actor_id,action,details)
  values(p_org,p_student,auth.uid(),'revoked',to_jsonb(membership));
  perform public.add_notification(p_student,'revoked','Leadership appointment revoked',
    'Your leadership access for ' || org.name || ' has ended.','/organizations/' || org.id,p_org);
end; $$;

create function public.nominate_leader(p_org uuid,p_student uuid,p_position text,p_start date,p_end date,p_explanation text)
returns public.leadership_nominations language plpgsql security definer set search_path = '' as $$
declare org public.organizations; nomination public.leadership_nominations;
begin
  if not public.leads_organization(p_org) then raise exception 'Active organization leadership required.'; end if;
  org := public.validate_leadership_term(p_org,p_student,p_position,p_start,p_end);
  if not public.leads_organization(p_org) then raise exception 'Active organization leadership required.'; end if;
  if p_student=auth.uid() then raise exception 'Choose another student.'; end if;
  if char_length(trim(coalesce(p_explanation,''))) not between 3 and 1000 then raise exception 'Enter a short explanation.'; end if;
  if p_end < (now() at time zone 'Asia/Manila')::date then raise exception 'The proposed term has already ended.'; end if;
  if exists(select 1 from public.organization_memberships where organization_id=p_org and student_id=p_student
    and role='leader' and revoked_at is null and term_end >= (now() at time zone 'Asia/Manila')::date) then
    raise exception 'This student already holds a current or scheduled appointment.';
  end if;
  insert into public.leadership_nominations(organization_id,nominee_id,nominated_by,position,term_start,term_end,explanation)
  values(p_org,p_student,auth.uid(),trim(p_position),p_start,p_end,trim(p_explanation))
  on conflict (organization_id,nominee_id) where status='pending' do nothing returning * into nomination;
  if not found then raise exception 'A nomination for this student is already pending.'; end if;
  insert into public.leadership_history(organization_id,student_id,actor_id,nomination_id,action,details)
  values(p_org,p_student,auth.uid(),nomination.id,'nominated',to_jsonb(nomination));
  perform public.add_notification(p_student,'nominated','Leadership nomination pending',
    format('You were nominated as %s for %s. University approval is pending.',nomination.position,org.name),
    '/leadership?nomination=' || nomination.id,p_org,null,nomination.id);
  perform public.add_notification(p.id,'nomination_review','Leadership nomination to review',
    format('%s has a new nomination for %s.',org.name,nomination.position),
    '/admin/organizations?nomination=' || nomination.id,p_org,null,nomination.id)
  from public.profiles p where p.role='admin';
  return nomination;
end; $$;

create function public.review_leadership_nomination(p_id uuid,p_approve boolean,p_reason text default '')
returns public.leadership_nominations language plpgsql security definer set search_path = '' as $$
declare n public.leadership_nominations; org public.organizations; decision text; reason_text text := trim(coalesce(p_reason,''));
begin
  if not public.is_admin() then raise exception 'University admin access required.'; end if;
  select * into n from public.leadership_nominations where id=p_id for update;
  if not found then raise exception 'Nomination not found.'; end if;
  if n.status <> 'pending' then
    if n.status = (case when p_approve then 'approved' else 'rejected' end) and coalesce(n.reason,'')=reason_text then return n; end if;
    raise exception 'This nomination has already been reviewed.';
  end if;
  if p_approve is null or char_length(reason_text)>1000 or (not p_approve and reason_text='') then
    raise exception 'Enter a rejection reason of up to 1,000 characters.';
  end if;
  select * into org from public.organizations where id=n.organization_id for update;
  if p_approve then
    if n.term_end < (now() at time zone 'Asia/Manila')::date then raise exception 'The proposed term has already ended.'; end if;
    if exists(select 1 from public.organization_memberships where organization_id=n.organization_id and student_id=n.nominee_id
      and role='leader' and revoked_at is null and term_end >= (now() at time zone 'Asia/Manila')::date) then
      raise exception 'This student already holds a current or scheduled appointment.';
    end if;
    perform public.apply_leadership_appointment(n.organization_id,n.nominee_id,n.position,n.term_start,n.term_end,n.id);
  end if;
  decision := case when p_approve then 'approved' else 'rejected' end;
  update public.leadership_nominations set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),reason=nullif(reason_text,'')
    where id=n.id returning * into n;
  insert into public.leadership_history(organization_id,student_id,actor_id,nomination_id,action,details)
  values(n.organization_id,n.nominee_id,auth.uid(),n.id,decision,to_jsonb(n));
  perform public.add_notification(recipient,'nomination_' || decision,'Leadership nomination ' || decision,
    format('The nomination for %s at %s was %s.',n.position,org.name,decision) ||
      case when reason_text <> '' then ' Reason: ' || reason_text else '' end,
    '/leadership?nomination=' || n.id,n.organization_id,null,n.id)
  from (select n.nominee_id as recipient union select n.nominated_by) recipients;
  return n;
end; $$;

create function public.mark_notification_read(p_id uuid default null,p_announcement boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if p_id is null or not p_announcement then
    update public.notifications set read_at=now()
      where recipient_id=auth.uid() and read_at is null and (p_id is null or id=p_id);
  end if;
  if p_id is null or p_announcement then
    insert into public.announcement_reads(recipient_id,announcement_id)
      select auth.uid(),a.id from public.announcements a
      where (p_id is null or a.id=p_id) and public.can_read_announcement(a.event_id,a.organization_id)
      on conflict do nothing;
  end if;
end; $$;

create function public.notify_registration_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.events; kind text; heading text;
begin
  if new.status='cancelled' then return new; end if;
  if tg_op='UPDATE' and old.status=new.status then return new; end if;
  select * into e from public.events where id=new.event_id;
  if new.status='waitlisted' then
    kind := 'waitlisted'; heading := 'You joined the waitlist';
  elsif tg_op='UPDATE' and old.status='waitlisted' then
    kind := 'waitlist_promoted'; heading := 'A seat opened for you';
  else
    kind := 'registration_confirmed'; heading := 'Registration confirmed';
  end if;
  perform public.add_notification(new.user_id,kind,heading,e.title,'/events/' || e.id,e.organization_id,e.id);
  return new;
end; $$;
create trigger notify_registration after insert or update of status on public.registrations
for each row execute function public.notify_registration_change();

create function public.notify_event_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text; heading text; summary text; link text;
begin
  if tg_op='DELETE' then
    if old.cancelled_at is not null or old.start_time <= now() then return old; end if;
    kind := 'event_cancelled'; heading := 'Event cancelled'; summary := old.title;
    link := '/registrations';
  elsif old.cancelled_at is null and new.cancelled_at is not null then
    kind := 'event_cancelled'; heading := 'Event cancelled'; summary := old.title;
    link := '/events/' || old.id;
  elsif new.cancelled_at is null and greatest(old.end_time,new.end_time) > now()
    and (old.start_time,old.end_time,old.venue) is distinct from (new.start_time,new.end_time,new.venue) then
    kind := 'event_changed'; heading := 'Event schedule or venue changed';
    summary := new.title || ' · ' || new.venue || ' · ' ||
      to_char(new.start_time at time zone 'Asia/Manila','Mon DD, YYYY HH24:MI') || ' (Manila time)';
    link := '/events/' || old.id;
  else
    return new;
  end if;
  perform public.add_notification(r.user_id,kind,heading,summary,link,old.organization_id,
    case when tg_op='DELETE' then null else old.id end)
  from public.registrations r where r.event_id=old.id and r.status <> 'cancelled';
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger notify_event_update after update of cancelled_at,start_time,end_time,venue on public.events
for each row execute function public.notify_event_change();
create trigger notify_event_delete before delete on public.events
for each row execute function public.notify_event_change();
create or replace function public.register_for_event(p_event_id uuid,p_waitlist boolean default false)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.registrations; occupied bigint; desired text;
begin
  if auth.uid() is null then raise exception 'Please log in to register.'; end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if e.cancelled_at is not null or now() >= e.registration_deadline or now() >= e.start_time then raise exception 'Registration has closed.'; end if;
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

create function public.cancel_event_registration(p_event_id uuid,p_student uuid,p_managed boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.registrations; promoted uuid;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if p_managed and not public.can_manage_event(e.id) then raise exception 'Organizer access required for this event.'; end if;
  if now() >= e.start_time then raise exception 'A registration for an event that has started cannot be cancelled.'; end if;
  select * into r from public.registrations where event_id=e.id and user_id=p_student for update;
  if p_managed and found and r.status='cancelled' then return; end if;
  if not found or r.status='cancelled' then raise exception 'Active registration not found.'; end if;
  if exists(select 1 from public.attendance where registration_id=r.id) then raise exception 'An attended registration cannot be cancelled.'; end if;
  update public.registrations set status='cancelled',qr_token=gen_random_uuid() where id=r.id;
  if r.status='registered' and e.cancelled_at is null and now() < e.registration_deadline then
    select id into promoted from public.registrations where event_id=e.id and status='waitlisted' order by created_at,id limit 1;
    update public.registrations set status='registered',qr_token=gen_random_uuid() where id=promoted;
  end if;
  if p_managed then
    perform public.add_notification(r.user_id,'registration_cancelled','Your registration was cancelled',e.title,
      '/events/' || e.id,e.organization_id,e.id);
  end if;
end; $$;

create or replace function public.cancel_registration(p_event_id uuid) returns void
language sql security definer set search_path = '' as $$
  select public.cancel_event_registration(p_event_id,auth.uid(),false);
$$;
create function public.cancel_managed_registration(p_event_id uuid,p_student uuid) returns void
language sql security definer set search_path = '' as $$
  select public.cancel_event_registration(p_event_id,p_student,true);
$$;


-- Definer functions should never be executable through inherited default grants.
revoke all on function public.leads_organization(uuid),public.can_manage_event(uuid),public.can_read_announcement(uuid,uuid),
  public.guard_event_organization(),public.guard_announcement_scope(),public.managed_registrations(),public.can_upload_event_banner(),
  public.record_event_attendance(uuid,uuid,uuid),public.check_in_registration(uuid,uuid),
  public.add_notification(uuid,text,text,text,text,uuid,uuid,uuid),public.save_organization(uuid,text,text,text,text),
  public.archive_organization(uuid),public.find_leadership_students(uuid,text),public.leadership_people(),public.validate_leadership_term(uuid,uuid,text,date,date),
  public.apply_leadership_appointment(uuid,uuid,text,date,date,uuid),public.appoint_leader(uuid,uuid,text,date,date),
  public.revoke_leader(uuid,uuid),public.nominate_leader(uuid,uuid,text,date,date,text),
  public.review_leadership_nomination(uuid,boolean,text),public.mark_notification_read(uuid,boolean),
  public.notify_registration_change(),public.notify_event_change(),
  public.cancel_event_registration(uuid,uuid,boolean),public.cancel_managed_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.leads_organization(uuid),public.can_manage_event(uuid),public.can_read_announcement(uuid,uuid),
  public.managed_registrations(),public.can_upload_event_banner(),public.check_in_registration(uuid,uuid),
  public.save_organization(uuid,text,text,text,text),public.archive_organization(uuid),public.find_leadership_students(uuid,text),public.leadership_people(),
  public.appoint_leader(uuid,uuid,text,date,date),public.revoke_leader(uuid,uuid),
  public.nominate_leader(uuid,uuid,text,date,date,text),public.review_leadership_nomination(uuid,boolean,text),
  public.mark_notification_read(uuid,boolean),public.cancel_managed_registration(uuid,uuid) to authenticated;

commit;
