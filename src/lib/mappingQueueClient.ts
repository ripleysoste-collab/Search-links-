import { resolveApiUrl } from './apiConfig';
import type { MappedImageMetadata } from './imageCompression';
import { getSupabaseAccessToken } from './supabaseClient';

export type MappingQueueItemUploadStatus =
  | 'pending'
  | 'uploading'
  | 'done'
  | 'error';

export type MappingQueueItemReceiveStatus =
  | 'waiting'
  | 'received'
  | 'error';

export type MappingQueueItemStatus =
  | 'queued'
  | 'processing'
  | 'retry_wait'
  | 'mapped'
  | 'failed';

export type MappingQueueJobStatus =
  | 'uploading_r2'
  | 'running'
  | 'cooling_down'
  | 'completed'
  | 'failed_rolled_back'
  | 'cancelled';

export interface MappingQueueItemClient {
  clientItemId: string;
  position: number;
  r2Key: string;
  imageUrl: string;
  originalUrl?: string;
  savedPercent: number;
  compressedBytes: number;
  uploadStatus: MappingQueueItemUploadStatus;
  receiveStatus: MappingQueueItemReceiveStatus;
  status: MappingQueueItemStatus;
  attempts: number;
  nextRetryAt: number | null;
  lastError: string | null;
  errorKind: 'transient' | 'fatal' | 'auth' | 'policy' | null;
  r2Deleted: boolean;
  mapped: MappedImageMetadata | null;
}

export interface MappingQueueJobClient {
  id: string;
  userId: string;
  sourceType: 'url' | 'files';
  sourceUrl: string | null;
  serviceId: string | null;
  serviceSlug: string;
  serviceName: string | null;
  status: MappingQueueJobStatus;
  totalItems: number;
  mappedCount: number;
  failedCount: number;
  retryingCount: number;
  cooldownUntil: number | null;
  planBRolledBack: boolean;
  planBDeletedKeys: number;
  policyBlocked?: boolean;
  policyReason?: string | null;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
  items: MappingQueueItemClient[];
}

export interface StartMappingJobPayload {
  sourceType: 'url' | 'files';
  sourceUrl?: string | null;
  serviceSlug: string;
  keyPrefix: string;
  keyHash: string;
  items: Array<{
    clientItemId: string;
    r2Key?: string;
    imageUrl?: string;
    dataBase64?: string;
    sourceImageUrl?: string;
    originalUrl?: string;
    savedPercent: number;
    compressedBytes: number;
  }>;
}

export interface CachedJobServiceCredentials {
  jobId: string;
  slug: string;
  apiKey: string;
  keyPrefix: string;
  endpointUrl: string;
}

export function savePendingJobCredentials(
  userId: string,
  creds: CachedJobServiceCredentials,
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      `searchlink_job_creds_${userId}_${creds.jobId}`,
      JSON.stringify(creds),
    );
    window.localStorage.setItem(
      `searchlink_active_job_${userId}`,
      creds.jobId,
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function readPendingJobCredentials(
  userId: string,
  jobId: string,
): CachedJobServiceCredentials | null {
  if (typeof window === 'undefined' || !userId || !jobId) return null;
  try {
    const raw = window.localStorage.getItem(
      `searchlink_job_creds_${userId}_${jobId}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedJobServiceCredentials>;
    if (parsed.slug && parsed.apiKey && parsed.endpointUrl) {
      return {
        jobId,
        slug: parsed.slug,
        apiKey: parsed.apiKey,
        keyPrefix: parsed.keyPrefix || '',
        endpointUrl: parsed.endpointUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function readUnacknowledgedJobId(userId: string): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    return window.localStorage.getItem(`searchlink_active_job_${userId}`);
  } catch {
    return null;
  }
}

export function clearPendingJobTracking(userId: string, jobId?: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.removeItem(`searchlink_active_job_${userId}`);
    if (jobId) {
      window.localStorage.removeItem(`searchlink_job_creds_${userId}_${jobId}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function startBackgroundMappingJob(
  payload: StartMappingJobPayload,
  signal?: AbortSignal,
): Promise<MappingQueueJobClient> {
  const token = await getSupabaseAccessToken();
  const res = await fetch(resolveApiUrl('/api/jobs/map'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job?: MappingQueueJobClient;
    error?: string;
  };

  if (!res.ok || !data.job) {
    throw new Error(
      data.error || `Error HTTP ${res.status} al iniciar la cola de mapeo.`,
    );
  }

  return data.job;
}

export async function fetchMappingJobStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<MappingQueueJobClient | null> {
  const token = await getSupabaseAccessToken();
  if (!token) return null;

  const res = await fetch(
    resolveApiUrl(`/api/jobs/map/${encodeURIComponent(jobId)}`),
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal,
    },
  );

  if (res.status === 404) return null;
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job?: MappingQueueJobClient;
    error?: string;
  };

  if (!res.ok || !data.job) {
    throw new Error(
      data.error || `Error HTTP ${res.status} al consultar el mapeo.`,
    );
  }

  return data.job;
}

export async function fetchActiveMappingJob(
  signal?: AbortSignal,
): Promise<MappingQueueJobClient | null> {
  const token = await getSupabaseAccessToken();
  if (!token) return null;

  const res = await fetch(resolveApiUrl('/api/jobs/map/active'), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    signal,
  });

  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job?: MappingQueueJobClient | null;
  };
  return data.job ?? null;
}

export async function cancelBackgroundMappingJob(
  jobId: string,
): Promise<MappingQueueJobClient | null> {
  const token = await getSupabaseAccessToken();
  if (!token) return null;

  const res = await fetch(
    resolveApiUrl(`/api/jobs/map/${encodeURIComponent(jobId)}/cancel`),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job?: MappingQueueJobClient;
  };
  return data.job ?? null;
}
