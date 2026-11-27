-- Run after all active deployments and rollback targets use count/last_request.
DROP VIEW IF EXISTS public.http_rate_limit;
DROP TRIGGER IF EXISTS sync_rate_limit_window ON public.rate_limit;
DROP FUNCTION IF EXISTS public.sync_rate_limit_window();
ALTER TABLE public.rate_limit
  DROP COLUMN IF EXISTS hits,
  DROP COLUMN IF EXISTS reset_at;
