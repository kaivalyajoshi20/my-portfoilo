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

export async function onRequestPost({ request, env }) {
  if (!env.DATABASE_URL) return json({ error: 'The contact form is not configured yet.' }, 503);
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Request not allowed.' }, 403);
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ error: 'Please submit the form normally.' }, 415);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > 12_000) return json({ error: 'Your message is too long.' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Please check the form and try again.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Please check the form and try again.' }, 400);
  // Quietly accept honeypot submissions without storing spam.
  if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true });
  const started = Number(body.formStartedAt);
  if (!Number.isFinite(started) || Date.now() - started < 1800 || Date.now() - started > 24 * 60 * 60 * 1000) {
    return json({ error: 'Please wait a moment and try submitting again.' }, 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!name || name.length > 120) return json({ error: 'Please enter a name under 120 characters.' }, 400);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (subject.length > 180) return json({ error: 'Please keep the subject under 180 characters.' }, 400);
  if (!message || message.length > 5000) return json({ error: 'Please add a message under 5,000 characters.' }, 400);
  try {
    const sql = neon(env.DATABASE_URL);
    await sql`INSERT INTO public.contact_messages (name, email, subject, message) VALUES (${name}, ${email}, ${subject || null}, ${message})`;
    return json({ ok: true }, 201);
  } catch {
    return json({ error: 'We could not save your message right now. Please try again later.' }, 500);
  }
}
