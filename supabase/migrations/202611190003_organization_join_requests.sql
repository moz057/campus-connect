begin;

-- Membership is granted through the organization workflow, never profile metadata.
revoke update(organization) on public.profiles from authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,student_id,course)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120),
    nullif(new.raw_user_meta_data->>'student_id',''),
    coalesce(new.raw_user_meta_data->>'course',''));
  return new;
end; $$;

create table public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  applicant_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles on delete set null,
  unique (organization_id,applicant_id)
);
create index organization_join_requests_applicant_idx on public.organization_join_requests(applicant_id);
alter table public.organization_join_requests enable row level security;
revoke all on public.organization_join_requests from public,anon,authenticated;

-- Expose applicant details only to the applicant, a university admin, or a leader of this organization.
create function public.list_organization_join_requests()
returns table (
  id uuid, organization_id uuid, applicant_id uuid, applicant_name text,
  applicant_student_id text, status text, requested_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id,r.organization_id,r.applicant_id,p.full_name,p.student_id,r.status,r.requested_at
  from public.organization_join_requests r
  join public.profiles p on p.id=r.applicant_id
  where r.applicant_id=auth.uid() or public.is_admin() or public.leads_organization(r.organization_id);
$$;

create function public.request_organization_membership(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare org public.organizations; applicant uuid := auth.uid(); request_id uuid;
begin
  if not exists(select 1 from public.profiles where id=applicant and role='student') then
    raise exception 'A student account is required to join an organization.';
  end if;
  select * into org from public.organizations where id=p_org for update;
  if not found or org.archived_at is not null then
    raise exception 'This organization is unavailable.';
  end if;
  if exists(select 1 from public.organization_memberships where organization_id=org.id and student_id=applicant) then
    raise exception 'You already belong to this organization.';
  end if;

  insert into public.organization_join_requests(organization_id,applicant_id)
  values(org.id,applicant)
  on conflict(organization_id,applicant_id) do update
    set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null
    where public.organization_join_requests.status='rejected'
  returning id into request_id;
  if request_id is null then return; end if;

  perform public.add_notification(m.student_id,'organization_join_requested','New organization join request',
    org.name || ' has a membership request to review.','/leadership',org.id)
  from public.organization_memberships m
  where m.organization_id=org.id and m.role='leader' and m.revoked_at is null
    and (statement_timestamp() at time zone 'Asia/Manila')::date between m.term_start and m.term_end;
end; $$;

create function public.review_organization_join_request(p_request uuid,p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare org public.organizations; request public.organization_join_requests; reviewer uuid := auth.uid();
begin
  select o.* into org from public.organizations o
  join public.organization_join_requests r on r.organization_id=o.id
  where r.id=p_request for update of o;
  if not found or org.archived_at is not null
    or not (public.is_admin() or public.leads_organization(org.id)) then
    raise exception 'Active leadership or university admin access for this organization is required.';
  end if;
  select * into request from public.organization_join_requests where id=p_request for update;
  if not found or request.status <> 'pending' then
    raise exception 'This request has already been decided or is unavailable.';
  end if;
  if p_approve is null then raise exception 'Choose whether to approve or reject the request.'; end if;

  if p_approve then
    if not exists(select 1 from public.profiles where id=request.applicant_id and role='student') then
      raise exception 'The applicant no longer has a student account.';
    end if;
    insert into public.organization_memberships(organization_id,student_id,role)
    values(org.id,request.applicant_id,'member')
    on conflict(organization_id,student_id) do nothing;
  end if;

  update public.organization_join_requests
  set status=case when p_approve then 'approved' else 'rejected' end,
      reviewed_at=now(),reviewed_by=reviewer
  where id=request.id;

  perform public.add_notification(request.applicant_id,
    case when p_approve then 'organization_join_approved' else 'organization_join_rejected' end,
    case when p_approve then 'Organization join request approved' else 'Organization join request declined' end,
    org.name,'/organizations/' || org.id,org.id);
end; $$;

revoke all on function public.list_organization_join_requests(),public.request_organization_membership(uuid),
  public.review_organization_join_request(uuid,boolean) from public,anon,authenticated;
grant execute on function public.list_organization_join_requests(),public.request_organization_membership(uuid),
  public.review_organization_join_request(uuid,boolean) to authenticated;

commit;
