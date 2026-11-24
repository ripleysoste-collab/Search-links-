-- Search Link · Ajustes avanzados + Ledger antifraude de plan gratuito
-- Ejecutar este script una sola vez en Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS public.uso_historico_cuentas (
  email_hash text PRIMARY KEY,
  free_images_used integer NOT NULL DEFAULT 0 CHECK (free_images_used >= 0),
  free_api_requests_month text,
  free_api_requests_used integer NOT NULL DEFAULT 0 CHECK (free_api_requests_used >= 0),
  free_chat_day text,
  free_chat_used integer NOT NULL DEFAULT 0 CHECK (free_chat_used >= 0),
  last_deleted_plan text NOT NULL DEFAULT 'free' CHECK (last_deleted_plan IN ('free', 'plus')),
  deletions_count integer NOT NULL DEFAULT 0 CHECK (deletions_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_uso_historico_cuentas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_historico_cuentas_updated_at ON public.uso_historico_cuentas;
CREATE TRIGGER trg_uso_historico_cuentas_updated_at
  BEFORE UPDATE ON public.uso_historico_cuentas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_uso_historico_cuentas_updated_at();

-- Seguridad estricta: ningún cliente anónimo ni autenticado puede leer o alterar la tabla directamente.
ALTER TABLE public.uso_historico_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_historico_cuentas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.uso_historico_cuentas FROM PUBLIC, anon, authenticated;

-- Hash SHA-256 determinístico del correo normalizado (sin guardar correos en texto plano tras borrar la cuenta)
CREATE OR REPLACE FUNCTION public.compute_email_hash(raw_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    sha256(convert_to(lower(trim(coalesce(raw_email, ''))), 'UTF8')),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION public.compute_email_hash(text) FROM PUBLIC, anon, authenticated;

-- 1. Consultar saldo histórico de cuota gratuita del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_my_free_usage_ledger()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_hash text;
  v_row public.uso_historico_cuentas%ROWTYPE;
  v_month text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_day text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object(
      'free_images_used', 0,
      'free_api_requests_used', 0,
      'free_chat_used', 0,
      'last_deleted_plan', 'free'
    );
  END IF;

  v_hash := public.compute_email_hash(v_email);
  SELECT * INTO v_row
  FROM public.uso_historico_cuentas
  WHERE email_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'free_images_used', 0,
      'free_api_requests_used', 0,
      'free_chat_used', 0,
      'last_deleted_plan', 'free'
    );
  END IF;

  RETURN jsonb_build_object(
    'free_images_used', GREATEST(0, coalesce(v_row.free_images_used, 0)),
    'free_api_requests_used',
      CASE
        WHEN v_row.free_api_requests_month = v_month
          THEN GREATEST(0, coalesce(v_row.free_api_requests_used, 0))
        ELSE 0
      END,
    'free_chat_used',
      CASE
        WHEN v_row.free_chat_day = v_day
          THEN GREATEST(0, coalesce(v_row.free_chat_used, 0))
        ELSE 0
      END,
    'last_deleted_plan', coalesce(v_row.last_deleted_plan, 'free')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_free_usage_ledger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_free_usage_ledger() TO authenticated;

-- 2. Registrar consumo de imágenes del plan gratuito cuando el usuario borra todas sus imágenes de R2
--    para impedir reiniciar el límite de 20 imágenes borrando archivos.
CREATE OR REPLACE FUNCTION public.record_my_r2_purge_usage(
  p_purged_images integer,
  p_has_plus boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_hash text;
  v_added integer := GREATEST(0, coalesce(p_purged_images, 0));
  v_next integer := 0;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF coalesce(p_has_plus, false) OR v_added <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'recorded', 0);
  END IF;

  v_hash := public.compute_email_hash(v_email);

  INSERT INTO public.uso_historico_cuentas AS l (
    email_hash,
    free_images_used,
    last_deleted_plan
  )
  VALUES (
    v_hash,
    v_added,
    'free'
  )
  ON CONFLICT (email_hash) DO UPDATE
    SET free_images_used = l.free_images_used + EXCLUDED.free_images_used
  RETURNING free_images_used INTO v_next;

  RETURN jsonb_build_object('ok', true, 'free_images_used', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_r2_purge_usage(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_r2_purge_usage(integer, boolean) TO authenticated;

-- 3. Consultar peticiones mensuales arrastradas por el propietario de una API Key activa
--    (retorna únicamente un entero sin exponer correos ni PII).
CREATE OR REPLACE FUNCTION public.get_monthly_api_usage_by_key_hash(p_key_hash text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN l.free_api_requests_month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')
            THEN GREATEST(0, coalesce(l.free_api_requests_used, 0))
          ELSE 0
        END
      FROM public.servicio_api_keys k
      INNER JOIN public.servicios s ON s.id = k.servicio_id
      INNER JOIN auth.users u ON u.id = COALESCE(k.user_id, s.user_id)
      INNER JOIN public.uso_historico_cuentas l
        ON l.email_hash = public.compute_email_hash(u.email)
      WHERE k.key_hash = p_key_hash
        AND k.is_active = true
        AND s.is_active = true
      LIMIT 1
    ),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_monthly_api_usage_by_key_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_api_usage_by_key_hash(text) TO anon, authenticated;

-- 4. Borrar definitivamente la cuenta del usuario autenticado:
--    - Plan gratuito: preserva el uso real acumulado de imágenes, peticiones API del mes y chat del día.
--    - Plan Plus (suscripción): reinicia a 0 para que, si vuelve sin suscripción, empiece como cuenta gratuita normal (20 imágenes).
--    - Elimina organización, servicios, productos, API keys, servidores externos, colas y el usuario en auth.users.
CREATE OR REPLACE FUNCTION public.delete_my_account_permanently(
  p_has_plus boolean DEFAULT false,
  p_api_month text DEFAULT NULL,
  p_api_requests integer DEFAULT 0,
  p_chat_day text DEFAULT NULL,
  p_chat_used integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_hash text;
  v_sum_service_items integer := 0;
  v_count_products integer := 0;
  v_total_active_images integer := 0;
  v_db_api_requests integer := 0;
  v_total_api_requests integer := 0;
  v_month text := coalesce(NULLIF(trim(p_api_month), ''), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'));
  v_day text := coalesce(NULLIF(trim(p_chat_day), ''), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'));
  v_chat_used integer := GREATEST(0, coalesce(p_chat_used, 0));
  v_auth_deleted boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(SUM(GREATEST(item_count, 0)), 0)::integer
    INTO v_sum_service_items
  FROM public.servicios
  WHERE user_id = v_uid;

  SELECT COUNT(*)::integer
    INTO v_count_products
  FROM public.servicio_productos p
  WHERE p.user_id = v_uid
     OR p.servicio_id IN (SELECT id FROM public.servicios WHERE user_id = v_uid);

  v_total_active_images := GREATEST(v_sum_service_items, v_count_products);

  SELECT COALESCE(SUM(GREATEST(k.requests_count, 0)), 0)::integer
    INTO v_db_api_requests
  FROM public.servicio_api_keys k
  WHERE k.user_id = v_uid
     OR k.servicio_id IN (SELECT id FROM public.servicios WHERE user_id = v_uid);

  v_total_api_requests := GREATEST(v_db_api_requests, GREATEST(0, coalesce(p_api_requests, 0)));

  IF v_email <> '' THEN
    v_hash := public.compute_email_hash(v_email);

    IF coalesce(p_has_plus, false) THEN
      INSERT INTO public.uso_historico_cuentas AS l (
        email_hash,
        free_images_used,
        free_api_requests_month,
        free_api_requests_used,
        free_chat_day,
        free_chat_used,
        last_deleted_plan,
        deletions_count
      )
      VALUES (
        v_hash,
        0,
        v_month,
        0,
        v_day,
        0,
        'plus',
        1
      )
      ON CONFLICT (email_hash) DO UPDATE
        SET free_images_used = 0,
            free_api_requests_month = v_month,
            free_api_requests_used = 0,
            free_chat_day = v_day,
            free_chat_used = 0,
            last_deleted_plan = 'plus',
            deletions_count = l.deletions_count + 1;
    ELSE
      INSERT INTO public.uso_historico_cuentas AS l (
        email_hash,
        free_images_used,
        free_api_requests_month,
        free_api_requests_used,
        free_chat_day,
        free_chat_used,
        last_deleted_plan,
        deletions_count
      )
      VALUES (
        v_hash,
        v_total_active_images,
        v_month,
        v_total_api_requests,
        v_day,
        v_chat_used,
        'free',
        1
      )
      ON CONFLICT (email_hash) DO UPDATE
        SET free_images_used = l.free_images_used + v_total_active_images,
            free_api_requests_month = v_month,
            free_api_requests_used =
              CASE
                WHEN l.free_api_requests_month = v_month
                  THEN l.free_api_requests_used + v_total_api_requests
                ELSE v_total_api_requests
              END,
            free_chat_day = v_day,
            free_chat_used =
              CASE
                WHEN l.free_chat_day = v_day
                  THEN GREATEST(l.free_chat_used, v_chat_used)
                ELSE v_chat_used
              END,
            last_deleted_plan = 'free',
            deletions_count = l.deletions_count + 1;
    END IF;
  END IF;

  -- Eliminar inmediatamente llaves API, productos, servicios, organización y configuraciones
  DELETE FROM public.servicio_api_keys
  WHERE user_id = v_uid
     OR servicio_id IN (SELECT id FROM public.servicios WHERE user_id = v_uid);

  DELETE FROM public.servicio_productos
  WHERE user_id = v_uid
     OR servicio_id IN (SELECT id FROM public.servicios WHERE user_id = v_uid);

  DELETE FROM public.servicios
  WHERE user_id = v_uid;

  DELETE FROM public.organizacion
  WHERE user_id = v_uid;

  IF to_regclass('public.servidores_externos') IS NOT NULL THEN
    DELETE FROM public.servidores_externos WHERE user_id = v_uid;
  END IF;

  IF to_regclass('public.mapping_jobs') IS NOT NULL THEN
    DELETE FROM public.mapping_jobs WHERE user_id = v_uid;
  END IF;

  -- Eliminar cuenta de autenticación en Supabase Auth
  BEGIN
    DELETE FROM auth.users WHERE id = v_uid;
    v_auth_deleted := FOUND;
  EXCEPTION WHEN OTHERS THEN
    v_auth_deleted := false;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'auth_deleted', v_auth_deleted,
    'carried_plan', CASE WHEN coalesce(p_has_plus, false) THEN 'plus' ELSE 'free' END,
    'archived_images', v_total_active_images
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account_permanently(boolean, text, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account_permanently(boolean, text, integer, text, integer) TO authenticated;
