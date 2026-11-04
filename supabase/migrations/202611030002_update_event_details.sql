alter table public.events alter column max_guests set default 6;

update public.events
set
  starts_at = '2026-11-06 10:00:00-05',
  address = 'Casa de Campo - Campiña de Moche',
  maps_url = 'https://maps.app.goo.gl/GJUhJmogusQeqKe96',
  music_url = '/assets/audio/cancion.mp3',
  max_guests = 6
where id = '11111111-1111-4111-8111-111111111111';

update public.invitations
set max_companions = 6
where event_id = '11111111-1111-4111-8111-111111111111'
  and kind = 'general'
  and (max_companions is null or max_companions < 6);
