-- Keep the original fixed window and key while both service versions run.
DO $migration$
BEGIN
  IF to_regclass('public.rate_limit') IS NULL THEN
    IF EXISTS (
      SELECT FROM pg_class
      WHERE oid = to_regclass('public.http_rate_limit') AND relkind = 'r'
    ) THEN
      ALTER TABLE public.http_rate_limit RENAME TO rate_limit;
    ELSE
      CREATE TABLE public.rate_limit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        count integer NOT NULL,
        last_request bigint NOT NULL
      );
    END IF;
  END IF;
END
$migration$;

DO $migration$
DECLARE
  legacy_pk name;
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_attribute
    WHERE attrelid = 'public.rate_limit'::regclass
      AND attname = 'hits' AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.rate_limit
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS count integer,
    ADD COLUMN IF NOT EXISTS last_request bigint;
  UPDATE public.rate_limit
    SET count = hits, last_request = reset_at - 60000
    WHERE count IS NULL OR last_request IS NULL;
  ALTER TABLE public.rate_limit
    ALTER COLUMN count SET NOT NULL,
    ALTER COLUMN last_request SET NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_key_unique
    ON public.rate_limit (key);

  SELECT conname INTO legacy_pk FROM pg_constraint
  WHERE conrelid = 'public.rate_limit'::regclass AND contype = 'p'
    AND pg_get_constraintdef(oid) = 'PRIMARY KEY (key)';
  IF legacy_pk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.rate_limit DROP CONSTRAINT %I', legacy_pk);
    ALTER TABLE public.rate_limit ADD PRIMARY KEY (id);
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.sync_rate_limit_window()
RETURNS trigger LANGUAGE plpgsql AS $sync$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.count IS DISTINCT FROM OLD.count OR
       NEW.last_request IS DISTINCT FROM OLD.last_request THEN
      NEW.hits := NEW.count;
      NEW.reset_at := NEW.last_request + 60000;
    ELSE
      NEW.count := NEW.hits;
      NEW.last_request := NEW.reset_at - 60000;
    END IF;
  ELSIF NEW.count IS NULL THEN
    NEW.count := NEW.hits;
    NEW.last_request := NEW.reset_at - 60000;
  ELSE
    NEW.hits := NEW.count;
    NEW.reset_at := NEW.last_request + 60000;
  END IF;
  RETURN NEW;
END
$sync$;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT FROM pg_attribute
    WHERE attrelid = 'public.rate_limit'::regclass
      AND attname = 'hits' AND NOT attisdropped
  ) THEN
    DROP TRIGGER IF EXISTS sync_rate_limit_window ON public.rate_limit;
    CREATE TRIGGER sync_rate_limit_window BEFORE INSERT OR UPDATE ON public.rate_limit
      FOR EACH ROW EXECUTE FUNCTION public.sync_rate_limit_window();
    CREATE OR REPLACE VIEW public.http_rate_limit WITH (security_invoker = true) AS
      SELECT key, hits, reset_at FROM public.rate_limit;
  END IF;
END
$migration$;
