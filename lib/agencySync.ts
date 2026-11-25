import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  verifySupabaseBearerUser,
  type AuthenticatedRequestUser,
} from './planLimits.ts';
import {
  getSupabaseServerConfig,
  invalidateCoreCatalogCache,
  markExternalServerActiveForKeyHashes,
} from './supabaseServer.ts';
import {
  assertSafePublicUrl,
  PolicyBlockedDomainError,
  safeFetch,
} from './urlSafety.ts';

export interface AgencySyncFallbackProduct {
  id?: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
}

export interface AgencySyncFallbackService {
  id: string;
  slug?: string;
  name: string;
  createdAt?: string;
  products?: AgencySyncFallbackProduct[];
}

export type AgencySyncEventType = 'manual' | 'service.created' | 'service.updated';

export interface AgencySyncRequestInput {
  serverUrl: string;
  serviceScope: string;
  secretKey: string;
  eventType?: AgencySyncEventType;
  changedServiceId?: string;
  dedupeKey?: string;
  servicesFallback?: AgencySyncFallbackService[];
}

export interface AgencySyncResponse {
  ok: true;
  remoteStatus: number;
  durationMs: number;
  syncedServices: number;
  syncedProducts: number;
  syncedAt: string;
  deduplicated?: boolean;
}

export type AgencySyncResult =
  | AgencySyncResponse
  | {
      ok: false;
      status: number;
      remoteStatus?: number;
      durationMs?: number;
      error: string;
    };

interface NormalizedSyncService {
  id: string;
  slug: string;
  nombre: string;
  creado_en: string;
  productos: Array<{
    id: string;
    nombre: string;
    categoria: string;
    descripcion: string;
    imagen_url: string;
    url: string;
  }>;
}

function getBearerToken(headers: IncomingHttpHeaders): string {
  const rawAuth = headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

const DEDUPE_WINDOW_MS = 30_000;
const recentSyncDedupeMap = new Map<string, number>();

function isDuplicateRecentSync(dedupeKey?: string): boolean {
  const clean = (dedupeKey || '').trim();
  if (!clean) return false;
  const now = Date.now();
  for (const [key, exp] of recentSyncDedupeMap.entries()) {
    if (exp <= now) recentSyncDedupeMap.delete(key);
  }
  const existingExp = recentSyncDedupeMap.get(clean);
  if (existingExp && existingExp > now) {
    return true;
  }
  if (recentSyncDedupeMap.size >= 2000) {
    const oldest = recentSyncDedupeMap.keys().next().value;
    if (oldest) recentSyncDedupeMap.delete(oldest);
  }
  recentSyncDedupeMap.set(clean, now + DEDUPE_WINDOW_MS);
  return false;
}

export async function executeAgencyServerSync(
  headers: IncomingHttpHeaders,
  input: AgencySyncRequestInput,
): Promise<AgencySyncResult> {
  const authUser = await verifySupabaseBearerUser(headers);
  const bearerToken = getBearerToken(headers);

  if (!authUser || !bearerToken) {
    return {
      ok: false,
      status: 401,
      error: 'Inicia sesión con Google para sincronizar tus servicios.',
    };
  }

  const scopedDedupeKey = input.dedupeKey?.trim()
    ? `${authUser.userId}:${input.dedupeKey.trim()}`
    : undefined;
  if (isDuplicateRecentSync(scopedDedupeKey)) {
    return {
      ok: true,
      remoteStatus: 200,
      durationMs: 1,
      syncedServices: 1,
      syncedProducts: 0,
      syncedAt: new Date().toISOString(),
      deduplicated: true,
    };
  }

  const rawServerUrl = typeof input.serverUrl === 'string' ? input.serverUrl.trim() : '';
  if (!rawServerUrl) {
    return {
      ok: false,
      status: 400,
      error: 'Falta la URL de tu servidor receptor.',
    };
  }

  let parsedSafeUrl: URL;
  try {
    parsedSafeUrl = await assertSafePublicUrl(rawServerUrl);
  } catch (err) {
    if (err instanceof PolicyBlockedDomainError) {
      return { ok: false, status: 400, error: err.message };
    }
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : 'La URL del servidor no es válida.',
    };
  }

  const serviceScope =
    typeof input.serviceScope === 'string' ? input.serviceScope.trim() : '';
  if (!serviceScope) {
    return {
      ok: false,
      status: 400,
      error: 'Escoge un servicio o selecciona "Sincronizar todos".',
    };
  }

  const secretKey =
    typeof input.secretKey === 'string' ? input.secretKey.trim() : '';
  if (secretKey.length < 12) {
    return {
      ok: false,
      status: 400,
      error: 'La clave secreta no es válida.',
    };
  }

  const isNewScope = serviceScope === 'new';
  const isManualNewHandshake = isNewScope && input.eventType === 'manual';

  let orgName = 'Sin nombre';
  let orgLogoUrl: string | null = null;
  let resolvedServices: NormalizedSyncService[] = [];
  let userClient: SupabaseClient | null = null;

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
  if (supabaseUrl && supabaseKey) {
    try {
      userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      });

      const { data: orgRow } = await userClient
        .from('organizacion')
        .select('nombre, logo_url')
        .eq('user_id', authUser.userId)
        .maybeSingle();

      if (orgRow) {
        if (typeof orgRow.nombre === 'string' && orgRow.nombre.trim()) {
          orgName = orgRow.nombre.trim();
        }
        if (typeof orgRow.logo_url === 'string' && orgRow.logo_url.trim()) {
          orgLogoUrl = orgRow.logo_url.trim();
        }
      }

      if (!isManualNewHandshake) {
        const targetNewServiceId = isNewScope ? (input.changedServiceId || '').trim() : '';
        if (!isNewScope || targetNewServiceId) {
          let query = userClient
            .from('servicios')
            .select(
              'id, public_slug, nombre, created_at, servicio_productos(id, position, nombre, categoria, descripcion, image_url)',
            )
            .eq('user_id', authUser.userId)
            .order('created_at', { ascending: false });

          if (isNewScope) {
            query = query.eq('id', targetNewServiceId);
          } else if (serviceScope !== 'all') {
            query = query.eq('id', serviceScope);
          }

          const { data: srvRows, error: srvError } = await query;
          if (!srvError && Array.isArray(srvRows) && srvRows.length > 0) {
            resolvedServices = srvRows.map((row) => {
              const rawProducts = Array.isArray(row.servicio_productos)
                ? [...row.servicio_productos].sort(
                    (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
                  )
                : [];

              return {
                id: String(row.id),
                slug: String(row.public_slug || row.id),
                nombre: String(row.nombre || 'Servicio'),
                creado_en: String(row.created_at || new Date().toISOString()),
                productos: rawProducts.map((p) => ({
                  id: String(p.id),
                  nombre: String(p.nombre || 'Producto'),
                  categoria: String(p.categoria || 'General'),
                  descripcion: String(p.descripcion || ''),
                  imagen_url: String(p.image_url || ''),
                  url: String(p.image_url || ''),
                })),
              };
            });
          }
        }
      }
    } catch {
      // Fall back cleanly to validated client snapshot if Supabase is unavailable
    }
  }

  if (
    !isManualNewHandshake &&
    resolvedServices.length === 0 &&
    Array.isArray(input.servicesFallback)
  ) {
    const targetNewServiceId = isNewScope ? (input.changedServiceId || '').trim() : '';
    const filtered =
      serviceScope === 'all'
        ? input.servicesFallback
        : isNewScope
          ? targetNewServiceId
            ? input.servicesFallback.filter((s) => s && s.id === targetNewServiceId)
            : []
          : input.servicesFallback.filter((s) => s && s.id === serviceScope);

    resolvedServices = filtered.map((srv) => ({
      id: String(srv.id),
      slug: String(srv.slug || srv.id),
      nombre: String(srv.name || 'Servicio'),
      creado_en: String(srv.createdAt || new Date().toISOString()),
      productos: Array.isArray(srv.products)
        ? srv.products.map((p, idx) => ({
            id: String(p.id || `item_${idx + 1}`),
            nombre: String(p.nombre || 'Producto'),
            categoria: String(p.categoria || 'General'),
            descripcion: String(p.descripcion || ''),
            imagen_url: String(p.url || ''),
            url: String(p.url || ''),
          }))
        : [],
    }));
  }

  if (!isManualNewHandshake && resolvedServices.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'No se encontraron servicios para sincronizar en tu cuenta.',
    };
  }

  const syncedAt = new Date().toISOString();
  const totalProducts = resolvedServices.reduce(
    (sum, srv) => sum + srv.productos.length,
    0,
  );
  const webhookEventName =
    input.eventType === 'service.created'
      ? 'searchlink.service.created'
      : input.eventType === 'service.updated'
        ? 'searchlink.service.updated'
        : 'searchlink.catalog.sync';

  const payload = {
    event: webhookEventName,
    version: '1.0',
    synced_at: syncedAt,
    scope:
      serviceScope === 'all'
        ? 'all'
        : serviceScope === 'new'
          ? 'new'
          : 'single',
    ...(input.changedServiceId ? { changed_service_id: input.changedServiceId } : {}),
    organizacion: {
      nombre: orgName,
      logo_url: orgLogoUrl,
    },
    total_servicios: resolvedServices.length,
    total_productos: totalProducts,
    servicios: resolvedServices.map((srv) => ({
      id: srv.id,
      slug: srv.slug,
      nombre: srv.nombre,
      creado_en: srv.creado_en,
      total_productos: srv.productos.length,
      productos: srv.productos,
    })),
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const startedAt = Date.now();
  try {
    const { response } = await safeFetch(parsedSafeUrl.href, {
      method: 'POST',
      timeoutMs: 12_000,
      maxRedirects: 2,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'SearchLink-Agency-Sync/1.0',
        'X-SearchLink-Event': webhookEventName,
        'X-SearchLink-Timestamp': timestamp,
        'X-SearchLink-Signature': `sha256=${signature}`,
      },
      body: rawBody,
    });

    const durationMs = Math.max(1, Date.now() - startedAt);
    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        remoteStatus: response.status,
        durationMs,
        error: `Tu servidor respondió con código HTTP ${response.status}. Verifica que acepte peticiones POST en esa URL.`,
      };
    }

    if (userClient) {
      try {
        await userClient.from('servidores_externos').upsert(
          {
            user_id: authUser.userId,
            user_email: authUser.email || null,
            server_url: parsedSafeUrl.href,
            service_scope: serviceScope,
            secret_key: secretKey,
            auto_sync_enabled: true,
            last_synced_at: syncedAt,
            last_event: webhookEventName,
            last_remote_status: response.status,
            last_duration_ms: durationMs,
          },
          { onConflict: 'user_id' },
        );
      } catch {
        // Non-fatal if servidores_externos SQL migration has not been run yet
      }

      try {
        const [{ data: keyRows }, { data: slugRows }] = await Promise.all([
          userClient
            .from('servicio_api_keys')
            .select('key_hash')
            .eq('user_id', authUser.userId)
            .eq('is_active', true),
          userClient
            .from('servicios')
            .select('public_slug')
            .eq('user_id', authUser.userId),
        ]);

        if (Array.isArray(keyRows)) {
          const hashes = keyRows
            .map((r) => (typeof r.key_hash === 'string' ? r.key_hash : ''))
            .filter(Boolean);
          if (hashes.length > 0) {
            markExternalServerActiveForKeyHashes(hashes, true);
          }
        }
        if (Array.isArray(slugRows)) {
          for (const row of slugRows) {
            if (typeof row.public_slug === 'string' && row.public_slug.trim()) {
              invalidateCoreCatalogCache({ slug: row.public_slug });
            }
          }
        }
      } catch {
        // Non-fatal cache invalidation guard
      }
    }

    return {
      ok: true,
      remoteStatus: response.status,
      durationMs,
      syncedServices: resolvedServices.length,
      syncedProducts: totalProducts,
      syncedAt,
    };
  } catch (err) {
    const durationMs = Math.max(1, Date.now() - startedAt);
    const detail =
      err instanceof Error ? err.message : 'No se pudo conectar con tu servidor.';
    return {
      ok: false,
      status: 502,
      durationMs,
      error: `No pudimos entregar los datos a tu servidor (${detail}).`,
    };
  }
}

export async function triggerServerAgencyAutoSyncOnServiceCreated(input: {
  authUser: AuthenticatedRequestUser;
  serviceId: string | null;
  fallbackService?: AgencySyncFallbackService;
}): Promise<void> {
  if (!input.serviceId || !input.authUser.accessToken) return;
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const userClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${input.authUser.accessToken}`,
        },
      },
    });

    const { data, error } = await userClient
      .from('servidores_externos')
      .select('server_url, service_scope, secret_key, auto_sync_enabled')
      .eq('user_id', input.authUser.userId)
      .maybeSingle();

    if (error || !data) return;
    if (!data.auto_sync_enabled) return;
    if (data.service_scope !== 'all' && data.service_scope !== 'new') return;
    if (typeof data.server_url !== 'string' || typeof data.secret_key !== 'string') {
      return;
    }

    await executeAgencyServerSync(
      { authorization: `Bearer ${input.authUser.accessToken}` },
      {
        serverUrl: data.server_url,
        serviceScope: data.service_scope,
        secretKey: data.secret_key,
        eventType: 'service.created',
        changedServiceId: input.serviceId,
        dedupeKey: `service.created:${input.serviceId}`,
        servicesFallback: input.fallbackService ? [input.fallbackService] : undefined,
      },
    );
  } catch {
    // Non-fatal background auto-sync guard
  }
}

export type AgencyDisconnectResult =
  | {
      ok: true;
      disconnectedAt: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function executeAgencyServerDisconnect(
  headers: IncomingHttpHeaders,
): Promise<AgencyDisconnectResult> {
  const authUser = await verifySupabaseBearerUser(headers);
  const bearerToken = getBearerToken(headers);

  if (!authUser || !bearerToken) {
    return {
      ok: false,
      status: 401,
      error: 'Inicia sesión con Google para desconectar tu servidor.',
    };
  }

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
  if (supabaseUrl && supabaseKey) {
    try {
      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      });

      const [{ data: keyRows }, { data: slugRows }] = await Promise.all([
        userClient
          .from('servicio_api_keys')
          .select('key_hash')
          .eq('user_id', authUser.userId),
        userClient
          .from('servicios')
          .select('public_slug')
          .eq('user_id', authUser.userId),
      ]);

      try {
        await userClient
          .from('servidores_externos')
          .delete()
          .eq('user_id', authUser.userId);
      } catch {
        // Non-fatal if servidores_externos SQL migration has not been run yet
      }

      if (Array.isArray(keyRows)) {
        const hashes = keyRows
          .map((r) => (typeof r.key_hash === 'string' ? r.key_hash : ''))
          .filter(Boolean);
        if (hashes.length > 0) {
          markExternalServerActiveForKeyHashes(hashes, false);
        }
      }

      if (Array.isArray(slugRows) && slugRows.length > 0) {
        for (const row of slugRows) {
          if (typeof row.public_slug === 'string' && row.public_slug.trim()) {
            invalidateCoreCatalogCache({ slug: row.public_slug });
          }
        }
      } else {
        invalidateCoreCatalogCache();
      }
    } catch {
      // Non-fatal fallback: ensure local/client state still disconnects cleanly
    }
  }

  return {
    ok: true,
    disconnectedAt: new Date().toISOString(),
  };
}

export interface AgencyServerTestItem {
  id: string;
  nombre: string;
  categoria: string;
  imagen_url: string;
  servicio_nombre?: string;
  servicio_slug?: string;
}

export type AgencyServerTestResult =
  | {
      ok: true;
      remoteStatus: number;
      statusText: string;
      durationMs: number;
      endpointUrl: string;
      totalProducts: number;
      items: AgencyServerTestItem[];
    }
  | {
      ok: false;
      status: number;
      remoteStatus?: number;
      statusText?: string;
      durationMs?: number;
      error: string;
    };

function buildCatalogTestCandidateUrls(parsedUrl: URL): string[] {
  const candidates: string[] = [];
  const rawPath = parsedUrl.pathname || '/';

  const pushUnique = (href: string) => {
    if (!candidates.includes(href)) {
      candidates.push(href);
    }
  };

  if (/\/api\/catalog\/?$/i.test(rawPath)) {
    pushUnique(parsedUrl.href);
  } else if (/\/webhook\/?$/i.test(rawPath)) {
    const stripped = rawPath.replace(/\/webhook\/?$/i, '') || '';
    pushUnique(`${parsedUrl.origin}${stripped}/api/catalog`);
    pushUnique(`${parsedUrl.origin}/api/catalog`);
  } else {
    const baseDir = rawPath === '/' ? '' : rawPath.replace(/\/+$/, '');
    if (baseDir) {
      pushUnique(`${parsedUrl.origin}${baseDir}/api/catalog`);
    }
    pushUnique(`${parsedUrl.origin}/api/catalog`);
  }

  pushUnique(parsedUrl.href);
  return candidates;
}

function appendCatalogPagination(
  baseHref: string,
  limit: number,
  offset: number,
): string {
  const target = new URL(baseHref);
  target.searchParams.set('limit', String(limit));
  target.searchParams.set('offset', String(offset));
  return target.href;
}

function extractItemsFromExternalCatalog(payload: unknown): {
  items: AgencyServerTestItem[];
  reportedTotal: number | null;
} {
  const obj =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  const rawList = Array.isArray(payload)
    ? payload
    : obj && Array.isArray(obj.productos)
      ? obj.productos
      : obj && Array.isArray(obj.products)
        ? obj.products
        : obj && Array.isArray(obj.items)
          ? obj.items
          : obj && Array.isArray(obj.data)
            ? obj.data
            : [];

  const pag =
    obj?.paginacion && typeof obj.paginacion === 'object'
      ? (obj.paginacion as Record<string, unknown>)
      : null;
  const reportedTotal =
    pag && typeof pag.total === 'number' && Number.isFinite(pag.total)
      ? Math.max(0, Math.trunc(pag.total))
      : null;

  const items: AgencyServerTestItem[] = [];
  for (let idx = 0; idx < rawList.length; idx += 1) {
    const entry = rawList[idx];
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const rawImg =
      typeof rec.imagen_url === 'string' && rec.imagen_url.trim()
        ? rec.imagen_url.trim()
        : typeof rec.url === 'string' && rec.url.trim()
          ? rec.url.trim()
          : '';
    const safeImg = /^https?:\/\//i.test(rawImg) ? rawImg : '';

    items.push({
      id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `item_${idx + 1}`,
      nombre:
        typeof rec.nombre === 'string' && rec.nombre.trim()
          ? rec.nombre.trim()
          : typeof rec.name === 'string' && rec.name.trim()
            ? rec.name.trim()
            : `Producto ${idx + 1}`,
      categoria:
        typeof rec.categoria === 'string' && rec.categoria.trim()
          ? rec.categoria.trim()
          : typeof rec.category === 'string' && rec.category.trim()
            ? rec.category.trim()
            : 'General',
      imagen_url: safeImg,
      servicio_nombre:
        typeof rec.servicio_nombre === 'string' && rec.servicio_nombre.trim()
          ? rec.servicio_nombre.trim()
          : undefined,
      servicio_slug:
        typeof rec.servicio_slug === 'string' && rec.servicio_slug.trim()
          ? rec.servicio_slug.trim()
          : undefined,
    });
  }

  return { items, reportedTotal };
}

export async function executeAgencyServerTest(
  headers: IncomingHttpHeaders,
  input?: { serverUrl?: string },
): Promise<AgencyServerTestResult> {
  const authUser = await verifySupabaseBearerUser(headers);
  const bearerToken = getBearerToken(headers);

  if (!authUser || !bearerToken) {
    return {
      ok: false,
      status: 401,
      error: 'Inicia sesión con Google para evaluar tu servidor.',
    };
  }

  let resolvedServerUrl =
    typeof input?.serverUrl === 'string' ? input.serverUrl.trim() : '';

  const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
  if (supabaseUrl && supabaseKey) {
    try {
      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      });
      const { data } = await userClient
        .from('servidores_externos')
        .select('server_url')
        .eq('user_id', authUser.userId)
        .maybeSingle();

      if (data && typeof data.server_url === 'string' && data.server_url.trim()) {
        resolvedServerUrl = data.server_url.trim();
      }
    } catch {
      // Fall back cleanly to client-provided URL if table isn't initialized yet
    }
  }

  if (!resolvedServerUrl) {
    return {
      ok: false,
      status: 400,
      error: 'No hay una URL de servidor conectada para evaluar.',
    };
  }

  let parsedSafeUrl: URL;
  try {
    parsedSafeUrl = await assertSafePublicUrl(resolvedServerUrl);
  } catch (err) {
    if (err instanceof PolicyBlockedDomainError) {
      return { ok: false, status: 400, error: err.message };
    }
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : 'La URL del servidor no es válida.',
    };
  }

  const candidates = buildCatalogTestCandidateUrls(parsedSafeUrl);
  const overallStartedAt = Date.now();
  let lastRemoteStatus: number | undefined;
  let lastStatusText: string | undefined;

  for (const candidateUrl of candidates) {
    const pageLimit = 100;
    const firstUrl = appendCatalogPagination(candidateUrl, pageLimit, 0);

    try {
      const { response } = await safeFetch(firstUrl, {
        method: 'GET',
        timeoutMs: 15_000,
        maxRedirects: 2,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SearchLink-Agency-Test/1.0',
        },
      });

      lastRemoteStatus = response.status;
      lastStatusText = response.statusText || '';

      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          continue;
        }
        return {
          ok: false,
          status: 502,
          remoteStatus: response.status,
          statusText: response.statusText || undefined,
          durationMs: Math.max(1, Date.now() - overallStartedAt),
          error: `Tu servidor respondió con HTTP ${response.status}.`,
        };
      }

      const firstJson = await response.json().catch(() => null);
      if (!firstJson || typeof firstJson !== 'object') {
        return {
          ok: false,
          status: 502,
          remoteStatus: response.status,
          statusText: response.statusText || 'OK',
          durationMs: Math.max(1, Date.now() - overallStartedAt),
          error: 'Tu servidor respondió 200 OK, pero el contenido no es JSON válido.',
        };
      }

      const firstParsed = extractItemsFromExternalCatalog(firstJson);
      const allItems: AgencyServerTestItem[] = [...firstParsed.items];
      const targetTotal = firstParsed.reportedTotal ?? allItems.length;

      let offset = pageLimit;
      let pageCount = 1;
      const MAX_PAGES = 10;

      while (
        allItems.length < targetTotal &&
        firstParsed.items.length === pageLimit &&
        pageCount < MAX_PAGES
      ) {
        const nextUrl = appendCatalogPagination(candidateUrl, pageLimit, offset);
        const { response: pageRes } = await safeFetch(nextUrl, {
          method: 'GET',
          timeoutMs: 12_000,
          maxRedirects: 2,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'SearchLink-Agency-Test/1.0',
          },
        });
        if (!pageRes.ok) break;
        const pageJson = await pageRes.json().catch(() => null);
        if (!pageJson) break;
        const pageParsed = extractItemsFromExternalCatalog(pageJson);
        if (pageParsed.items.length === 0) break;
        allItems.push(...pageParsed.items);
        if (pageParsed.items.length < pageLimit) break;
        offset += pageLimit;
        pageCount += 1;
      }

      const seenIds = new Set<string>();
      const uniqueItems = allItems.filter((item) => {
        const dedupeKey = `${item.id}:${item.imagen_url}`;
        if (seenIds.has(dedupeKey)) return false;
        seenIds.add(dedupeKey);
        return true;
      });

      return {
        ok: true,
        remoteStatus: response.status,
        statusText: response.statusText || 'OK',
        durationMs: Math.max(1, Date.now() - overallStartedAt),
        endpointUrl: candidateUrl,
        totalProducts: uniqueItems.length,
        items: uniqueItems,
      };
    } catch {
      // Try next candidate or report failure below
    }
  }

  return {
    ok: false,
    status: 502,
    remoteStatus: lastRemoteStatus,
    statusText: lastStatusText,
    durationMs: Math.max(1, Date.now() - overallStartedAt),
    error: lastRemoteStatus
      ? `Tu servidor respondió con código HTTP ${lastRemoteStatus}. Verifica que tenga activo GET /api/catalog.`
      : 'No pudimos recibir respuesta JSON de tu servidor. Verifica que esté encendido y accesible.',
  };
}


