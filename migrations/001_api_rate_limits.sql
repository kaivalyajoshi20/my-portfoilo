-- Database-backed rate limits for the public contact endpoint and admin sign-in.
-- Client IP addresses are transformed into keyed HMAC fingerprints before storage.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS api_rate_limits_window_started_at_idx
  ON public.api_rate_limits (window_started_at);
