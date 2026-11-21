import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  GeminiMapError,
  mapStoredImageWithGemini,
  type MappedImageMetadata,
} from './geminiMapper.ts';
import { fetchProxiedImage } from './imageProxy.ts';
import {
  invalidateUserImageQuotaCache,
  markFreeAccountImageConsumed,
  unmarkFreeAccountImageConsumed,
  type AuthenticatedRequestUser,
} from './planLimits.ts';
import {
  deleteImageFromR2,
  deleteImagesFromR2,
  getMissingR2EnvNames,
  isR2Configured,
} from './r2Storage.ts';
import {
  getSupabaseServerConfig,
  invalidateCoreCatalogCache,
} from './supabaseServer.ts';
import { processAndStoreUploadedImage } from './uploadHandler.ts';

export const R2_UPLOAD_CONCURRENCY = 4;
export const QUEUE_BATCH_BEFORE_PAUSE = 5;
export const QUEUE_COOLDOWN_MS = 10_000;
export const QUEUE_INTER_ITEM_MS = 100;
export const QUEUE_MAX_TRANSIENT_ATTEMPTS = 6;

const TRANSIENT_BACKOFF_MS = [10_000, 20_000, 35_000, 50_000, 60_000];

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

export interface MappingQueueItemInput {
  clientItemId: string;
  r2Key?: string;
  imageUrl?: string;
  sourceImageUrl?: string;
  originalUrl?: string;
  savedPercent: number;
  compressedBytes: number;
}

export interface PendingR2UploadPayload {
  buffer?: Buffer;
  sourceImageUrl?: string;
}

export interface MappingQueueItem {
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
  errorKind: 'transient' | 'fatal' | 'auth' | null;
  r2Deleted: boolean;
  persistedInService: boolean;
  mapped: MappedImageMetadata | null;
}

export interface MappingQueueJob {
  id: string;
  userId: string;
  sourceType: 'url' | 'files';
  sourceUrl: string | null;
  serviceId: string | null;
  serviceSlug: string;
  serviceName: string | null;
  keyPrefix: string;
  keyHash: string;
  status: MappingQueueJobStatus;
  totalItems: number;
  mappedCount: number;
  failedCount: number;
  retryingCount: number;
  cooldownUntil: number | null;
  planBRolledBack: boolean;
  planBDeletedKeys: number;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
  items: MappingQueueItem[];
}

export interface CreateMappingJobInput {
  authUser: AuthenticatedRequestUser;
  requestOrigin?: string;
  sourceType: 'url' | 'files';
  sourceUrl?: string | null;
  serviceSlug: string;
  keyPrefix: string;
  keyHash: string;
  items: MappingQueueItemInput[];
  pendingUploads?: Map<string, PendingR2UploadPayload>;
}

interface JobRuntimeContext {
  authUser: AuthenticatedRequestUser;
  requestOrigin?: string;
  pendingUploads: Map<string, PendingR2UploadPayload>;
  cancelled: boolean;
  running: boolean;
  mappingJobsTableMissing: boolean;
}

const NO_ACTIVE_JOB_CACHE_TTL_MS = 30_000;
const PURGE_OLD_JOBS_COOLDOWN_MS = 60 * 60 * 1000;
const FINISHED_JOB_RETENTION_MS = 12 * 60 * 60 * 1000;

const jobsById = new Map<string, MappingQueueJob>();
const latestJobIdByUser = new Map<string, string>();
const runtimeByJobId = new Map<string, JobRuntimeContext>();
const noActiveJobCache = new Map<string, number>();
const lastJobsPurgeAtByUser = new Map<string, number>();

let globalGeminiQueueTail: Promise<void> = Promise.resolve();

function runWithGlobalGeminiTurn<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalGeminiQueueTail;
  let release!: () => void;
  globalGeminiQueueTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function createUserSupabaseClient(accessToken: string): SupabaseClient | null {
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key || !accessToken) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function isMissingRelationError(
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

function recomputeCounters(job: MappingQueueJob): void {
  let mapped = 0;
  let failed = 0;
  let retrying = 0;

  for (const item of job.items) {
    if (item.status === 'mapped') mapped++;
    else if (item.status === 'failed') failed++;
    else if (item.status === 'retry_wait') retrying++;
  }

  job.mappedCount = mapped;
  job.failedCount = failed;
  job.retryingCount = retrying;
  job.updatedAt = new Date().toISOString();
}

function buildServiceSnapshotPayload(job: MappingQueueJob) {
  const images = job.items.map((item) => ({
    id: item.clientItemId,
    url: item.imageUrl,
    cleanUrl: item.imageUrl,
    sourcePageUrl: item.originalUrl,
    alt: item.mapped?.nombre || 'Producto catalogado',
  }));

  const compressionStatuses: Record<string, 'done' | 'error'> = {};
  const uploadStatuses: Record<string, 'done' | 'error'> = {};
  const receiveStatuses: Record<string, 'received' | 'error'> = {};
  const mapStatuses: Record<string, 'waiting' | 'mapping' | 'mapped' | 'error'> = {};
  const mappedResults: Record<string, MappedImageMetadata> = {};
  const compressionResults: Record<
    string,
    {
      url: string;
      cleanUrl: string;
      savedPercent: number;
      compressedBytes: number;
    }
  > = {};

  for (const item of job.items) {
    const uploadFailed = item.r2Deleted || item.uploadStatus === 'error' || !item.imageUrl;
    compressionStatuses[item.clientItemId] = uploadFailed ? 'error' : 'done';
    uploadStatuses[item.clientItemId] = uploadFailed ? 'error' : 'done';
    receiveStatuses[item.clientItemId] = uploadFailed ? 'error' : 'received';

    if (item.status === 'mapped' && item.mapped) {
      mapStatuses[item.clientItemId] = 'mapped';
      mappedResults[item.clientItemId] = item.mapped;
    } else if (item.status === 'failed') {
      mapStatuses[item.clientItemId] = 'error';
    } else if (item.status === 'processing') {
      mapStatuses[item.clientItemId] = 'mapping';
    } else {
      mapStatuses[item.clientItemId] = 'waiting';
    }

    if (!uploadFailed) {
      compressionResults[item.clientItemId] = {
        url: item.imageUrl,
        cleanUrl: item.imageUrl,
        savedPercent: item.savedPercent,
        compressedBytes: item.compressedBytes,
      };
    }
  }

  return {
    images,
    compressionStatuses,
    uploadStatuses,
    receiveStatuses,
    mapStatuses,
    mappedResults,
    compressionResults,
  };
}

async function persistJobRecordToSupabase(
  job: MappingQueueJob,
  ctx: JobRuntimeContext,
): Promise<void> {
  if (ctx.mappingJobsTableMissing) return;
  const supabase = createUserSupabaseClient(ctx.authUser.accessToken);
  if (!supabase) return;

  try {
    const { error } = await supabase.from('mapping_jobs').upsert(
      {
        id: job.id,
        user_id: job.userId,
        servicio_id: job.serviceId,
        service_slug: job.serviceSlug,
        service_name: job.serviceName,
        key_prefix: job.keyPrefix,
        key_hash: job.keyHash,
        source_type: job.sourceType,
        source_url: job.sourceUrl,
        status: job.status,
        total_items: job.totalItems,
        mapped_count: job.mappedCount,
        failed_count: job.failedCount,
        retrying_count: job.retryingCount,
        cooldown_until: job.cooldownUntil
          ? new Date(job.cooldownUntil).toISOString()
          : null,
        plan_b_rolled_back: job.planBRolledBack,
        plan_b_deleted_keys: job.planBDeletedKeys,
        notice: job.notice,
        items_json: job.items,
        updated_at: job.updatedAt,
      },
      { onConflict: 'id' },
    );

    if (error && isMissingRelationError(error)) {
      ctx.mappingJobsTableMissing = true;
    }
  } catch {
    // Non-fatal: in-memory job remains authoritative while server is alive
  }
}

async function persistSingleMappedProductToSupabase(
  job: MappingQueueJob,
  item: MappingQueueItem,
  ctx: JobRuntimeContext,
): Promise<void> {
  if (!item.mapped || item.persistedInService) return;
  const supabase = createUserSupabaseClient(ctx.authUser.accessToken);
  if (!supabase) return;

  try {
    if (!job.serviceId) {
      const snapshot = buildServiceSnapshotPayload(job);
      const firstName = item.mapped.nombre.trim() || 'Producto catalogado';
      const defaultServiceName = `Servicio · ${firstName}`;
      job.serviceName = defaultServiceName;

      const { data: orgRow } = await supabase
        .from('organizacion')
        .select('id')
        .eq('user_id', job.userId)
        .maybeSingle();

      const { data: serviceRow, error: serviceError } = await supabase
        .from('servicios')
        .insert({
          user_id: job.userId,
          organizacion_id: (orgRow?.id as string | undefined) ?? null,
          public_slug: job.serviceSlug,
          nombre: defaultServiceName,
          source_type: job.sourceType,
          source_url: job.sourceUrl,
          item_count: job.mappedCount,
          is_active: true,
          snapshot_json: snapshot,
        })
        .select('id')
        .single();

      if (serviceError || !serviceRow?.id) {
        return;
      }

      job.serviceId = serviceRow.id as string;

      await supabase.from('servicio_api_keys').insert({
        servicio_id: job.serviceId,
        user_id: job.userId,
        label: 'Llave principal',
        key_prefix: job.keyPrefix,
        key_hash: job.keyHash,
        is_active: true,
      });

      invalidateCoreCatalogCache({ slug: job.serviceSlug, keyHash: job.keyHash });
    } else {
      // Throttle heavy snapshot_json writes to every 5th mapped item (final snapshot is synced on completion)
      const updatePayload: Record<string, unknown> = {
        item_count: job.mappedCount,
        updated_at: new Date().toISOString(),
      };
      if (job.mappedCount % 5 === 0) {
        updatePayload.snapshot_json = buildServiceSnapshotPayload(job);
      }
      await supabase
        .from('servicios')
        .update(updatePayload)
        .eq('id', job.serviceId)
        .eq('user_id', job.userId);
    }

    const { error: prodError } = await supabase
      .from('servicio_productos')
      .insert({
        servicio_id: job.serviceId,
        user_id: job.userId,
        position: item.position,
        nombre: item.mapped.nombre,
        categoria: item.mapped.categoria,
        descripcion: item.mapped.descripcion,
        image_url: item.imageUrl,
        r2_key: item.r2Key || null,
        saved_percent: item.savedPercent,
      });

    if (!prodError) {
      item.persistedInService = true;
    }
  } catch {
    // Retry sync cleanly on next item or completion
  }
}

async function syncFinalSnapshotToSupabase(
  job: MappingQueueJob,
  ctx: JobRuntimeContext,
): Promise<void> {
  if (!job.serviceId) return;
  const supabase = createUserSupabaseClient(ctx.authUser.accessToken);
  if (!supabase) return;

  try {
    await supabase
      .from('servicios')
      .update({
        item_count: job.mappedCount,
        snapshot_json: buildServiceSnapshotPayload(job),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.serviceId)
      .eq('user_id', job.userId);
  } catch {
    // Ignore transient snapshot update error
  }
}

async function rollbackDraftServiceInSupabase(
  job: MappingQueueJob,
  ctx: JobRuntimeContext,
): Promise<void> {
  if (!job.serviceId) return;
  const supabase = createUserSupabaseClient(ctx.authUser.accessToken);
  if (!supabase) return;

  try {
    await supabase
      .from('servicios')
      .delete()
      .eq('id', job.serviceId)
      .eq('user_id', job.userId);
    job.serviceId = null;
  } catch {
    // Ignore rollback cleanup failure
  }
}

async function executePlanBForSingleItem(
  job: MappingQueueJob,
  item: MappingQueueItem,
): Promise<void> {
  if (item.r2Deleted || !item.r2Key) return;
  const deleted = await deleteImageFromR2(item.r2Key);
  if (deleted) {
    item.r2Deleted = true;
    job.planBDeletedKeys += 1;
    unmarkFreeAccountImageConsumed(job.userId, item.r2Key);
  }
}

async function executePlanBForSevereBatchFailure(
  job: MappingQueueJob,
  ctx: JobRuntimeContext,
  reasonNotice: string,
): Promise<void> {
  ctx.pendingUploads.clear();
  const keysToDelete = job.items
    .filter((item) => !item.r2Deleted && Boolean(item.r2Key))
    .map((item) => item.r2Key);

  if (keysToDelete.length > 0) {
    const deletedCount = await deleteImagesFromR2(keysToDelete);
    job.planBDeletedKeys += deletedCount;
    for (const item of job.items) {
      if (!item.r2Deleted && item.r2Key) {
        item.r2Deleted = true;
        unmarkFreeAccountImageConsumed(job.userId, item.r2Key);
      }
    }
  }

  await rollbackDraftServiceInSupabase(job, ctx);
  invalidateCoreCatalogCache({ slug: job.serviceSlug, keyHash: job.keyHash });
  invalidateUserImageQuotaCache(job.userId);

  job.planBRolledBack = true;
  job.status = 'failed_rolled_back';
  job.cooldownUntil = null;
  job.notice = reasonNotice;
  recomputeCounters(job);
  await persistJobRecordToSupabase(job, ctx);
}

async function runPhase1R2Uploads(
  job: MappingQueueJob,
  ctx: JobRuntimeContext,
): Promise<boolean> {
  const pendingItems = job.items.filter(
    (item) => item.uploadStatus !== 'done' || !item.r2Key || !item.imageUrl,
  );
  if (pendingItems.length === 0) {
    return true;
  }

  if (!isR2Configured()) {
    const missing = getMissingR2EnvNames();
    const errMsg = `Faltan variables de R2 en Render (${missing.join(', ')}). Revisa Environment en Render y guarda los cambios.`;
    for (const item of pendingItems) {
      item.uploadStatus = 'error';
      item.receiveStatus = 'error';
      item.status = 'failed';
      item.errorKind = 'fatal';
      item.lastError = errMsg;
    }
    await executePlanBForSevereBatchFailure(job, ctx, errMsg);
    return false;
  }

  job.status = 'uploading_r2';
  let uploadedSoFar = job.items.filter((i) => i.uploadStatus === 'done').length;
  job.notice = `Subiendo a R2 en segundo plano (${uploadedSoFar}/${job.totalItems}) · Puedes salir y volver cuando quieras.`;
  recomputeCounters(job);
  await persistJobRecordToSupabase(job, ctx);

  let cursor = 0;
  let firstUploadError: string | null = null;
  const workerCount = Math.min(R2_UPLOAD_CONCURRENCY, pendingItems.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < pendingItems.length && !ctx.cancelled) {
      const item = pendingItems[cursor++];
      if (!item) continue;

      item.uploadStatus = 'uploading';
      job.updatedAt = new Date().toISOString();

      try {
        const pending = ctx.pendingUploads.get(item.clientItemId);
        let buffer = pending?.buffer;

        if (!buffer && pending?.sourceImageUrl) {
          const proxied = await fetchProxiedImage(
            pending.sourceImageUrl,
            item.originalUrl,
          );
          buffer = proxied.buffer;
        }

        if (!buffer || buffer.byteLength === 0) {
          throw new Error('No se recibieron bytes válidos para guardar en R2.');
        }

        const stored = await processAndStoreUploadedImage(
          buffer,
          ctx.requestOrigin,
          'catalog',
        );

        item.r2Key = stored.key;
        item.imageUrl = stored.url;
        item.compressedBytes = stored.sizeBytes;
        item.uploadStatus = 'done';
        item.receiveStatus = 'received';
        markFreeAccountImageConsumed(ctx.authUser, stored.key);

        uploadedSoFar += 1;
        job.notice = `Subiendo a R2 en segundo plano (${uploadedSoFar}/${job.totalItems}) · Puedes salir y volver cuando quieras.`;
        job.updatedAt = new Date().toISOString();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'No se pudo subir la imagen a R2.';
        if (!firstUploadError) firstUploadError = msg;
        item.uploadStatus = 'error';
        item.receiveStatus = 'error';
        item.status = 'failed';
        item.errorKind = 'fatal';
        item.lastError = msg;
        recomputeCounters(job);
      } finally {
        ctx.pendingUploads.delete(item.clientItemId);
      }
    }
  });

  await Promise.all(workers);
  ctx.pendingUploads.clear();

  if (ctx.cancelled) {
    return false;
  }

  const uploadedCount = job.items.filter(
    (item) => item.uploadStatus === 'done' && Boolean(item.r2Key),
  ).length;
  const r2FailedCount = pendingItems.filter(
    (item) => item.uploadStatus === 'error',
  ).length;

  if (
    uploadedCount === 0 ||
    (r2FailedCount > 0 && uploadedCount / Math.max(1, job.totalItems) <= 0.6)
  ) {
    const reason =
      uploadedCount === 0
        ? firstUploadError ||
          'Plan B activado: falló la subida a R2 y se limpiaron los archivos temporales.'
        : `Plan B activado: demasiados fallos al subir a R2 (${uploadedCount}/${job.totalItems} válidas); se eliminaron las imágenes ya subidas.`;
    await executePlanBForSevereBatchFailure(job, ctx, reason);
    return false;
  }

  job.status = 'running';
  job.notice = `Mapeando en segundo plano (0/${job.totalItems}) · Puedes salir y volver cuando quieras.`;
  recomputeCounters(job);
  await persistJobRecordToSupabase(job, ctx);
  return true;
}

function findNextReadyItem(
  queue: MappingQueueItem[],
  now: number,
): { item: MappingQueueItem | null; earliestWaitMs: number | null } {
  for (const item of queue) {
    if (item.status === 'queued') {
      return { item, earliestWaitMs: null };
    }
  }

  let soonestAt: number | null = null;
  for (const item of queue) {
    if (item.status !== 'retry_wait') continue;
    const readyAt = item.nextRetryAt ?? now;
    if (readyAt <= now) {
      return { item, earliestWaitMs: null };
    }
    if (soonestAt === null || readyAt < soonestAt) {
      soonestAt = readyAt;
    }
  }

  return {
    item: null,
    earliestWaitMs: soonestAt !== null ? Math.max(250, soonestAt - now) : null,
  };
}

async function runQueueWorker(jobId: string): Promise<void> {
  const job = jobsById.get(jobId);
  const ctx = runtimeByJobId.get(jobId);
  if (!job || !ctx || ctx.running) return;
  ctx.running = true;

  try {
    // Phase 1: Background R2 Upload (starts immediately so closing tab mid-R2 never leaves orphans)
    const r2Ok = await runPhase1R2Uploads(job, ctx);
    if (!r2Ok) {
      if (ctx.cancelled) {
        const uploadedKeys = job.items
          .filter((i) => !i.r2Deleted && Boolean(i.r2Key))
          .map((i) => i.r2Key);
        if (uploadedKeys.length > 0) {
          const deleted = await deleteImagesFromR2(uploadedKeys);
          job.planBDeletedKeys += deleted;
          for (const i of job.items) {
            if (!i.r2Deleted && i.r2Key) {
              i.r2Deleted = true;
              unmarkFreeAccountImageConsumed(job.userId, i.r2Key);
            }
          }
        }
        job.status = 'cancelled';
        job.cooldownUntil = null;
        recomputeCounters(job);
        await persistJobRecordToSupabase(job, ctx);
      }
      return;
    }

    // Phase 2: Sequential Gemini AI Mapping + Anti-503 Cooldowns + Incremental Save + Plan B
    const workQueue: MappingQueueItem[] = [...job.items];
    let processedInBurst = 0;

    while (!ctx.cancelled) {
      const now = Date.now();
      const { item, earliestWaitMs } = findNextReadyItem(workQueue, now);

      if (!item) {
        if (earliestWaitMs !== null) {
          job.status = 'cooling_down';
          job.cooldownUntil = Date.now() + earliestWaitMs;
          job.notice =
            'Reintentando imágenes con saturación 503 en unos segundos sin perder las ya mapeadas...';
          recomputeCounters(job);
          void persistJobRecordToSupabase(job, ctx);
          await sleep(Math.min(earliestWaitMs, 10_000));
          continue;
        }
        break;
      }

      if (processedInBurst >= QUEUE_BATCH_BEFORE_PAUSE) {
        processedInBurst = 0;
        const until = Date.now() + QUEUE_COOLDOWN_MS;
        job.status = 'cooling_down';
        job.cooldownUntil = until;
        job.notice = `Pausa preventiva de ${Math.round(QUEUE_COOLDOWN_MS / 1000)}s cada ${QUEUE_BATCH_BEFORE_PAUSE} imágenes para evitar error 503.`;
        recomputeCounters(job);
        await persistJobRecordToSupabase(job, ctx);

        while (!ctx.cancelled && Date.now() < until) {
          await sleep(Math.min(1000, until - Date.now()));
        }
        if (ctx.cancelled) break;
      }

      job.status = 'running';
      job.cooldownUntil = null;
      item.status = 'processing';
      item.attempts += 1;
      item.lastError = null;
      item.errorKind = null;
      recomputeCounters(job);
      // Fire-and-forget DB status tick to keep Gemini mapping fast
      void persistJobRecordToSupabase(job, ctx);

      try {
        const mapped = await runWithGlobalGeminiTurn(() =>
          mapStoredImageWithGemini({
            key: item.r2Key,
            imageUrl: item.imageUrl,
            maxAttempts: 2,
          }),
        );

        item.status = 'mapped';
        item.mapped = mapped;
        item.nextRetryAt = null;
        item.lastError = null;
        item.errorKind = null;
        processedInBurst += 1;

        recomputeCounters(job);
        job.notice = `Mapeando en segundo plano (${job.mappedCount}/${job.totalItems}) · Puedes salir y volver cuando quieras.`;
        await persistSingleMappedProductToSupabase(job, item, ctx);
        void persistJobRecordToSupabase(job, ctx);
      } catch (err) {
        const errorKind =
          err instanceof GeminiMapError ? err.kind : 'fatal';
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo mapear la imagen con IA.';

        item.lastError = message;
        item.errorKind = errorKind;
        processedInBurst += 1;

        if (errorKind === 'auth') {
          item.status = 'failed';
          for (const pending of workQueue) {
            if (
              pending.status === 'queued' ||
              pending.status === 'retry_wait'
            ) {
              pending.status = 'failed';
              pending.errorKind = 'auth';
              pending.lastError = message;
            }
          }
          await executePlanBForSevereBatchFailure(job, ctx, message);
          return;
        }

        if (
          errorKind === 'transient' &&
          item.attempts < QUEUE_MAX_TRANSIENT_ATTEMPTS
        ) {
          const backoffIdx = Math.min(
            item.attempts - 1,
            TRANSIENT_BACKOFF_MS.length - 1,
          );
          const delayMs = TRANSIENT_BACKOFF_MS[backoffIdx];
          item.status = 'retry_wait';
          item.nextRetryAt = Date.now() + delayMs;
          job.notice = `Error temporal 503 en una imagen; enviada al final de la fila para reintento automático (intento ${item.attempts}/${QUEUE_MAX_TRANSIENT_ATTEMPTS}).`;

          const idx = workQueue.indexOf(item);
          if (idx !== -1) {
            workQueue.splice(idx, 1);
            workQueue.push(item);
          }

          recomputeCounters(job);
          void persistJobRecordToSupabase(job, ctx);
        } else {
          item.status = 'failed';
          item.nextRetryAt = null;
          await executePlanBForSingleItem(job, item);
          recomputeCounters(job);
          void persistJobRecordToSupabase(job, ctx);
        }
      }

      if (!ctx.cancelled) {
        await sleep(QUEUE_INTER_ITEM_MS);
      }
    }

    if (ctx.cancelled) {
      job.status = 'cancelled';
      job.cooldownUntil = null;
      const unmappedKeys = job.items
        .filter((i) => i.status !== 'mapped' && !i.r2Deleted && Boolean(i.r2Key))
        .map((i) => i.r2Key);
      if (unmappedKeys.length > 0) {
        const deleted = await deleteImagesFromR2(unmappedKeys);
        job.planBDeletedKeys += deleted;
        for (const i of job.items) {
          if (i.status !== 'mapped' && !i.r2Deleted && i.r2Key) {
            i.r2Deleted = true;
            unmarkFreeAccountImageConsumed(job.userId, i.r2Key);
          }
        }
      }
      if (job.mappedCount === 0) {
        await rollbackDraftServiceInSupabase(job, ctx);
      } else {
        await syncFinalSnapshotToSupabase(job, ctx);
      }
      invalidateCoreCatalogCache({ slug: job.serviceSlug, keyHash: job.keyHash });
      invalidateUserImageQuotaCache(job.userId);
      recomputeCounters(job);
      await persistJobRecordToSupabase(job, ctx);
      return;
    }

    recomputeCounters(job);

    const successRatio =
      job.totalItems > 0 ? job.mappedCount / job.totalItems : 0;
    const hasFatalFailure = job.items.some(
      (i) => i.status === 'failed' && i.errorKind !== 'transient',
    );

    if (job.mappedCount === 0 || (hasFatalFailure && successRatio <= 0.6)) {
      const reason =
        job.mappedCount === 0
          ? 'Plan B activado: ninguna imagen pudo mapearse correctamente; se eliminaron de R2 automáticamente para no dejar archivos huérfanos.'
          : `Plan B activado: el lote cayó por debajo del umbral mínimo (${job.mappedCount}/${job.totalItems} válidas) por fallos definitivos; se limpiaron las imágenes de R2.`;
      await executePlanBForSevereBatchFailure(job, ctx, reason);
      return;
    }

    await syncFinalSnapshotToSupabase(job, ctx);
    invalidateCoreCatalogCache({ slug: job.serviceSlug, keyHash: job.keyHash });
    invalidateUserImageQuotaCache(job.userId);
    job.status = 'completed';
    job.cooldownUntil = null;
    job.notice =
      job.failedCount > 0
        ? `Catálogo guardado con ${job.mappedCount} productos válidos. Plan B eliminó ${job.planBDeletedKeys} imagen(es) inválida(s) de R2.`
        : null;
    recomputeCounters(job);
    await persistJobRecordToSupabase(job, ctx);
  } finally {
    ctx.pendingUploads.clear();
    ctx.running = false;
  }
}

async function purgeOldFinishedMappingJobs(
  userId: string,
  accessToken: string,
): Promise<void> {
  const now = Date.now();
  const lastPurge = lastJobsPurgeAtByUser.get(userId) ?? 0;
  if (now - lastPurge < PURGE_OLD_JOBS_COOLDOWN_MS) return;

  if (lastJobsPurgeAtByUser.size >= 2000) {
    const oldestKey = lastJobsPurgeAtByUser.keys().next().value;
    if (oldestKey) lastJobsPurgeAtByUser.delete(oldestKey);
  }
  lastJobsPurgeAtByUser.set(userId, now);

  const supabase = createUserSupabaseClient(accessToken);
  if (!supabase) return;

  try {
    const cutoffIso = new Date(now - FINISHED_JOB_RETENTION_MS).toISOString();
    await supabase
      .from('mapping_jobs')
      .delete()
      .eq('user_id', userId)
      .in('status', ['completed', 'failed_rolled_back', 'cancelled'])
      .lt('updated_at', cutoffIso);
  } catch {
    // Non-fatal cleanup
  }
}

export async function createAndStartMappingJob(
  input: CreateMappingJobInput,
): Promise<MappingQueueJob> {
  const nowIso = new Date().toISOString();
  const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;

  const items: MappingQueueItem[] = input.items.map((item, idx) => {
    const alreadyInR2 = Boolean(item.r2Key && item.imageUrl);
    return {
      clientItemId: item.clientItemId,
      position: idx,
      r2Key: item.r2Key || '',
      imageUrl: item.imageUrl || '',
      originalUrl: item.originalUrl,
      savedPercent: item.savedPercent,
      compressedBytes: item.compressedBytes,
      uploadStatus: alreadyInR2 ? 'done' : 'pending',
      receiveStatus: alreadyInR2 ? 'received' : 'waiting',
      status: 'queued',
      attempts: 0,
      nextRetryAt: null,
      lastError: null,
      errorKind: null,
      r2Deleted: false,
      persistedInService: false,
      mapped: null,
    };
  });

  const needsR2Upload = items.some((item) => item.uploadStatus !== 'done');

  const job: MappingQueueJob = {
    id: jobId,
    userId: input.authUser.userId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    serviceId: null,
    serviceSlug: input.serviceSlug,
    serviceName: null,
    keyPrefix: input.keyPrefix,
    keyHash: input.keyHash,
    status: needsR2Upload ? 'uploading_r2' : 'running',
    totalItems: items.length,
    mappedCount: 0,
    failedCount: 0,
    retryingCount: 0,
    cooldownUntil: null,
    planBRolledBack: false,
    planBDeletedKeys: 0,
    notice: needsR2Upload
      ? `Subiendo a R2 en segundo plano (0/${items.length}) · Puedes salir y volver cuando quieras.`
      : `Mapeando en segundo plano (0/${items.length}) · Puedes salir y volver cuando quieras.`,
    createdAt: nowIso,
    updatedAt: nowIso,
    items,
  };

  const ctx: JobRuntimeContext = {
    authUser: input.authUser,
    requestOrigin: input.requestOrigin,
    pendingUploads: input.pendingUploads ?? new Map(),
    cancelled: false,
    running: false,
    mappingJobsTableMissing: false,
  };

  noActiveJobCache.delete(input.authUser.userId);
  invalidateUserImageQuotaCache(input.authUser.userId);
  invalidateCoreCatalogCache({ slug: input.serviceSlug, keyHash: input.keyHash });

  jobsById.set(jobId, job);
  latestJobIdByUser.set(input.authUser.userId, jobId);
  runtimeByJobId.set(jobId, ctx);

  if (jobsById.size > 400) {
    for (const oldId of jobsById.keys()) {
      const oldCtx = runtimeByJobId.get(oldId);
      if (!oldCtx?.running && oldId !== jobId) {
        jobsById.delete(oldId);
        runtimeByJobId.delete(oldId);
        if (jobsById.size <= 250) break;
      }
    }
  }

  await persistJobRecordToSupabase(job, ctx);
  void purgeOldFinishedMappingJobs(
    input.authUser.userId,
    input.authUser.accessToken,
  );

  // Start background worker (Phase 1 R2 -> Phase 2 Gemini -> Plan B) without blocking HTTP response
  void runQueueWorker(jobId);

  return job;
}

function hydrateJobFromDbRow(row: Record<string, unknown>): MappingQueueJob {
  const rawItems = Array.isArray(row.items_json)
    ? (row.items_json as Array<Partial<MappingQueueItem>>).map((item, idx) => {
        const r2Key = typeof item.r2Key === 'string' ? item.r2Key : '';
        const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : '';
        const r2Deleted = Boolean(item.r2Deleted);
        const uploadStatus: MappingQueueItemUploadStatus =
          item.uploadStatus ||
          (r2Deleted ? 'error' : r2Key && imageUrl ? 'done' : 'pending');
        const receiveStatus: MappingQueueItemReceiveStatus =
          item.receiveStatus ||
          (r2Deleted ? 'error' : imageUrl ? 'received' : 'waiting');

        return {
          clientItemId: String(item.clientItemId || `item-${idx}`),
          position: typeof item.position === 'number' ? item.position : idx,
          r2Key,
          imageUrl,
          originalUrl: item.originalUrl,
          savedPercent: typeof item.savedPercent === 'number' ? item.savedPercent : 0,
          compressedBytes:
            typeof item.compressedBytes === 'number' ? item.compressedBytes : 0,
          uploadStatus,
          receiveStatus,
          status: (item.status as MappingQueueItemStatus) || 'queued',
          attempts: typeof item.attempts === 'number' ? item.attempts : 0,
          nextRetryAt:
            typeof item.nextRetryAt === 'number' ? item.nextRetryAt : null,
          lastError: typeof item.lastError === 'string' ? item.lastError : null,
          errorKind: item.errorKind ?? null,
          r2Deleted,
          persistedInService: Boolean(item.persistedInService),
          mapped: item.mapped ?? null,
        };
      })
    : [];

  const cooldownRaw =
    typeof row.cooldown_until === 'string' && row.cooldown_until
      ? Date.parse(row.cooldown_until)
      : NaN;

  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    sourceType: row.source_type === 'url' ? 'url' : 'files',
    sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
    serviceId: typeof row.servicio_id === 'string' ? row.servicio_id : null,
    serviceSlug: String(row.service_slug || ''),
    serviceName:
      typeof row.service_name === 'string' ? row.service_name : null,
    keyPrefix: typeof row.key_prefix === 'string' ? row.key_prefix : '',
    keyHash: typeof row.key_hash === 'string' ? row.key_hash : '',
    status: (row.status as MappingQueueJobStatus) || 'completed',
    totalItems: Number(row.total_items) || rawItems.length,
    mappedCount: Number(row.mapped_count) || 0,
    failedCount: Number(row.failed_count) || 0,
    retryingCount: Number(row.retrying_count) || 0,
    cooldownUntil: Number.isFinite(cooldownRaw) ? cooldownRaw : null,
    planBRolledBack: Boolean(row.plan_b_rolled_back),
    planBDeletedKeys: Number(row.plan_b_deleted_keys) || 0,
    notice: typeof row.notice === 'string' ? row.notice : null,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString(),
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : new Date().toISOString(),
    items: rawItems,
  };
}

export async function getMappingJobForUser(
  jobId: string,
  userId: string,
  accessToken: string,
): Promise<MappingQueueJob | null> {
  const memJob = jobsById.get(jobId);
  if (memJob && memJob.userId === userId) {
    return memJob;
  }

  const supabase = createUserSupabaseClient(accessToken);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('mapping_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return hydrateJobFromDbRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getLatestMappingJobForUser(
  authUser: AuthenticatedRequestUser,
): Promise<MappingQueueJob | null> {
  const latestId = latestJobIdByUser.get(authUser.userId);
  if (latestId) {
    const memJob = jobsById.get(latestId);
    if (memJob && memJob.userId === authUser.userId) {
      return memJob;
    }
  }

  const now = Date.now();
  const cachedEmptyUntil = noActiveJobCache.get(authUser.userId);
  if (cachedEmptyUntil && cachedEmptyUntil > now) {
    return null;
  }
  if (cachedEmptyUntil) {
    noActiveJobCache.delete(authUser.userId);
  }

  const supabase = createUserSupabaseClient(authUser.accessToken);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('mapping_jobs')
      .select('*')
      .eq('user_id', authUser.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    if (!data) {
      if (noActiveJobCache.size >= 2000) {
        const oldestKey = noActiveJobCache.keys().next().value;
        if (oldestKey) noActiveJobCache.delete(oldestKey);
      }
      noActiveJobCache.set(authUser.userId, now + NO_ACTIVE_JOB_CACHE_TTL_MS);
      return null;
    }
    const hydrated = hydrateJobFromDbRow(data as Record<string, unknown>);
    jobsById.set(hydrated.id, hydrated);
    latestJobIdByUser.set(authUser.userId, hydrated.id);

    // If Render restarted mid-R2 upload (without buffers in RAM), execute Plan B cleanup cleanly
    if (hydrated.status === 'uploading_r2') {
      const ctx: JobRuntimeContext = {
        authUser,
        pendingUploads: new Map(),
        cancelled: false,
        running: false,
        mappingJobsTableMissing: false,
      };
      runtimeByJobId.set(hydrated.id, ctx);

      const hasAllR2Keys = hydrated.items.every(
        (i) => i.uploadStatus === 'done' && Boolean(i.r2Key) && Boolean(i.imageUrl),
      );
      if (!hasAllR2Keys) {
        await executePlanBForSevereBatchFailure(
          hydrated,
          ctx,
          'Plan B activado: el servidor se reinició durante la subida a R2 y se limpiaron los archivos parciales.',
        );
        return hydrated;
      }
      hydrated.status = 'running';
      void runQueueWorker(hydrated.id);
      return hydrated;
    }

    const hasPending = hydrated.items.some(
      (i) =>
        i.status === 'queued' ||
        i.status === 'processing' ||
        i.status === 'retry_wait',
    );
    if (
      (hydrated.status === 'running' || hydrated.status === 'cooling_down') &&
      hasPending
    ) {
      for (const item of hydrated.items) {
        if (item.status === 'processing') {
          item.status = 'queued';
        }
      }
      runtimeByJobId.set(hydrated.id, {
        authUser,
        pendingUploads: new Map(),
        cancelled: false,
        running: false,
        mappingJobsTableMissing: false,
      });
      void runQueueWorker(hydrated.id);
    }

    return hydrated;
  } catch {
    return null;
  }
}

export async function cancelMappingJobForUser(
  jobId: string,
  userId: string,
  accessToken: string,
): Promise<MappingQueueJob | null> {
  const memJob = jobsById.get(jobId);
  const ctx = runtimeByJobId.get(jobId);
  if (memJob && memJob.userId === userId && ctx) {
    ctx.cancelled = true;
    memJob.notice = 'Trabajo cancelado; limpiando imágenes no completadas en R2.';
    memJob.updatedAt = new Date().toISOString();
    await persistJobRecordToSupabase(memJob, ctx);
    return memJob;
  }

  const existing = await getMappingJobForUser(jobId, userId, accessToken);
  if (!existing) return null;
  if (
    existing.status === 'uploading_r2' ||
    existing.status === 'running' ||
    existing.status === 'cooling_down'
  ) {
    existing.status = 'cancelled';
    existing.cooldownUntil = null;
    existing.updatedAt = new Date().toISOString();
  }
  return existing;
}
