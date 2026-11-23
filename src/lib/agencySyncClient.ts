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
  lastSyncedAt: string | null;
  lastTriggerEvent: AgencySyncTriggerEvent | null;
}

const STORAGE_PREFIX = 'searchlink_connect_server_draft_v1_';
export const AGENCY_SYNC_UPDATED_EVENT = 'searchlink:agency-sync-updated';

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

    return {
      serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : '',
      selectedScope:
        typeof parsed.selectedScope === 'string' ? parsed.selectedScope : null,
      secretKey,
      autoSyncEnabled: Boolean(parsed.autoSyncEnabled),
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

  const targetServices =
    input.serviceScope === 'all'
      ? input.services
      : input.services.filter((srv) => srv.id === input.serviceScope);

  if (targetServices.length === 0) {
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
    syncedServices?: number;
    syncedProducts?: number;
    durationMs?: number;
    syncedAt?: string;
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
  saveAgencyConnectionState(
    input.userId,
    {
      ...prevState,
      serverUrl: input.serverUrl.trim(),
      selectedScope: input.serviceScope,
      secretKey: input.secretKey,
      autoSyncEnabled: true,
      lastSyncedAt: syncedAt,
      lastTriggerEvent: input.eventType,
    },
    true,
  );

  return {
    ok: true,
    syncedServices: data.syncedServices ?? targetServices.length,
    syncedProducts: data.syncedProducts ?? 0,
    durationMs: data.durationMs ?? 1,
    syncedAt,
  };
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
  // - If user selected 'all' ("Sincronizar todos"), sync whenever ANY service is created OR edited.
  // - If user selected a specific serviceId, sync ONLY when THAT exact service is edited.
  const shouldSync =
    input.eventType === 'service.created'
      ? config.selectedScope === 'all'
      : config.selectedScope === 'all' || config.selectedScope === input.serviceId;

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
