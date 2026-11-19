-- Optional presentation data. Run after the organization and leadership migration.
-- Fixed IDs identify sample records. The refresh updates earlier DEMO listings without rescheduling them.
begin;

insert into public.organizations(id,name,description) values
  ('de000001-0000-4000-8000-000000000001','Technology Circle','A student group for building websites, trying new tools, and turning campus ideas into practical projects. Workshops welcome beginners.'),
  ('de000001-0000-4000-8000-000000000002','Arts Collective','A student group for visual art, performance, and design. Share your work, get feedback, or try a new medium at an open workshop.'),
  ('de000001-0000-4000-8000-000000000003','Campus Recreation Club','A student group for informal sports and games. Activities are open to beginners and designed for students who want to meet people while staying active.')
on conflict (id) do update set name=excluded.name,description=excluded.description
where public.organizations.name like 'DEMO:%';

with samples(id,org_index,title,description,category,venue,banner,capacity,days_ahead) as (
  values
    ('de000002-0000-4000-8000-000000000001',1,'Campus Web Design Lab',
     E'Build a one-page website for a campus activity in a small team. The workshop is open to students who are new to web design.\n\nWhat to expect\nStart with a quick sketch, build a simple page, then swap feedback on its layout and accessibility.\n\nWhat to bring\nA charged laptop with a web browser, plus your CampusConnect QR ticket for check-in.',
     'Technology','Computer Lab, Talamban Campus','tech',32,2),
    ('de000002-0000-4000-8000-000000000002',2,'Student Art Showcase',
     E'Explore illustrations, photography, and short performances from student artists. Come to browse, meet the artists, or exchange ideas.\n\nWhat to expect\nWalk through the gallery at your own pace, then join a short artist talk about how the work was made.\n\nBefore you arrive\nRegister for a QR ticket and ask each artist before photographing their work.',
     'Arts & Culture','Student Gallery, Talamban Campus','culture',90,4),
    ('de000002-0000-4000-8000-000000000003',3,'Friendly Basketball Cup',
     E'Play a relaxed series of half-court basketball games. Sign up on your own or come with friends. Organizers will help form balanced teams.\n\nWhat to expect\nCheck in with your QR ticket, warm up together, then rotate through short games with breaks between rounds.\n\nWhat to bring\nCourt shoes, comfortable clothes, and a refillable water bottle.',
     'Sports','Campus Gym, Talamban Campus','sports',24,6),
    ('de000002-0000-4000-8000-000000000004',1,'Build a Campus Prototype',
     E'Turn a common campus problem into a simple prototype that you can test in an afternoon. No coding or design experience is required.\n\nWhat to expect\nPick a problem with your team, sketch a solution, and use paper to prototype one part of it. Another team will try it and share feedback.\n\nWhat to bring\nA notebook and your QR ticket. Paper and markers will be available for the activity.',
     'Technology','Innovation Lab, Talamban Campus','tech',20,9),
    ('de000002-0000-4000-8000-000000000005',2,'Poster-Making Workshop',
     E'Design a poster for a campus cause or event. You can work on paper or use a design app you already know.\n\nWhat to expect\nStart with a short exercise on typography and layout, make a draft, then get feedback during a small-group review.\n\nWhat to bring\nA topic or message you want to share. Bring a laptop if you prefer to work digitally.',
     'Arts & Culture','Arts Studio, Talamban Campus','culture',18,12),
    ('de000002-0000-4000-8000-000000000006',3,'Campus Games Afternoon',
     E'Meet other students over board games, table games, and short team challenges. Join any activity at your own pace.\n\nWhat to expect\nCheck in, choose a game station, and switch tables between rounds. Organizers will explain the rules for anyone playing for the first time.\n\nWhat to bring\nYour QR ticket and a water bottle. Games and equipment will be available.',
     'Sports','Recreation Hall, Talamban Campus','sports',60,15)
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
on conflict (id) do update
set title=excluded.title,description=excluded.description,organization=excluded.organization
where public.events.title like 'DEMO:%';

insert into public.announcements(id,title,body) values
  ('de000003-0000-4000-8000-000000000001','Welcome to CampusConnect','These sample listings are here so you can try browsing organizations, requesting membership, and registering for events.')
on conflict (id) do update set title=excluded.title,body=excluded.body
where public.announcements.title like 'DEMO:%';

commit;
