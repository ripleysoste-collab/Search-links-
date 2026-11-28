import { resolveApiUrl } from './apiConfig';
import { getSupabaseAccessToken } from './supabaseClient';

export type PlanTier = 'free' | 'plus' | 'plus_max';

export interface PlanLimitsSpec {
  maxImages: number;
  maxApiRequestsMonthly: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

export const CLIENT_PLAN_LIMITS_BY_TIER: Record<PlanTier, PlanLimitsSpec> = {
  free: {
    maxImages: 20,
    maxApiRequestsMonthly: 1000,
    maxRequestsPerMinute: 20,
    maxRequestsPerHour: 150,
    maxRequestsPerDay: 400,
  },
  plus: {
    maxImages: 80,
    maxApiRequestsMonthly: 1000,
    maxRequestsPerMinute: 20,
    maxRequestsPerHour: 150,
    maxRequestsPerDay: 400,
  },
  plus_max: {
    maxImages: 150,
    maxApiRequestsMonthly: 25000,
    maxRequestsPerMinute: 120,
    maxRequestsPerHour: 1500,
    maxRequestsPerDay: 5000,
  },
};

export interface ServiceTrafficLimitRule {
  serviceId: string;
  userId: string;
  planTier: PlanTier;
  perMinuteLimit: number;
  perHourLimit: number;
  dailyLimit: number;
  allowedOrigins: string[];
  updatedAt: string;
}

export interface ServiceTrafficLimitsResponse {
  ok: true;
  planTier: PlanTier;
  planLimits: PlanLimitsSpec;
  rule: ServiceTrafficLimitRule;
}

export interface AccountQuotaSummary {
  ok: boolean;
  isAdmin: boolean;
  hasPlusAccess: boolean;
  planTier?: PlanTier;
  planLimits?: PlanLimitsSpec;
  activeImagesCount: number;
  carriedFreeImagesUsed: number;
  totalFreeImagesUsed: number;
  freeLimit: number;
  remainingFreeImages: number;
}

export interface R2PurgeResponse {
  ok: true;
  deletedR2Count: number;
  clearedServicesCount: number;
  clearedLogo: boolean;
  quota: AccountQuotaSummary;
}

export interface PauseAllApisResponse {
  ok: true;
  pausedServicesCount: number;
}

export interface UnfreezeAllApisResponse {
  ok: true;
  unfrozenServicesCount: number;
}

export interface DeleteAccountResponse {
  ok: true;
  deletedR2Count: number;
  authDeleted: boolean;
  carriedPlan: 'free' | 'plus';
}

async function getRequiredAccessToken(): Promise<string> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error('Inicia sesión nuevamente con Google para continuar.');
  }
  return token;
}

export async function fetchAccountQuotaSummary(): Promise<AccountQuotaSummary | null> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token) return null;
    const response = await fetch(resolveApiUrl('/api/account/quota'), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as AccountQuotaSummary;
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

export async function fetchServiceTrafficLimits(
  serviceId: string,
): Promise<ServiceTrafficLimitsResponse | null> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token || !serviceId.trim()) return null;
    const response = await fetch(
      resolveApiUrl(
        `/api/account/services/traffic-limits?serviceId=${encodeURIComponent(serviceId.trim())}`,
      ),
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as ServiceTrafficLimitsResponse;
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

export async function saveServiceTrafficLimits(input: {
  serviceId: string;
  perMinuteLimit: number;
  perHourLimit: number;
  dailyLimit: number;
  allowedOrigins: string[];
}): Promise<ServiceTrafficLimitsResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(
    resolveApiUrl('/api/account/services/traffic-limits'),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  const data = (await response.json().catch(() => ({}))) as Partial<ServiceTrafficLimitsResponse> & {
    error?: string;
  };
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'No se pudieron guardar los límites de tráfico.');
  }
  return data as ServiceTrafficLimitsResponse;
}

export async function requestPurgeAllR2Images(): Promise<R2PurgeResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(resolveApiUrl('/api/account/r2-purge'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<R2PurgeResponse> & {
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudieron borrar las imágenes de R2.');
  }
  return data as R2PurgeResponse;
}

export interface DeleteCoreServiceResponse {
  ok: true;
  deletedR2Count: number;
}

export async function requestDeleteCoreService(
  serviceId: string,
): Promise<DeleteCoreServiceResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(resolveApiUrl('/api/account/services/delete'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ serviceId }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<DeleteCoreServiceResponse> & {
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudo eliminar el servicio.');
  }
  return data as DeleteCoreServiceResponse;
}

export async function requestPauseAllApis(): Promise<PauseAllApisResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(resolveApiUrl('/api/account/pause-all-apis'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<PauseAllApisResponse> & {
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudieron pausar las APIs activas.');
  }
  return data as PauseAllApisResponse;
}

export async function requestUnfreezeAllApis(): Promise<UnfreezeAllApisResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(resolveApiUrl('/api/account/unfreeze-all-apis'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<UnfreezeAllApisResponse> & {
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudieron descongelar las APIs.');
  }
  return data as UnfreezeAllApisResponse;
}

export async function requestClearBrowserData(): Promise<void> {
  const token = await getSupabaseAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolveApiUrl('/api/account/clear-browser-data'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error('No se pudieron limpiar las cookies de navegación.');
  }
}

export async function requestDeleteAccountPermanently(): Promise<DeleteAccountResponse> {
  const token = await getRequiredAccessToken();
  const response = await fetch(resolveApiUrl('/api/account/delete'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<DeleteAccountResponse> & {
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudo borrar definitivamente la cuenta.');
  }
  return data as DeleteAccountResponse;
}

export function wipeAllClientBrowsingStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.clear();
  } catch {
    // Ignore storage errors
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore storage errors
  }
  try {
    const rawCookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of rawCookies) {
      const eqIdx = cookie.indexOf('=');
      const name = (eqIdx > -1 ? cookie.slice(0, eqIdx) : cookie).trim();
      if (!name) continue;
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  } catch {
    // Ignore cookie access errors
  }
}

export function wipeAccountLocalStorageEntries(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`searchlink_org_${userId}`);
    window.localStorage.removeItem(`searchlink_services_${userId}`);
    window.localStorage.removeItem(`searchlink_agency_conn_${userId}`);
    window.localStorage.removeItem(`searchlink_active_job_${userId}`);
    window.localStorage.removeItem('sl_image_bank_saved_v1');

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.includes(userId) || key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore storage errors
  }
}
