create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  celebrant_name text check (celebrant_name is null or char_length(celebrant_name) <= 100),
  starts_at timestamptz not null,
  timezone text not null default 'America/Lima',
  address text not null check (char_length(address) between 1 and 300),
  maps_url text not null,
  photo_url text not null,
  music_url text,
  max_guests smallint not null default 4 check (max_guests between 0 and 10),
  rsvp_open boolean not null default true,
  narrative jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text check (label is null or char_length(label) <= 100),
  kind text not null default 'general' check (kind in ('general', 'individual', 'family')),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  max_companions smallint check (max_companions is null or max_companions between 0 and 10),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, token_hash)
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  attending boolean not null,
  companions smallint not null default 0 check (companions between 0 and 10),
  last_idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.public_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 1 check (hits > 0)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger rsvps_set_updated_at before update on public.rsvps
for each row execute function public.set_updated_at();

create or replace function public.is_event_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.consume_public_rate_limit(
  p_key text,
  p_limit integer default 30,
  p_window_seconds integer default 60
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_row public.public_rate_limits%rowtype;
begin
  if char_length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  select * into current_row from public.public_rate_limits where key = p_key for update;
  if not found then
    insert into public.public_rate_limits(key, hits) values (p_key, 1);
    return true;
  end if;
  if current_row.window_started_at < now() - make_interval(secs => p_window_seconds) then
    update public.public_rate_limits set window_started_at = now(), hits = 1 where key = p_key;
    return true;
  end if;
  if current_row.hits >= p_limit then return false; end if;
  update public.public_rate_limits set hits = hits + 1 where key = p_key;
  return true;
end;
$$;

alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.admin_users enable row level security;
alter table public.public_rate_limits enable row level security;

create policy "admins read events" on public.events for select to authenticated using (public.is_event_admin());
create policy "admins update events" on public.events for update to authenticated using (public.is_event_admin()) with check (public.is_event_admin());
create policy "admins read invitations" on public.invitations for select to authenticated using (public.is_event_admin());
create policy "admins manage invitations" on public.invitations for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());
create policy "admins read rsvps" on public.rsvps for select to authenticated using (public.is_event_admin());
create policy "admins manage rsvps" on public.rsvps for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());
create policy "admins read own membership" on public.admin_users for select to authenticated using (user_id = auth.uid());

revoke all on public.events, public.invitations, public.rsvps, public.admin_users, public.public_rate_limits from anon;
revoke all on function public.consume_public_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, integer, integer) to service_role;
grant select, update on public.events to authenticated;
grant select, insert, update, delete on public.invitations, public.rsvps to authenticated;
grant select on public.admin_users to authenticated;

insert into public.events (
  id, title, starts_at, timezone, address, maps_url, photo_url, max_guests, rsvp_open, narrative
) values (
  '11111111-1111-4111-8111-111111111111',
  'Cumpleaños',
  '2026-11-06 13:00:00-05',
  'America/Lima',
  'Mz. L, lote 5, Urb. Villa Santa María, Trujillo, Perú',
  'https://www.google.com/maps/search/?api=1&query=Mz.%20L%2C%20lote%205%2C%20Urb.%20Villa%20Santa%20Mar%C3%ADa%2C%20Trujillo%2C%20Per%C3%BA',
  '/assets/images/cumpleanera.webp',
  4,
  true,
  '{"opening":"Hay momentos que merecen celebrarse…","openingDetail":"Y nada me haría más feliz que compartir este día tan especial contigo.","story":["La vida está llena de momentos especiales…","Y los más bonitos son aquellos que compartimos con las personas que queremos."],"invitation":"Será un gran placer compartir contigo este día tan especial, donde celebraremos la alegría de vivir y los nuevos comienzos."}'::jsonb
) on conflict (id) do update set
  title = excluded.title,
  starts_at = excluded.starts_at,
  address = excluded.address,
  maps_url = excluded.maps_url,
  narrative = excluded.narrative;
