import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FREE_PLAN_MAX_API_REQUESTS_MONTHLY,
  isMonthlyApiQuotaExceeded,
  recordAndCheckMonthlyApiQuota,
} from './planLimits.ts';

let cachedServerClient: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = 'https://nhofuamltqglrgfjucof.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_wKhXyZ7s3CtT4NcU8Nx8EQ_T9TZsxFI';

const CORE_CATALOG_CACHE_TTL_MS = 120_000;
const CORE_CATALOG_CACHE_MAX_ENTRIES = 1000;

interface CachedCoreCatalogEntry {
  expiresAt: number;
  keyHash: string;
  slug: string;
  scopeId: string;
  data: SearchLinkCoreResponse | PublicCatalogResult;
}

const coreCatalogCache = new Map<string, CachedCoreCatalogEntry>();

const EXTERNAL_SERVER_STATUS_TTL_MS = 30_000;
const EXTERNAL_SERVER_CACHE_MAX_ENTRIES = 2000;
const externalServerStatusCache = new Map<
  string,
  { active: boolean; expiresAt: number }
>();

export function markExternalServerActiveForKeyHashes(
  keyHashes: string[],
  active = true,
): void {
  const expiresAt = Date.now() + EXTERNAL_SERVER_STATUS_TTL_MS;
  for (const rawHash of keyHashes) {
    const normalized = rawHash.trim();
    if (!normalized) continue;
    if (externalServerStatusCache.size >= EXTERNAL_SERVER_CACHE_MAX_ENTRIES) {
      const oldestKey = externalServerStatusCache.keys().next().value;
      if (oldestKey) externalServerStatusCache.delete(oldestKey);
    }
    externalServerStatusCache.set(normalized, {
      active,
      expiresAt: active ? Date.now() + 24 * 60 * 60 * 1000 : expiresAt,
    });
    if (active) {
      invalidateCoreCatalogCache({ keyHash: normalized });
    }
  }
}

async function isExternalServerActiveForKeyHash(
  supabase: SupabaseClient,
  keyHash: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = externalServerStatusCache.get(keyHash);
  if (cached && cached.expiresAt > now) {
    return cached.active;
  }

  try {
    const { data, error } = await supabase.rpc(
      'check_external_server_by_key_hash',
      { p_key_hash: keyHash },
    );
    if (error) {
      // Gracefully allow until servidores_externos SQL migration is executed
      return false;
    }
    const isActive = data === true;
    if (externalServerStatusCache.size >= EXTERNAL_SERVER_CACHE_MAX_ENTRIES) {
      const oldestKey = externalServerStatusCache.keys().next().value;
      if (oldestKey) externalServerStatusCache.delete(oldestKey);
    }
    externalServerStatusCache.set(keyHash, {
      active: isActive,
      expiresAt: now + EXTERNAL_SERVER_STATUS_TTL_MS,
    });
    return isActive;
  } catch {
    return false;
  }
}

export function invalidateCoreCatalogCache(filter?: {
  slug?: string;
  keyHash?: string;
}): void {
  if (!filter || (!filter.slug && !filter.keyHash)) {
    coreCatalogCache.clear();
    return;
  }
  const targetSlug = filter.slug?.trim().toLowerCase();
  const targetKeyHash = filter.keyHash?.trim();

  for (const [cacheKey, entry] of coreCatalogCache.entries()) {
    if (
      (targetKeyHash && entry.keyHash === targetKeyHash) ||
      (targetSlug && entry.slug === targetSlug)
    ) {
      coreCatalogCache.delete(cacheKey);
    }
  }
}

export const SEARCH_LINK_CORE_NAME = 'Search Link Core';
export const SEARCH_LINK_CORE_VERSION = '1.0';

function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^["']|["']$/g, '').trim();
}

function normalizeSupabaseUrl(raw: string | undefined): string {
  let cleaned = cleanEnv(raw).replace(/^(?:VITE_)?SUPABASE_URL\s*=\s*/i, '').trim();
  if (!cleaned) return '';
  if (!/^https?:\/\//i.test(cleaned) && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Fall back to default below
  }
  return '';
}

function normalizeSupabaseKey(raw: string | undefined): string {
  return cleanEnv(raw)
    .replace(/^(?:VITE_)?SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*=\s*/i, '')
    .trim();
}

export function getSupabaseServerConfig(): { url: string; key: string } {
  const url =
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;
  const key =
    normalizeSupabaseKey(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    normalizeSupabaseKey(process.env.SUPABASE_ANON_KEY) ||
    normalizeSupabaseKey(process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return { url, key };
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedAdminSignature = '';

export function getSupabaseServerClient(): SupabaseClient | null {
  if (cachedServerClient) return cachedServerClient;
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return null;

  cachedServerClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedServerClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const { url } = getSupabaseServerConfig();
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
    .replace(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*/i, '')
    .trim();
  if (!url || !serviceRoleKey || /^TU_/i.test(serviceRoleKey)) return null;
  const sig = `${url}:${serviceRoleKey.slice(0, 16)}`;
  if (!cachedAdminClient || cachedAdminSignature !== sig) {
    cachedAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedAdminSignature = sig;
  }
  return cachedAdminClient;
}

export interface SearchLinkCoreProduct {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  imagen_url: string;
  url: string;
  ahorro_porcentaje?: number;
}

export interface SearchLinkCoreResponse {
  system: string;
  version: string;
  organizacion: {
    nombre: string;
    logo_url: string | null;
  };
  servicio: {
    id: string;
    slug: string;
    nombre: string;
    origen: string;
    origen_url: string | null;
    creado_en: string;
  };
  filtros: {
    q: string | null;
    categoria: string | null;
    categorias_disponibles: string[];
  };
  paginacion: {
    total: number;
    devueltos: number;
    limit: number;
    offset: number;
  };
  total_productos: number;
  productos: SearchLinkCoreProduct[];
}

export interface PublicCatalogResult {
  total_productos: number;
  productos: Array<{
    nombre: string;
    categoria: string;
    descripcion: string;
    url: string;
  }>;
  catalogos: Array<{
    id: string;
    titulo: string;
    tipo: string;
    origen_url: string | null;
    creado_en: string;
    items: Array<{
      nombre: string;
      categoria: string;
      descripcion: string;
      url: string;
    }>;
  }>;
}

export interface SearchLinkCoreQueryInput {
  apiKey: string;
  slug?: string;
  query?: string;
  categoria?: string;
  limit?: number;
  offset?: number;
  bypassExternalServerCheck?: boolean;
}

function sha256HexServer(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function getHeaderSingle(
  headers: IncomingHttpHeaders,
  name: string,
): string {
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) return (raw[0] || '').trim();
  return typeof raw === 'string' ? raw.trim() : '';
}

export function extractCoreRequestParams(
  rawUrl: string | undefined,
  headers: IncomingHttpHeaders,
  slugOverride?: string,
): SearchLinkCoreQueryInput {
  const rawAuth = getHeaderSingle(headers, 'authorization');
  const bearerKey = rawAuth.toLowerCase().startsWith('bearer ')
    ? rawAuth.slice(7).trim()
    : '';
  const headerKey = getHeaderSingle(headers, 'x-api-key');

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(rawUrl || '/', 'http://localhost');
  } catch {
    parsedUrl = null;
  }

  const queryKey = (
    parsedUrl?.searchParams.get('key') ||
    parsedUrl?.searchParams.get('apiKey') ||
    parsedUrl?.searchParams.get('api_key') ||
    ''
  ).trim();

  const rawLimit = Number(parsedUrl?.searchParams.get('limit') || '50');
  const rawOffset = Number(parsedUrl?.searchParams.get('offset') || '0');

  const query = (
    parsedUrl?.searchParams.get('q') ||
    parsedUrl?.searchParams.get('search') ||
    parsedUrl?.searchParams.get('buscar') ||
    ''
  ).trim();

  const categoria = (
    parsedUrl?.searchParams.get('categoria') ||
    parsedUrl?.searchParams.get('category') ||
    ''
  ).trim();

  const rawSlug = (
    slugOverride ||
    parsedUrl?.searchParams.get('slug') ||
    parsedUrl?.searchParams.get('service') ||
    ''
  ).trim();

  return {
    apiKey: bearerKey || headerKey || queryKey,
    slug: rawSlug || undefined,
    query: query || undefined,
    categoria: categoria || undefined,
    limit: Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 50,
    offset: Number.isFinite(rawOffset)
      ? Math.max(Math.trunc(rawOffset), 0)
      : 0,
  };
}

export async function resolveSearchLinkCoreEndpoint(
  params: SearchLinkCoreQueryInput,
): Promise<
  | {
      ok: true;
      data: SearchLinkCoreResponse | PublicCatalogResult;
    }
  | { ok: false; status: number; error: string }
> {
  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return {
      ok: false,
      status: 401,
      error:
        'Falta la API Key de Search Link Core. Envíala en ?key=tu_llave, header x-api-key o Authorization: Bearer tu_llave.',
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      status: 500,
      error: 'Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en el servidor.',
    };
  }

  const keyHash = sha256HexServer(trimmedKey);
  if (!params.bypassExternalServerCheck) {
    const externalActive = await isExternalServerActiveForKeyHash(
      supabase,
      keyHash,
    );
    if (externalActive) {
      invalidateCoreCatalogCache({ keyHash });
      return {
        ok: false,
        status: 403,
        error:
          'Esta cuenta tiene un servidor externo conectado. Las peticiones de catálogo deben realizarse directamente a tu propio servidor.',
      };
    }
  }

  if (isMonthlyApiQuotaExceeded(keyHash)) {
    return {
      ok: false,
      status: 429,
      error: `Límite mensual alcanzado: el plan gratuito incluye hasta ${FREE_PLAN_MAX_API_REQUESTS_MONTHLY} peticiones API por mes.`,
    };
  }

  const safeSlug = params.slug?.trim() || '';
  const safeQuery = params.query?.trim() || '';
  const safeCategoria = params.categoria?.trim() || '';
  const safeLimit =
    typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? Math.min(Math.max(Math.trunc(params.limit), 1), 100)
      : 50;
  const safeOffset =
    typeof params.offset === 'number' && Number.isFinite(params.offset)
      ? Math.max(Math.trunc(params.offset), 0)
      : 0;

  const cacheKey = `${keyHash}|${safeSlug.toLowerCase()}|${safeQuery.toLowerCase()}|${safeCategoria.toLowerCase()}|${safeLimit}|${safeOffset}`;
  const now = Date.now();
  const cached = coreCatalogCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    const quota = recordAndCheckMonthlyApiQuota(cached.scopeId, keyHash);
    if (!quota.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Límite mensual alcanzado: el plan gratuito incluye hasta ${FREE_PLAN_MAX_API_REQUESTS_MONTHLY} peticiones API por mes.`,
      };
    }
    return {
      ok: true,
      data: cached.data,
    };
  }
  if (cached) {
    coreCatalogCache.delete(cacheKey);
  }

  const { data, error } = await supabase.rpc('search_link_core_resolve', {
    p_key_hash: keyHash,
    p_slug: safeSlug || null,
    p_query: safeQuery || null,
    p_categoria: safeCategoria || null,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });

  if (error) {
    const isMissingCoreRpc =
      error.code === 'PGRST202' ||
      error.message.includes('search_link_core_resolve');

    if (isMissingCoreRpc && !params.slug) {
      // Optional backward compatibility with legacy get_catalog_by_api_key if present
      const legacy = await fetchCatalogByApiKey(trimmedKey);
      if (legacy.ok) {
        const legacyScope = `legacy:${keyHash.slice(0, 16)}`;
        const quota = recordAndCheckMonthlyApiQuota(legacyScope, keyHash);
        if (!quota.allowed) {
          return {
            ok: false,
            status: 429,
            error: `Límite mensual alcanzado: el plan gratuito incluye hasta ${FREE_PLAN_MAX_API_REQUESTS_MONTHLY} peticiones API por mes.`,
          };
        }
        return legacy;
      }
    }

    return {
      ok: false,
      status: isMissingCoreRpc ? 503 : 500,
      error: isMissingCoreRpc
        ? 'El motor Search Link Core aún requiere ejecutar su script SQL en Supabase.'
        : `Error en Search Link Core: ${error.message}`,
    };
  }

  const record = data as
    | (SearchLinkCoreResponse & { error?: string; status?: number })
    | null;

  if (!record) {
    return {
      ok: false,
      status: 401,
      error: 'API Key inválida, pausada o servicio no encontrado.',
    };
  }

  if (record.error) {
    return {
      ok: false,
      status: typeof record.status === 'number' ? record.status : 401,
      error: record.error,
    };
  }

  const catalogosList = (record as unknown as Partial<PublicCatalogResult>)
    .catalogos;
  const scopeId =
    record.servicio?.id ||
    (Array.isArray(catalogosList) && catalogosList[0]?.id) ||
    `key:${keyHash.slice(0, 16)}`;

  let carriedMonthlyApiHint = 0;
  try {
    const { data: ledgerApiCount, error: ledgerApiErr } = await supabase.rpc(
      'get_monthly_api_usage_by_key_hash',
      { p_key_hash: keyHash },
    );
    if (
      !ledgerApiErr &&
      typeof ledgerApiCount === 'number' &&
      Number.isFinite(ledgerApiCount)
    ) {
      carriedMonthlyApiHint = Math.max(0, Math.trunc(ledgerApiCount));
    }
  } catch {
    carriedMonthlyApiHint = 0;
  }

  const quota = recordAndCheckMonthlyApiQuota(
    scopeId,
    keyHash,
    carriedMonthlyApiHint,
  );
  if (!quota.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Límite mensual alcanzado: el plan gratuito incluye hasta ${FREE_PLAN_MAX_API_REQUESTS_MONTHLY} peticiones API por mes.`,
    };
  }

  if (coreCatalogCache.size >= CORE_CATALOG_CACHE_MAX_ENTRIES) {
    const oldestKey = coreCatalogCache.keys().next().value;
    if (oldestKey) coreCatalogCache.delete(oldestKey);
  }
  coreCatalogCache.set(cacheKey, {
    expiresAt: now + CORE_CATALOG_CACHE_TTL_MS,
    keyHash,
    slug: (record.servicio?.slug || safeSlug).toLowerCase(),
    scopeId,
    data: record,
  });

  return {
    ok: true,
    data: record,
  };
}

async function fetchCatalogByApiKey(
  rawApiKey: string,
): Promise<
  | { ok: true; data: PublicCatalogResult }
  | { ok: false; status: number; error: string }
> {
  const trimmedKey = rawApiKey.trim();
  if (!trimmedKey) {
    return {
      ok: false,
      status: 401,
      error: 'Falta la API Key (envía ?key=tu_llave o Authorization: Bearer tu_llave).',
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      status: 500,
      error: 'Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en el servidor.',
    };
  }

  const { data, error } = await supabase.rpc('get_catalog_by_api_key', {
    p_api_key: trimmedKey,
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      error:
        error.message.includes('get_catalog_by_api_key')
          ? 'Aún no se ha ejecutado el script SQL de Search Link Core en Supabase.'
          : `Error al consultar Supabase: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 401,
      error: 'API Key inválida o revocada.',
    };
  }

  return {
    ok: true,
    data: data as PublicCatalogResult,
  };
}

export function getSearchLinkCoreManifest(origin?: string) {
  const base = origin ? origin.replace(/\/+$/, '') : '';
  return {
    ok: true,
    system: SEARCH_LINK_CORE_NAME,
    version: SEARCH_LINK_CORE_VERSION,
    status: 'operational',
    auth_methods: [
      'Authorization: Bearer <api_key>',
      'x-api-key: <api_key>',
      '?key=<api_key>',
    ],
    endpoints: {
      service_catalog: `${base}/api/v1/services/{slug}`,
      universal_catalog: `${base}/api/v1/catalog`,
      core_manifest: `${base}/api/v1/core`,
    },
    query_parameters: {
      q: 'Búsqueda por nombre, categoría o descripción',
      categoria: 'Filtro exacto/parcial por categoría',
      limit: 'Cantidad de resultados (1-100, defecto 50)',
      offset: 'Desplazamiento para paginación (defecto 0)',
    },
  };
}
