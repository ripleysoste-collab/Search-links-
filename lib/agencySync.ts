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

      let query = userClient
        .from('servicios')
        .select(
          'id, public_slug, nombre, created_at, servicio_productos(id, position, nombre, categoria, descripcion, image_url)',
        )
        .eq('user_id', authUser.userId)
        .order('created_at', { ascending: false });

      if (serviceScope !== 'all') {
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
    } catch {
      // Fall back cleanly to validated client snapshot if Supabase is unavailable
    }
  }

  if (resolvedServices.length === 0 && Array.isArray(input.servicesFallback)) {
    const filtered =
      serviceScope === 'all'
        ? input.servicesFallback
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

  if (resolvedServices.length === 0) {
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
    scope: serviceScope === 'all' ? 'all' : 'single',
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
    if (data.service_scope !== 'all') return;
    if (typeof data.server_url !== 'string' || typeof data.secret_key !== 'string') {
      return;
    }

    await executeAgencyServerSync(
      { authorization: `Bearer ${input.authUser.accessToken}` },
      {
        serverUrl: data.server_url,
        serviceScope: 'all',
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
