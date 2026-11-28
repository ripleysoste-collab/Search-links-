-- Search Link · Tráfico -> Limitar + Seguridad rápida
-- Ejecutar este script una sola vez en Supabase -> SQL Editor.
-- Guarda por cada servicio sus límites personalizados (por minuto, por hora, por día)
-- y la lista de URLs autorizadas (allowed_origins) para Seguridad rápida.

CREATE TABLE IF NOT EXISTS public.servicio_limites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id uuid NOT NULL UNIQUE REFERENCES public.servicios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  per_minute_limit integer NOT NULL CHECK (per_minute_limit >= 1),
  per_hour_limit integer NOT NULL CHECK (per_hour_limit >= 1),
  daily_limit integer NOT NULL CHECK (daily_limit >= 1),
  allowed_origins text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicio_limites_user_id
  ON public.servicio_limites (user_id);

CREATE OR REPLACE FUNCTION public.set_servicio_limites_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servicio_limites_updated_at ON public.servicio_limites;
CREATE TRIGGER trg_servicio_limites_updated_at
  BEFORE UPDATE ON public.servicio_limites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_servicio_limites_updated_at();

-- Seguridad estricta: ningún visitante anónimo puede consultar ni modificar esta tabla directamente.
ALTER TABLE public.servicio_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_limites FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.servicio_limites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicio_limites TO authenticated;

DROP POLICY IF EXISTS "servicio_limites_select_own" ON public.servicio_limites;
CREATE POLICY "servicio_limites_select_own"
  ON public.servicio_limites
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "servicio_limites_insert_own" ON public.servicio_limites;
CREATE POLICY "servicio_limites_insert_own"
  ON public.servicio_limites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.servicios s
      WHERE s.id = servicio_id
        AND s.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "servicio_limites_update_own" ON public.servicio_limites;
CREATE POLICY "servicio_limites_update_own"
  ON public.servicio_limites
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.servicios s
      WHERE s.id = servicio_id
        AND s.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "servicio_limites_delete_own" ON public.servicio_limites;
CREATE POLICY "servicio_limites_delete_own"
  ON public.servicio_limites
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- RPC segura para que /api/v1/* cargue en el servidor los límites, orígenes permitidos
-- y plan del dueño de una API Key activa sin exponer correos ni PII.
CREATE OR REPLACE FUNCTION public.get_service_traffic_limits_by_key_hash(p_key_hash text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'servicio_id', s.id,
    'has_rule', (sl.id IS NOT NULL),
    'per_minute_limit', sl.per_minute_limit,
    'per_hour_limit', sl.per_hour_limit,
    'daily_limit', sl.daily_limit,
    'allowed_origins', COALESCE(sl.allowed_origins, '{}'::text[]),
    'updated_at', sl.updated_at,
    'plan_tier',
      CASE
        WHEN lower(trim(coalesce(u.raw_app_meta_data ->> 'plan', u.raw_app_meta_data ->> 'tier', '')))
          IN ('plus_max', 'plus+', 'plus-max', 'plus_mas', 'max', 'pro')
          OR lower(trim(coalesce(u.email, ''))) = 'cristiancuerodiaz@gmail.com'
          THEN 'plus_max'
        WHEN lower(trim(coalesce(u.raw_app_meta_data ->> 'plan', u.raw_app_meta_data ->> 'tier', ''))) = 'plus'
          THEN 'plus'
        WHEN lower(trim(coalesce(u.raw_app_meta_data ->> 'plan', u.raw_app_meta_data ->> 'tier', '')))
          IN ('free', 'gratuito')
          THEN 'free'
        ELSE NULL
      END
  )
  FROM public.servicio_api_keys k
  INNER JOIN public.servicios s ON s.id = k.servicio_id
  LEFT JOIN public.servicio_limites sl ON sl.servicio_id = s.id
  LEFT JOIN auth.users u ON u.id = COALESCE(k.user_id, s.user_id)
  WHERE k.key_hash = p_key_hash
    AND k.is_active = true
    AND s.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_service_traffic_limits_by_key_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_service_traffic_limits_by_key_hash(text) TO anon, authenticated;
