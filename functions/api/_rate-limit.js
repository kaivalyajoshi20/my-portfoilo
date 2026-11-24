const encoder = new TextEncoder();

export async function enforceRateLimit(sql, request, env, bucket, limit, windowSeconds) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !env.SESSION_SECRET) throw new Error('Rate-limit context is unavailable.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  const fingerprint = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  const bucketKey = bucket + ':' + fingerprint;
  const rows = await sql`INSERT INTO public.api_rate_limits AS existing (bucket_key, window_started_at, request_count)
    VALUES (${bucketKey}, now(), 1)
    ON CONFLICT (bucket_key) DO UPDATE SET
      window_started_at = CASE
        WHEN existing.window_started_at <= now() - (${windowSeconds} * interval '1 second') THEN now()
        ELSE existing.window_started_at
      END,
      request_count = CASE
        WHEN existing.window_started_at <= now() - (${windowSeconds} * interval '1 second') THEN 1
        ELSE existing.request_count + 1
      END
    RETURNING request_count`;
  if (Math.random() < 0.02) {
    try { await sql`DELETE FROM public.api_rate_limits WHERE window_started_at < now() - interval '1 day'`; } catch {}
  }
  return Number(rows[0]?.request_count || 0) <= limit;
}
