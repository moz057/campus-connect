begin;

alter table public.events
  add column registration_form_url text,
  add column registration_form_required boolean not null default false,
  add constraint events_registration_form_url_check check (
    registration_form_url is null or (
      char_length(registration_form_url) <= 2048
      and registration_form_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'
    )
  ),
  add constraint events_registration_form_required_check check (
    not registration_form_required or registration_form_url is not null
  );

grant update(registration_form_url,registration_form_required) on public.events to authenticated;

create function public.register_for_event(
  p_event_id uuid, p_waitlist boolean, p_confirmed_form_url text
)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.registrations; occupied bigint; desired text;
begin
  if auth.uid() is null then raise exception 'Please log in to register.'; end if;
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if e.cancelled_at is not null or now() >= e.registration_deadline or now() >= e.start_time then
    raise exception 'Registration has closed.';
  end if;
  select * into r from public.registrations where event_id=e.id and user_id=auth.uid();
  if found and r.status <> 'cancelled' then raise exception 'You already registered for this event.'; end if;
  if e.registration_form_required and p_confirmed_form_url is distinct from e.registration_form_url then
    raise exception 'Confirm you submitted the current event form before registering.';
  end if;
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

-- Keep the existing RPC available for forms that do not require confirmation and older clients.
create or replace function public.register_for_event(p_event_id uuid,p_waitlist boolean default false)
returns public.registrations language sql security invoker set search_path = '' as $$
  select * from public.register_for_event(p_event_id,p_waitlist,null::text);
$$;

revoke all on function public.register_for_event(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.register_for_event(uuid,boolean,text) to authenticated;

commit;
