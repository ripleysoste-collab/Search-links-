import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { verifySupabaseBearerUser } from './planLimits.ts';
import { getSupabaseServerConfig } from './supabaseServer.ts';
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
  servicesFallback?: AgencySyncFallbackService[];
}

export interface AgencySyncResponse {
  ok: true;
  remoteStatus: number;
  durationMs: number;
  syncedServices: number;
  syncedProducts: number;
  syncedAt: string;
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
