begin;

-- The event row stays locked by the capacity update while registrations are promoted.
create function public.promote_waitlist_on_capacity_increase() returns trigger
language plpgsql security definer set search_path = '' as $$
declare available bigint;
begin
  if new.cancelled_at is not null or now() >= new.registration_deadline or now() >= new.start_time then
    return new;
  end if;

  select new.capacity - count(*) into available
  from public.registrations
  where event_id = new.id and status = 'registered';

  if available > 0 then
    update public.registrations
    set status = 'registered', qr_token = gen_random_uuid()
    where id in (
      select r.id
      from public.registrations r
      where r.event_id = new.id and r.status = 'waitlisted'
      order by r.created_at, r.id
      limit available
    );
  end if;
  return new;
end; $$;

revoke all on function public.promote_waitlist_on_capacity_increase() from public, anon, authenticated;

create trigger promote_waitlist_after_capacity_increase
after update of capacity on public.events
for each row when (new.capacity > old.capacity)
execute function public.promote_waitlist_on_capacity_increase();

commit;
