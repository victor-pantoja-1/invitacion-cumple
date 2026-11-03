import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json, randomToken, sha256 } from '../_shared/http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const adminDb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData } = await userClient.auth.getUser(token);
  if (!userData.user) return json({ error: 'Sesión inválida.', code: 'UNAUTHORIZED' }, 401);
  const membership = await adminDb.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (!membership.data) return json({ error: 'No tienes permisos de administrador.', code: 'FORBIDDEN' }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const eventResult = await adminDb.from('events').select('*').eq('is_active', true).order('starts_at').limit(1).single();
  if (!eventResult.data) return json({ error: 'Evento no disponible.' }, 503);
  const event = eventResult.data;

  if (body.action === 'dashboard') {
    const result = await adminDb.from('invitations').select('id, label, kind, max_companions, created_at, rsvps(name, attending, companions, updated_at)').eq('event_id', event.id).order('created_at', { ascending: false });
    const list = (result.data ?? []).map((item) => {
      const relation = Array.isArray(item.rsvps) ? item.rsvps[0] : item.rsvps;
      return { id: item.id, label: item.label, kind: item.kind, maxCompanions: item.max_companions, createdAt: item.created_at, rsvp: relation ? { name: relation.name, attending: relation.attending, companions: relation.companions, updatedAt: relation.updated_at } : null };
    });
    const responded = list.filter((item) => item.rsvp);
    const attending = responded.filter((item) => item.rsvp?.attending);
    const declined = responded.filter((item) => item.rsvp && !item.rsvp.attending);
    const companions = attending.reduce((total, item) => total + (item.rsvp?.companions ?? 0), 0);
    const stats = { invitations: list.length, responded: responded.length, attending: attending.length, declined: declined.length, companions, totalPeople: attending.length + companions, pending: list.length - responded.length };
    return json({ data: { stats, invitations: list, event: { id: event.id, title: event.title, celebrantName: event.celebrant_name, startsAt: event.starts_at, timezone: event.timezone, address: event.address, mapsUrl: event.maps_url, photoUrl: event.photo_url, musicUrl: event.music_url, maxGuests: event.max_guests, rsvpOpen: event.rsvp_open, narrative: event.narrative } } });
  }

  if (body.action === 'create-invitation') {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const kind = body.kind === 'family' ? 'family' : 'individual';
    const maxCompanions = Number(body.maxCompanions);
    if (label.length < 1 || label.length > 100 || !Number.isInteger(maxCompanions) || maxCompanions < 0 || maxCompanions > 10) return json({ error: 'Revisa los datos de la invitación.', code: 'VALIDATION_ERROR' }, 422);
    const urlToken = randomToken();
    const inserted = await adminDb.from('invitations').insert({ event_id: event.id, label, kind, max_companions: maxCompanions, token_hash: await sha256(urlToken) });
    if (inserted.error) return json({ error: 'No se pudo crear la invitación.' }, 500);
    return json({ data: { urlToken } }, 201);
  }

  if (body.action === 'delete-invitation') {
    if (typeof body.id !== 'string') return json({ error: 'Identificador inválido.' }, 422);
    const removed = await adminDb.from('invitations').delete().eq('id', body.id).eq('event_id', event.id);
    if (removed.error) return json({ error: 'No se pudo eliminar la invitación.' }, 500);
    return json({ data: null });
  }

  if (body.action === 'update-event') {
    const allowed = ['title', 'celebrant_name', 'starts_at', 'timezone', 'address', 'maps_url', 'photo_url', 'music_url', 'max_guests', 'rsvp_open', 'narrative'];
    const changes = Object.fromEntries(Object.entries(body.changes as Record<string, unknown> ?? {}).filter(([key]) => allowed.includes(key)));
    const updated = await adminDb.from('events').update(changes).eq('id', event.id);
    if (updated.error) return json({ error: 'No se pudo actualizar el evento.' }, 500);
    return json({ data: { ok: true } });
  }

  return json({ error: 'Acción no válida.' }, 400);
});
