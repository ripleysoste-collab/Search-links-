import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MappedImageMetadata } from './imageCompression';

const DEFAULT_SUPABASE_URL = 'https://nhofuamltqglrgfjucof.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_wKhXyZ7s3CtT4NcU8Nx8EQ_T9TZsxFI';

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
).trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY
).trim();

export const isSupabaseClientConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase: SupabaseClient | null = isSupabaseClientConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null;

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface OrganizationRow {
  id: string;
  user_id: string;
  nombre: string;
  logo_url: string | null;
  logo_r2_key: string | null;
  has_completed_setup: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoreServiceProductRow {
  id: string;
  servicio_id: string;
  position: number;
  nombre: string;
  categoria: string;
  descripcion: string;
  image_url: string;
  r2_key: string | null;
  saved_percent: number;
  created_at: string;
}

export interface CoreServiceApiKeyRow {
  id: string;
  servicio_id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  requests_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface CoreServiceRow {
  id: string;
  user_id: string;
  organizacion_id: string | null;
  public_slug: string;
  nombre: string;
  source_type: 'url' | 'files';
  source_url: string | null;
  item_count: number;
  is_active: boolean;
  snapshot_json: unknown;
  created_at: string;
  updated_at: string;
  servicio_productos: CoreServiceProductRow[];
  servicio_api_keys: CoreServiceApiKeyRow[];
}

export interface CreateCoreServiceInput {
  publicSlug: string;
  nombre: string;
  sourceType: 'url' | 'files';
  sourceUrl?: string | null;
  keyPrefix: string;
  keyHash: string;
  snapshotJson?: unknown;
  items: Array<
    MappedImageMetadata & {
      r2Key?: string;
      savedPercent?: number;
    }
  >;
}

function isMissingTableError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('relation') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

export async function fetchUserOrganizationSafe(): Promise<{
  organization: OrganizationRow | null;
  tableMissing: boolean;
}> {
  if (!supabase) return { organization: null, tableMissing: false };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { organization: null, tableMissing: false };

  const { data, error } = await supabase
    .from('organizacion')
    .select(
      'id, user_id, nombre, logo_url, logo_r2_key, has_completed_setup, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return { organization: null, tableMissing: true };
    }
    return { organization: null, tableMissing: false };
  }

  return {
    organization: (data as OrganizationRow | null) ?? null,
    tableMissing: false,
  };
}

export async function upsertUserOrganization(input: {
  name: string;
  logoUrl: string | null;
  logoR2Key?: string | null;
  hasCompletedSetup: boolean;
}): Promise<{
  saved: boolean;
  organization: OrganizationRow | null;
  tableMissing?: boolean;
  reason?: string;
}> {
  if (!supabase) {
    return {
      saved: false,
      organization: null,
      reason: 'Supabase no está configurado.',
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      saved: false,
      organization: null,
      reason: 'Inicia sesión para guardar tu organización.',
    };
  }

  const cleanName = input.name.trim() || 'Sin nombre';

  const { data, error } = await supabase
    .from('organizacion')
    .upsert(
      {
        user_id: user.id,
        nombre: cleanName,
        logo_url: input.logoUrl,
        logo_r2_key: input.logoR2Key ?? null,
        has_completed_setup: Boolean(input.hasCompletedSetup),
      },
      { onConflict: 'user_id' },
    )
    .select(
      'id, user_id, nombre, logo_url, logo_r2_key, has_completed_setup, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    return {
      saved: false,
      organization: null,
      tableMissing: isMissingTableError(error),
      reason: error?.message || 'No se pudo guardar la organización en Supabase.',
    };
  }

  return {
    saved: true,
    organization: data as OrganizationRow,
  };
}

export async function fetchUserCoreServicesSafe(): Promise<{
  services: CoreServiceRow[];
  tableMissing: boolean;
}> {
  if (!supabase) return { services: [], tableMissing: false };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { services: [], tableMissing: false };

  const { data, error } = await supabase
    .from('servicios')
    .select(
      'id, user_id, organizacion_id, public_slug, nombre, source_type, source_url, item_count, is_active, snapshot_json, created_at, updated_at, servicio_productos(id, servicio_id, position, nombre, categoria, descripcion, image_url, r2_key, saved_percent, created_at), servicio_api_keys(id, servicio_id, label, key_prefix, is_active, requests_count, last_used_at, created_at)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingTableError(error)) {
      return { services: [], tableMissing: true };
    }
    return { services: [], tableMissing: false };
  }

  return {
    services: ((data || []) as CoreServiceRow[]).map((srv) => ({
      ...srv,
      servicio_productos: [...(srv.servicio_productos || [])].sort(
        (a, b) => a.position - b.position,
      ),
      servicio_api_keys: [...(srv.servicio_api_keys || [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    })),
    tableMissing: false,
  };
}

export async function createCoreServiceInSupabase(
  input: CreateCoreServiceInput,
): Promise<{
  saved: boolean;
  serviceId?: string;
  tableMissing?: boolean;
  reason?: string;
}> {
  if (!supabase) {
    return { saved: false, reason: 'Supabase no está configurado.' };
  }

  if (input.items.length === 0) {
    return { saved: false, reason: 'No hay productos para guardar.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false, reason: 'Inicia sesión para guardar el servicio.' };
  }

  const { data: orgRow } = await supabase
    .from('organizacion')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: serviceRow, error: serviceError } = await supabase
    .from('servicios')
    .insert({
      user_id: user.id,
      organizacion_id: (orgRow?.id as string | undefined) ?? null,
      public_slug: input.publicSlug,
      nombre: input.nombre.trim() || 'Servicio Search Link',
      source_type: input.sourceType,
      source_url: input.sourceUrl || null,
      item_count: input.items.length,
      is_active: true,
      snapshot_json: input.snapshotJson ?? null,
    })
    .select('id')
    .single();

  if (serviceError || !serviceRow) {
    return {
      saved: false,
      tableMissing: isMissingTableError(serviceError),
      reason:
        serviceError?.message || 'No se pudo crear el servicio en Search Link Core.',
    };
  }

  const serviceId = serviceRow.id as string;

  const productRows = input.items.map((item, idx) => ({
    servicio_id: serviceId,
    user_id: user.id,
    position: idx,
    nombre: item.nombre,
    categoria: item.categoria,
    descripcion: item.descripcion,
    image_url: item.url,
    r2_key: item.r2Key || null,
    saved_percent: item.savedPercent ?? 0,
  }));

  const { error: productsError } = await supabase
    .from('servicio_productos')
    .insert(productRows);

  if (productsError) {
    return {
      saved: false,
      serviceId,
      tableMissing: isMissingTableError(productsError),
      reason: productsError.message,
    };
  }

  const { error: keyError } = await supabase.from('servicio_api_keys').insert({
    servicio_id: serviceId,
    user_id: user.id,
    label: 'Llave principal',
    key_prefix: input.keyPrefix,
    key_hash: input.keyHash,
    is_active: true,
  });

  if (keyError) {
    return {
      saved: false,
      serviceId,
      tableMissing: isMissingTableError(keyError),
      reason: keyError.message,
    };
  }

  return { saved: true, serviceId };
}

export async function renameCoreServiceInSupabase(
  serviceId: string,
  nextName: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('servicios')
    .update({ nombre: nextName.trim() || 'Servicio Search Link' })
    .eq('id', serviceId);
  return !error;
}

export async function toggleCoreServiceActiveInSupabase(
  serviceId: string,
  isActive: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('servicios')
    .update({ is_active: isActive })
    .eq('id', serviceId);
  return !error;
}

export async function rotateCoreServiceApiKeyInSupabase(input: {
  serviceId: string;
  keyPrefix: string;
  keyHash: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) {
    return { ok: false, reason: 'Supabase no está configurado.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: 'Inicia sesión para rotar la API Key.' };
  }

  await supabase
    .from('servicio_api_keys')
    .update({ is_active: false })
    .eq('servicio_id', input.serviceId)
    .eq('user_id', user.id);

  const { error } = await supabase.from('servicio_api_keys').insert({
    servicio_id: input.serviceId,
    user_id: user.id,
    label: 'Llave rotada',
    key_prefix: input.keyPrefix,
    key_hash: input.keyHash,
    is_active: true,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}
