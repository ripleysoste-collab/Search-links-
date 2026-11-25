import { resolveApiUrl } from './apiConfig';
import {
  fetchExternalServerConfigSafe,
  getSupabaseAccessToken,
  upsertExternalServerConfigSafe,
} from './supabaseClient';
import type { OrganizationServiceItem } from '../components/DesktopOrganizationView';

export type AgencySyncTriggerEvent =
  | 'manual'
  | 'service.created'
  | 'service.updated';

export interface AgencyConnectionState {
  serverUrl: string;
  selectedScope: string | null;
  secretKey: string;
  autoSyncEnabled: boolean;
  connectedAt: string | null;
  trackedNewServiceIds: string[];
  lastSyncedAt: string | null;
  lastTriggerEvent: AgencySyncTriggerEvent | null;
}

const STORAGE_PREFIX = 'searchlink_connect_server_draft_v1_';
const UPDATES_STORAGE_PREFIX = 'searchlink_server_updates_v1_';
const MAX_STORED_UPDATES = 100;
export const AGENCY_SYNC_UPDATED_EVENT = 'searchlink:agency-sync-updated';
export const AGENCY_UPDATES_UPDATED_EVENT = 'searchlink:agency-updates-updated';

export interface AgencyServerUpdateRecord {
  id: string;
  syncedAt: string;
  eventType: AgencySyncTriggerEvent;
  webhookEvent: string;
  serviceScope: string;
  serviceNames: string[];
  syncedServices: number;
  syncedProducts: number;
  durationMs: number;
  remoteStatus: number;
  serverUrl: string;
  payloadJson: string;
}

export function loadAgencyServerUpdates(userId: string): AgencyServerUpdateRecord[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(`${UPDATES_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is AgencyServerUpdateRecord =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.syncedAt === 'string' &&
              typeof item.payloadJson === 'string',
          ),
      )
      .map((item) => ({
        id: item.id,
        syncedAt: item.syncedAt,
        eventType:
          item.eventType === 'service.created' || item.eventType === 'service.updated'
            ? item.eventType
            : 'manual',
        webhookEvent:
          typeof item.webhookEvent === 'string'
            ? item.webhookEvent
            : 'searchlink.catalog.sync',
        serviceScope:
          typeof item.serviceScope === 'string' ? item.serviceScope : 'all',
        serviceNames: Array.isArray(item.serviceNames)
          ? item.serviceNames.filter((n): n is string => typeof n === 'string')
          : [],
        syncedServices:
          typeof item.syncedServices === 'number' ? item.syncedServices : 0,
        syncedProducts:
          typeof item.syncedProducts === 'number' ? item.syncedProducts : 0,
        durationMs: typeof item.durationMs === 'number' ? item.durationMs : 0,
        remoteStatus:
          typeof item.remoteStatus === 'number' ? item.remoteStatus : 200,
        serverUrl: typeof item.serverUrl === 'string' ? item.serverUrl : '',
        payloadJson: item.payloadJson,
      }));
  } catch {
    return [];
  }
}

export function saveAgencyServerUpdateRecord(
  userId: string,
  record: AgencyServerUpdateRecord,
): AgencyServerUpdateRecord[] {
  if (typeof window === 'undefined' || !userId) return [];
  const existing = loadAgencyServerUpdates(userId);
  const deduped = existing.filter(
    (entry) =>
      entry.id !== record.id &&
      !(
        entry.syncedAt === record.syncedAt &&
        entry.webhookEvent === record.webhookEvent &&
        entry.serviceScope === record.serviceScope
      ),
  );
  let next = [record, ...deduped].slice(0, MAX_STORED_UPDATES);

  while (next.length > 0) {
    try {
      window.localStorage.setItem(
        `${UPDATES_STORAGE_PREFIX}${userId}`,
        JSON.stringify(next),
      );
      break;
    } catch {
      if (next.length === 1) break;
      next = next.slice(0, Math.max(1, Math.floor(next.length * 0.7)));
    }
  }

  window.dispatchEvent(
    new CustomEvent(AGENCY_UPDATES_UPDATED_EVENT, {
      detail: { userId, updates: next },
    }),
  );
  return next;
}

export function generateAgencySecretKey(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sl_whsec_${hex}`;
}

export function loadAgencyConnectionState(userId: string): AgencyConnectionState {
  const fallback: AgencyConnectionState = {
    serverUrl: '',
    selectedScope: null,
    secretKey: generateAgencySecretKey(),
    autoSyncEnabled: false,
    connectedAt: null,
    trackedNewServiceIds: [],
    lastSyncedAt: null,
    lastTriggerEvent: null,
  };

  if (typeof window === 'undefined' || !userId) return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${userId}`,
        JSON.stringify(fallback),
      );
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<AgencyConnectionState>;
    const secretKey =
      typeof parsed.secretKey === 'string' && parsed.secretKey.trim()
        ? parsed.secretKey
        : fallback.secretKey;

    const trackedNewServiceIds = Array.isArray(parsed.trackedNewServiceIds)
      ? parsed.trackedNewServiceIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        )
      : [];

    return {
      serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : '',
      selectedScope:
        typeof parsed.selectedScope === 'string' ? parsed.selectedScope : null,
      secretKey,
      autoSyncEnabled: Boolean(parsed.autoSyncEnabled),
      connectedAt:
        typeof parsed.connectedAt === 'string' ? parsed.connectedAt : null,
      trackedNewServiceIds,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastTriggerEvent:
        parsed.lastTriggerEvent === 'manual' ||
        parsed.lastTriggerEvent === 'service.created' ||
        parsed.lastTriggerEvent === 'service.updated'
          ? parsed.lastTriggerEvent
          : null,
    };
  } catch {
    return fallback;
  }
}

export function saveAgencyConnectionState(
  userId: string,
  next: AgencyConnectionState,
  emitEvent = false,
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${userId}`,
      JSON.stringify(next),
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
  if (emitEvent) {
    window.dispatchEvent(
      new CustomEvent(AGENCY_SYNC_UPDATED_EVENT, {
        detail: { userId, state: next },
      }),
    );
  }
}

export interface ExecuteAgencySyncCallResult {
  ok: boolean;
  syncedServices?: number;
  syncedProducts?: number;
  durationMs?: number;
  syncedAt?: string;
  error?: string;
}

export async function dispatchAgencyServerSync(input: {
  userId: string;
  serverUrl: string;
  serviceScope: string;
  secretKey: string;
  services: OrganizationServiceItem[];
  eventType: AgencySyncTriggerEvent;
  changedServiceId?: string;
  dedupeKey?: string;
}): Promise<ExecuteAgencySyncCallResult> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: 'Inicia sesión nuevamente para sincronizar.',
    };
  }

  const isNewScope = input.serviceScope === 'new';
  const isManualNewHandshake = isNewScope && input.eventType === 'manual';

  const targetServices = isManualNewHandshake
    ? []
    : isNewScope
      ? input.changedServiceId
        ? input.services.filter((srv) => srv.id === input.changedServiceId)
        : []
      : input.serviceScope === 'all'
        ? input.services
        : input.services.filter((srv) => srv.id === input.serviceScope);

  if (!isManualNewHandshake && targetServices.length === 0) {
    return {
      ok: false,
      error: 'No hay servicios disponibles para sincronizar.',
    };
  }

  const servicesFallback = targetServices.map((srv) => ({
    id: srv.id,
    slug: srv.slug,
    name: srv.name,
    createdAt: srv.createdAt,
    products: (srv.products || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      descripcion: p.descripcion,
      url: p.url,
    })),
  }));

  const res = await fetch(resolveApiUrl('/api/agency/sync'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      serverUrl: input.serverUrl.trim(),
      serviceScope: input.serviceScope,
      secretKey: input.secretKey,
      eventType: input.eventType,
      changedServiceId: input.changedServiceId,
      dedupeKey: input.dedupeKey,
      servicesFallback,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    remoteStatus?: number;
    syncedServices?: number;
    syncedProducts?: number;
    durationMs?: number;
    syncedAt?: string;
    sentPayload?: unknown;
    error?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      error: data?.error || 'No se pudo completar la sincronización con tu servidor.',
    };
  }

  const syncedAt = data.syncedAt || new Date().toISOString();
  const prevState = loadAgencyConnectionState(input.userId);
  const nextTrackedIds =
    isNewScope &&
    input.eventType === 'service.created' &&
    input.changedServiceId &&
    !prevState.trackedNewServiceIds.includes(input.changedServiceId)
      ? [...prevState.trackedNewServiceIds, input.changedServiceId]
      : input.eventType === 'manual'
        ? []
        : prevState.trackedNewServiceIds;

  saveAgencyConnectionState(
    input.userId,
    {
      ...prevState,
      serverUrl: input.serverUrl.trim(),
      selectedScope: input.serviceScope,
      secretKey: input.secretKey,
      autoSyncEnabled: true,
      connectedAt:
        input.eventType === 'manual'
          ? syncedAt
          : prevState.connectedAt || syncedAt,
      trackedNewServiceIds: nextTrackedIds,
      lastSyncedAt: syncedAt,
      lastTriggerEvent: input.eventType,
    },
    true,
  );

  const fallbackPayload = {
    event:
      input.eventType === 'service.created'
        ? 'searchlink.service.created'
        : input.eventType === 'service.updated'
          ? 'searchlink.service.updated'
          : 'searchlink.catalog.sync',
    version: '1.0',
    synced_at: syncedAt,
    scope:
      input.serviceScope === 'all'
        ? 'all'
        : input.serviceScope === 'new'
          ? 'new'
          : 'single',
    ...(input.changedServiceId ? { changed_service_id: input.changedServiceId } : {}),
    total_servicios: targetServices.length,
    total_productos: targetServices.reduce(
      (sum, srv) => sum + (srv.products?.length ?? 0),
      0,
    ),
    servicios: servicesFallback.map((srv) => ({
      id: srv.id,
      slug: srv.slug,
      nombre: srv.name,
      creado_en: srv.createdAt,
      total_productos: srv.products.length,
      productos: srv.products.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        descripcion: p.descripcion,
        imagen_url: p.url,
        url: p.url,
      })),
    })),
  };

  const payloadObj =
    data.sentPayload && typeof data.sentPayload === 'object'
      ? (data.sentPayload as Record<string, unknown>)
      : (fallbackPayload as Record<string, unknown>);

  const payloadServices = Array.isArray(payloadObj.servicios)
    ? payloadObj.servicios
    : [];
  const extractedServiceNames = payloadServices
    .map((s) =>
      s && typeof s === 'object' && typeof (s as { nombre?: unknown }).nombre === 'string'
        ? (s as { nombre: string }).nombre.trim()
        : '',
    )
    .filter(Boolean);

  const serviceNames =
    extractedServiceNames.length > 0
      ? extractedServiceNames
      : targetServices.map((s) => s.name).filter(Boolean);

  let payloadJson = '';
  try {
    payloadJson = JSON.stringify(payloadObj, null, 2);
  } catch {
    payloadJson = JSON.stringify(fallbackPayload, null, 2);
  }

  saveAgencyServerUpdateRecord(input.userId, {
    id: `upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    syncedAt,
    eventType: input.eventType,
    webhookEvent:
      typeof payloadObj.event === 'string'
        ? payloadObj.event
        : fallbackPayload.event,
    serviceScope: input.serviceScope,
    serviceNames,
    syncedServices: data.syncedServices ?? targetServices.length,
    syncedProducts: data.syncedProducts ?? 0,
    durationMs: data.durationMs ?? 1,
    remoteStatus: data.remoteStatus ?? 200,
    serverUrl: input.serverUrl.trim(),
    payloadJson,
  });

  return {
    ok: true,
    syncedServices: data.syncedServices ?? targetServices.length,
    syncedProducts: data.syncedProducts ?? 0,
    durationMs: data.durationMs ?? 1,
    syncedAt,
  };
}

export interface ExecuteAgencyDisconnectCallResult {
  ok: boolean;
  disconnectedAt?: string;
  error?: string;
}

export async function dispatchAgencyServerDisconnect(
  userId: string,
): Promise<ExecuteAgencyDisconnectCallResult> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: 'Inicia sesión nuevamente para desconectar tu servidor.',
    };
  }

  const res = await fetch(resolveApiUrl('/api/agency/disconnect'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    disconnectedAt?: string;
    error?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      error: data?.error || 'No se pudo desconectar tu servidor.',
    };
  }

  saveAgencyConnectionState(
    userId,
    {
      serverUrl: '',
      selectedScope: null,
      secretKey: generateAgencySecretKey(),
      autoSyncEnabled: false,
      connectedAt: null,
      trackedNewServiceIds: [],
      lastSyncedAt: null,
      lastTriggerEvent: null,
    },
    true,
  );

  return {
    ok: true,
    disconnectedAt: data.disconnectedAt || new Date().toISOString(),
  };
}

export interface ExecuteAgencyRotateSecretResult {
  ok: boolean;
  newSecretKey?: string;
  wasConnected?: boolean;
  error?: string;
}

export async function dispatchAgencySecretRotate(
  userId: string,
): Promise<ExecuteAgencyRotateSecretResult> {
  const prevState = loadAgencyConnectionState(userId);
  const wasConnected = prevState.autoSyncEnabled;
  const accessToken = await getSupabaseAccessToken();

  if (wasConnected && !accessToken) {
    return {
      ok: false,
      error: 'Inicia sesión nuevamente para rotar tu clave secreta y desconectar tu servidor.',
    };
  }

  if (accessToken) {
    const res = await fetch(resolveApiUrl('/api/agency/disconnect'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if ((!res.ok || !data?.ok) && wasConnected) {
      return {
        ok: false,
        error:
          data?.error ||
          'No se pudo desconectar tu servidor al rotar la clave secreta.',
      };
    }
  }

  const newSecretKey = generateAgencySecretKey();
  saveAgencyConnectionState(
    userId,
    {
      serverUrl: '',
      selectedScope: null,
      secretKey: newSecretKey,
      autoSyncEnabled: false,
      connectedAt: null,
      trackedNewServiceIds: [],
      lastSyncedAt: null,
      lastTriggerEvent: null,
    },
    true,
  );

  return {
    ok: true,
    newSecretKey,
    wasConnected,
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

export interface ExecuteAgencyTestCallResult {
  ok: boolean;
  remoteStatus?: number;
  statusText?: string;
  durationMs?: number;
  endpointUrl?: string;
  totalProducts?: number;
  items?: AgencyServerTestItem[];
  error?: string;
}

export async function dispatchAgencyServerTest(
  serverUrl?: string,
): Promise<ExecuteAgencyTestCallResult> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: 'Inicia sesión nuevamente para evaluar tu servidor.',
    };
  }

  const res = await fetch(resolveApiUrl('/api/agency/test'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      serverUrl: (serverUrl || '').trim(),
    }),
  });

  const data = (await res.json().catch(() => null)) as ExecuteAgencyTestCallResult | null;
  if (!data) {
    return {
      ok: false,
      remoteStatus: res.status,
      error: 'No pudimos conectar con Search Link para evaluar tu servidor.',
    };
  }

  return data;
}

export async function triggerAgencyAutoSyncIfMatched(input: {
  userId: string;
  eventType: 'service.created' | 'service.updated';
  serviceId: string;
  services: OrganizationServiceItem[];
}): Promise<void> {
  if (!input.userId || !input.serviceId) return;
  const config = loadAgencyConnectionState(input.userId);
  if (!config.autoSyncEnabled) return;

  const trimmedUrl = config.serverUrl.trim();
  if (!trimmedUrl || !config.selectedScope || !config.secretKey) return;

  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
  } catch {
    return;
  }

  // Rule:
  // - 'all': sync whenever ANY service is created OR edited.
  // - 'new': sync ONLY services created after connecting (new creations + edits to those new services; existing older services stay untouched).
  // - specific serviceId: sync ONLY when THAT exact service is edited.
  let shouldSync = false;
  if (config.selectedScope === 'all') {
    shouldSync = true;
  } else if (config.selectedScope === 'new') {
    if (input.eventType === 'service.created') {
      shouldSync = true;
      if (!config.trackedNewServiceIds.includes(input.serviceId)) {
        saveAgencyConnectionState(
          input.userId,
          {
            ...config,
            trackedNewServiceIds: [...config.trackedNewServiceIds, input.serviceId],
          },
          true,
        );
      }
    } else {
      const targetSrv = input.services.find((srv) => srv.id === input.serviceId);
      const createdAfterConnect = Boolean(
        targetSrv &&
          config.connectedAt &&
          Number.isFinite(Date.parse(targetSrv.createdAt)) &&
          Number.isFinite(Date.parse(config.connectedAt)) &&
          Date.parse(targetSrv.createdAt) >= Date.parse(config.connectedAt) - 5_000,
      );
      shouldSync =
        config.trackedNewServiceIds.includes(input.serviceId) || createdAfterConnect;
    }
  } else if (input.eventType === 'service.updated') {
    shouldSync = config.selectedScope === input.serviceId;
  }

  if (!shouldSync) return;

  try {
    await dispatchAgencyServerSync({
      userId: input.userId,
      serverUrl: trimmedUrl,
      serviceScope: config.selectedScope,
      secretKey: config.secretKey,
      services: input.services,
      eventType: input.eventType,
      changedServiceId: input.serviceId,
      dedupeKey:
        input.eventType === 'service.created'
          ? `service.created:${input.serviceId}`
          : undefined,
    });
  } catch {
    // Silent background auto-sync: never interrupt the foreground workflow
  }
}

function mapServerEventToTrigger(
  rawEvent: string | null,
): AgencySyncTriggerEvent | null {
  if (rawEvent === 'searchlink.service.created') return 'service.created';
  if (rawEvent === 'searchlink.service.updated') return 'service.updated';
  if (rawEvent === 'searchlink.catalog.sync') return 'manual';
  return null;
}

export async function hydrateAgencyConnectionFromCloud(
  userId: string,
): Promise<AgencyConnectionState | null> {
  if (!userId) return null;
  const { config, tableMissing } = await fetchExternalServerConfigSafe();
  if (tableMissing) return null;

  const localState = loadAgencyConnectionState(userId);
  if (config) {
    const cloudState: AgencyConnectionState = {
      serverUrl: config.server_url || '',
      selectedScope: config.service_scope || null,
      secretKey: config.secret_key || localState.secretKey,
      autoSyncEnabled: Boolean(config.auto_sync_enabled),
      connectedAt:
        localState.connectedAt || config.created_at || config.last_synced_at || null,
      trackedNewServiceIds: localState.trackedNewServiceIds,
      lastSyncedAt: config.last_synced_at ?? null,
      lastTriggerEvent: mapServerEventToTrigger(config.last_event),
    };
    saveAgencyConnectionState(userId, cloudState, true);
    return cloudState;
  }

  // If the user had already synced locally before creating the SQL table, migrate it up safely
  if (localState.autoSyncEnabled && localState.serverUrl.trim()) {
    await upsertExternalServerConfigSafe({
      serverUrl: localState.serverUrl,
      serviceScope: localState.selectedScope || 'all',
      secretKey: localState.secretKey,
      autoSyncEnabled: true,
      lastSyncedAt: localState.lastSyncedAt,
      lastEvent:
        localState.lastTriggerEvent === 'service.created'
          ? 'searchlink.service.created'
          : localState.lastTriggerEvent === 'service.updated'
            ? 'searchlink.service.updated'
            : 'searchlink.catalog.sync',
    });
  }

  return null;
}
