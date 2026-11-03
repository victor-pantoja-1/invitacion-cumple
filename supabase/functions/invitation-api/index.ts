import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json, sha256, validToken } from '../_shared/http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

interface EventRow {
  id: string; title: string; celebrant_name: string | null; starts_at: string; timezone: string;
  address: string; maps_url: string; photo_url: string; music_url: string | null;
  max_guests: number; rsvp_open: boolean; narrative: Record<string, unknown>;
}

function publicEvent(row: EventRow) {
  return {
    id: row.id, title: row.title, celebrantName: row.celebrant_name, startsAt: row.starts_at,
    timezone: row.timezone, address: row.address, mapsUrl: row.maps_url, photoUrl: row.photo_url,
    musicUrl: row.music_url, maxGuests: row.max_guests, rsvpOpen: row.rsvp_open, narrative: row.narrative,
  };
}

function publicRsvp(row: { name: string; attending: boolean; companions: number; updated_at: string }) {
  return { name: row.name, attending: row.attending, companions: row.companions, updatedAt: row.updated_at };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) return json({ error: 'Solicitud demasiado grande.' }, 413);

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { data: allowed } = await db.rpc('consume_public_rate_limit', { p_key: `invitation:${ip}`, p_limit: 40, p_window_seconds: 60 });
  if (!allowed) return json({ error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.', code: 'RATE_LIMITED' }, 429);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!validToken(body.token)) return json({ error: 'Token inválido.', code: 'INVALID_TOKEN' }, 400);

  const { data: event, error: eventError } = await db.from('events').select('*').eq('is_active', true).order('starts_at').limit(1).single<EventRow>();
  if (eventError || !event) return json({ error: 'Evento no disponible.', code: 'EVENT_UNAVAILABLE' }, 503);
  const tokenHash = await sha256(body.token);
  const { data: invitation } = await db.from('invitations').select('id, kind, max_companions, revoked_at').eq('event_id', event.id).eq('token_hash', tokenHash).maybeSingle();

  if (body.action === 'resolve') {
    if (invitation?.revoked_at || (!invitation && body.personalized === true)) {
      return json({ error: 'Invitación no encontrada.', code: 'INVITATION_NOT_FOUND' }, 404);
    }
    let rsvp = null;
    if (invitation) {
      const result = await db.from('rsvps').select('name, attending, companions, updated_at').eq('invitation_id', invitation.id).maybeSingle();
      if (result.data) rsvp = publicRsvp(result.data);
    }
    return json({ data: { event: publicEvent(event), rsvp, invitationType: invitation?.kind === 'general' ? 'general' : (body.personalized ? 'personalized' : 'general') } });
  }

  if (body.action !== 'save') return json({ error: 'Acción no válida.' }, 400);
  if (!event.rsvp_open) return json({ error: 'Las confirmaciones están cerradas.', code: 'RSVP_CLOSED' }, 409);
  if (body.personalized === true && !invitation) return json({ error: 'Invitación no encontrada.', code: 'INVITATION_NOT_FOUND' }, 404);
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const attending = body.attending;
  const companions = attending === true ? Number(body.companions) : 0;
  const idempotencyKey = typeof body.idempotencyKey === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey) ? body.idempotencyKey : '';
  if (name.length < 2 || name.length > 100 || typeof attending !== 'boolean' || !Number.isInteger(companions) || companions < 0 || !idempotencyKey) {
    return json({ error: 'Revisa los datos enviados.', code: 'VALIDATION_ERROR' }, 422);
  }

  let invitationRow = invitation;
  if (!invitationRow) {
    const created = await db.from('invitations').insert({ event_id: event.id, kind: 'general', token_hash: tokenHash, max_companions: event.max_guests }).select('id, kind, max_companions, revoked_at').single();
    if (created.error) {
      const existing = await db.from('invitations').select('id, kind, max_companions, revoked_at').eq('event_id', event.id).eq('token_hash', tokenHash).single();
      invitationRow = existing.data;
    } else invitationRow = created.data;
  }
  if (!invitationRow || invitationRow.revoked_at) return json({ error: 'Invitación no disponible.', code: 'INVITATION_NOT_FOUND' }, 404);
  const allowedCompanions = invitationRow.max_companions ?? event.max_guests;
  if (companions > allowedCompanions) return json({ error: `Esta invitación permite hasta ${allowedCompanions} acompañantes.`, code: 'TOO_MANY_COMPANIONS' }, 422);

  const existingRsvp = await db.from('rsvps').select('name, attending, companions, updated_at, last_idempotency_key').eq('invitation_id', invitationRow.id).maybeSingle();
  if (existingRsvp.data?.last_idempotency_key === idempotencyKey) return json({ data: publicRsvp(existingRsvp.data) });
  const saved = await db.from('rsvps').upsert({ invitation_id: invitationRow.id, name, attending, companions, last_idempotency_key: idempotencyKey }, { onConflict: 'invitation_id' }).select('name, attending, companions, updated_at').single();
  if (saved.error || !saved.data) return json({ error: 'No se pudo guardar la respuesta.', code: 'SAVE_FAILED' }, 500);
  return json({ data: publicRsvp(saved.data) });
});
