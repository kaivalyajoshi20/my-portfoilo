import { neon } from '@neondatabase/serverless';

const encoder = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = b64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return data + '.' + b64url(signature);
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.DATABASE_URL) return json({ error: 'Server is not configured yet.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const supplied = String(body.password || '');
  if (supplied.length > 256 || supplied !== env.ADMIN_PASSWORD) {
    await new Promise(resolve => setTimeout(resolve, 350));
    return json({ error: 'Incorrect password.' }, 401);
  }
  const token = await sign({ sub: 'portfolio-admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, env.SESSION_SECRET);
  return json({ token });
}
