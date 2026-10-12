import { neon } from '@neondatabase/serverless';

const encoder = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function authorized(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !env.SESSION_SECRET) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  let signature;
  try { signature = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[1].length % 4) % 4)), c => c.charCodeAt(0)); } catch { return false; }
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0]));
  if (!valid) return false;
  try {
    const payload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[0].length % 4) % 4)));
    return payload.sub === 'portfolio-admin' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
export async function onRequestGet({ request, env }) {
  if (!env.DATABASE_URL || !env.SESSION_SECRET) return json({ error: 'Server is not configured yet.' }, 503);
  if (!await authorized(request, env)) return json({ error: 'Unauthorized. Please sign in again.' }, 401);
  try {
    const sql = neon(env.DATABASE_URL);
    const messages = await sql`SELECT id, name, email, subject, message, created_at, status FROM public.contact_messages ORDER BY created_at DESC LIMIT 500`;
    return json({ messages });
  } catch { return json({ error: 'Unable to load messages right now.' }, 500); }
}
