-- Search Link · Modo Agencia (Paso 4)
-- Tabla protegida para respaldar en la nube las URLs de servidores externos
-- y bloquear el consumo de /api/v1/* cuando la cuenta opera desde su propio servidor.

CREATE TABLE IF NOT EXISTS public.servidores_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  server_url text NOT NULL,
  service_scope text NOT NULL DEFAULT 'all',
  secret_key text NOT NULL,
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_event text,
  last_remote_status integer,
  last_duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servidores_externos_url_protocol_chk
    CHECK (server_url ~* '^https?://' AND char_length(server_url) <= 2048),
  CONSTRAINT servidores_externos_secret_len_chk
    CHECK (char_length(secret_key) >= 12 AND char_length(secret_key) <= 256),
  CONSTRAINT servidores_externos_scope_nonempty_chk
    CHECK (char_length(trim(service_scope)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_servidores_externos_active
  ON public.servidores_externos (user_id)
  WHERE auto_sync_enabled = true;

CREATE OR REPLACE FUNCTION public.set_servidores_externos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servidores_externos_updated_at ON public.servidores_externos;
CREATE TRIGGER trg_servidores_externos_updated_at
  BEFORE UPDATE ON public.servidores_externos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_servidores_externos_updated_at();

-- Seguridad máxima: RLS obligatorio y sin ningún acceso para visitantes anónimos
ALTER TABLE public.servidores_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servidores_externos FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.servidores_externos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servidores_externos TO authenticated;

DROP POLICY IF EXISTS "servidores_externos_select_own" ON public.servidores_externos;
CREATE POLICY "servidores_externos_select_own"
  ON public.servidores_externos
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "servidores_externos_insert_own" ON public.servidores_externos;
CREATE POLICY "servidores_externos_insert_own"
  ON public.servidores_externos
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "servidores_externos_update_own" ON public.servidores_externos;
CREATE POLICY "servidores_externos_update_own"
  ON public.servidores_externos
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "servidores_externos_delete_own" ON public.servidores_externos;
CREATE POLICY "servidores_externos_delete_own"
  ON public.servidores_externos
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- RPC segura para que /api/v1/* verifique si la API Key consultada corresponde
-- a un servicio conectado a un servidor externo según el alcance elegido (all, new o id específico).
CREATE OR REPLACE FUNCTION public.check_external_server_by_key_hash(p_key_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.servicio_api_keys k
    INNER JOIN public.servicios s ON s.id = k.servicio_id
    INNER JOIN public.servidores_externos se
      ON se.user_id = COALESCE(k.user_id, s.user_id)
    WHERE k.key_hash = p_key_hash
      AND k.is_active = true
      AND se.auto_sync_enabled = true
      AND (
        se.service_scope = 'all'
        OR (se.service_scope = 'new' AND s.created_at >= se.created_at)
        OR (se.service_scope NOT IN ('all', 'new') AND s.id::text = se.service_scope)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.check_external_server_by_key_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_external_server_by_key_hash(text) TO anon, authenticated;
