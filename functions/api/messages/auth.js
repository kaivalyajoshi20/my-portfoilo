import { neon } from '@neondatabase/serverless';
import { enforceRateLimit } from '../_rate-limit.js';

const encoder = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = b64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return data + '.' + b64url(signature);
}
const SESSION_COOKIE = '__Secure-cy_admin';
const COOKIE_OPTIONS = 'Path=/api/messages; HttpOnly; Secure; SameSite=Strict';
const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'", ...extraHeaders } });
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.DATABASE_URL) return json({ error: 'Server is not configured yet.' }, 503);
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Request not allowed.' }, 403);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'Invalid request.' }, 415);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) return json({ error: 'Invalid request.' }, 413);
  let rawBody;
  try { rawBody = await request.text(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (new TextEncoder().encode(rawBody).byteLength > 2_048) return json({ error: 'Invalid request.' }, 413);
  let body;
  try { body = JSON.parse(rawBody); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
  const supplied = typeof body.password === 'string' ? body.password : '';
  if (supplied.length > 256 || supplied !== env.ADMIN_PASSWORD) {
    try {
      const sql = neon(env.DATABASE_URL);
      if (!await enforceRateLimit(sql, request, env, 'admin-login', 5, 900)) return json({ error: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.' }, 429);
    } catch { return json({ error: 'Sign-in is temporarily unavailable.' }, 503); }
    await new Promise(resolve => setTimeout(resolve, 350));
    return json({ error: 'Incorrect password.' }, 401);
  }
  const token = await sign({ sub: 'portfolio-admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, env.SESSION_SECRET);
  return json({ ok: true }, 200, { 'Set-Cookie': SESSION_COOKIE + '=' + token + '; Max-Age=28800; ' + COOKIE_OPTIONS });
}

export async function onRequestDelete({ request }) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Request not allowed.' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': SESSION_COOKIE + '=; Max-Age=0; ' + COOKIE_OPTIONS });
}
