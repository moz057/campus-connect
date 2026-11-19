-- Optional presentation data. Run after the organization and leadership migration.
-- Reserved IDs and the DEMO prefix identify sample records. Rerunning does not create duplicates.
begin;

insert into public.organizations(id,name,description) values
  ('de000001-0000-4000-8000-000000000001','DEMO: Technology Circle','Sample organization for student technology workshops and design projects.'),
  ('de000001-0000-4000-8000-000000000002','DEMO: Arts Collective','Sample organization for performances, visual arts, and creative workshops.'),
  ('de000001-0000-4000-8000-000000000003','DEMO: Campus Recreation Club','Sample organization for sports, games, and campus recreation.')
on conflict do nothing;

with samples(id,org_index,title,description,category,venue,banner,capacity,days_ahead) as (
  values
    ('de000002-0000-4000-8000-000000000001',1,'DEMO: Campus Web Design Lab','Bring a laptop and work in small teams to turn an idea into a campus website.','Technology','Sample Computer Lab','tech',32,2),
    ('de000002-0000-4000-8000-000000000002',2,'DEMO: Student Art Showcase','Explore student illustrations, photos, and short performances at an open exhibition.','Arts & Culture','Sample Student Gallery','culture',90,4),
    ('de000002-0000-4000-8000-000000000003',3,'DEMO: Friendly Basketball Cup','Join a friendly campus basketball game or cheer from the stands.','Sports','Sample Campus Gym','sports',24,6),
    ('de000002-0000-4000-8000-000000000004',1,'DEMO: Build a Campus Prototype','Try making a simple prototype with other students. Beginner experience is welcome.','Technology','Sample Innovation Lab','tech',20,9),
    ('de000002-0000-4000-8000-000000000005',2,'DEMO: Poster-Making Workshop','Make a poster for a campus cause and get feedback from other students.','Arts & Culture','Sample Arts Studio','culture',18,12),
    ('de000002-0000-4000-8000-000000000006',3,'DEMO: Campus Games Afternoon','Drop in for friendly indoor games and meet other students.','Sports','Sample Recreation Hall','sports',60,15)
), schedule as (
  select samples.*, o.id as organization_id,
    ((now() at time zone 'Asia/Manila')::date + days_ahead + time '14:00') at time zone 'Asia/Manila' as starts
  from samples
  join public.organizations o on o.id=('de000001-0000-4000-8000-00000000000' || org_index)::uuid
  where o.archived_at is null
)
insert into public.events(id,organization_id,title,description,category,venue,banner_url,capacity,start_time,end_time,registration_deadline)
select id::uuid,organization_id,title,description,category,venue,'/images/' || banner || '.jpg',capacity,starts,starts+interval '2 hours',starts-interval '1 hour'
from schedule
on conflict (id) do nothing;

insert into public.announcements(id,title,body) values
  ('de000003-0000-4000-8000-000000000001','DEMO: Welcome to CampusConnect','The organizations and events marked DEMO are sample records for the CampusConnect presentation.')
on conflict (id) do nothing;

commit;
