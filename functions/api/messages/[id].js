import { neon } from '@neondatabase/serverless';

const encoder = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
async function authorized(request, env) {
  const cookie = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith('__Secure-cy_admin='));
  const token = cookie ? cookie.slice('__Secure-cy_admin='.length) : '';
  if (!token || !env.SESSION_SECRET) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[1].length % 4) % 4)), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify('HMAC', key, sig, encoder.encode(parts[0]))) return false;
    const payload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[0].length % 4) % 4)));
    return payload.sub === 'portfolio-admin' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
export async function onRequestPatch({ request, env, params }) {
  if (!env.DATABASE_URL || !env.SESSION_SECRET) return json({ error: 'Server is not configured yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'Invalid request.' }, 415);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) return json({ error: 'Invalid request.' }, 413);
  if (!await authorized(request, env)) return json({ error: 'Unauthorized.' }, 401);
  const id = String(params.id || '');
  if (!/^\\d{1,18}$/.test(id)) return json({ error: 'Invalid message ID.' }, 400);
  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2_048) return json({ error: 'Invalid request.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !['new', 'read', 'archived'].includes(body.status)) return json({ error: 'Invalid status.' }, 400);
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = await sql`UPDATE public.contact_messages SET status = ${body.status} WHERE id = ${id} RETURNING id, status`;
    if (!rows.length) return json({ error: 'Message not found.' }, 404);
    return json({ message: rows[0] });
  } catch { return json({ error: 'Unable to update this message.' }, 500); }
}

export async function onRequestDelete({ request, env, params }) {
  if (!env.DATABASE_URL || !env.SESSION_SECRET) return json({ error: 'Server is not configured yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  if (!await authorized(request, env)) return json({ error: 'Unauthorized.' }, 401);
  const id = String(params.id || '');
  if (!/^\\d{1,18}$/.test(id)) return json({ error: 'Invalid message ID.' }, 400);
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = await sql`DELETE FROM public.contact_messages WHERE id = ${id} RETURNING id`;
    if (!rows.length) return json({ error: 'Message not found.' }, 404);
    return json({ ok: true });
  } catch { return json({ error: 'Unable to delete this message.' }, 500); }
}
