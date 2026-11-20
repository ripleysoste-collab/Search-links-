import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  GeminiMapError,
  mapStoredImageWithGemini,
  type MappedImageMetadata,
} from './geminiMapper.ts';
import { unmarkFreeAccountImageConsumed } from './planLimits.ts';
import { deleteImageFromR2, deleteImagesFromR2 } from './r2Storage.ts';
import { getSupabaseServerConfig } from './supabaseServer.ts';

export const QUEUE_BATCH_BEFORE_PAUSE = 5;
export const QUEUE_COOLDOWN_MS = 10_000;
export const QUEUE_INTER_ITEM_MS = 350;
export const QUEUE_MAX_TRANSIENT_ATTEMPTS = 6;

const TRANSIENT_BACKOFF_MS = [10_000, 20_000, 35_000, 50_000, 60_000];

export type MappingQueueItemStatus =
  | 'queued'
  | 'processing'
  | 'retry_wait'
  | 'mapped'
  | 'failed';

export type MappingQueueJobStatus =
  | 'running'
  | 'cooling_down'
  | 'completed'
  | 'failed_rolled_back'
  | 'cancelled';

export interface MappingQueueItemInput {
  clientItemId: string;
  r2Key: string;
  imageUrl: string;
  originalUrl?: string;
  savedPercent: number;
  compressedBytes: number;
}

export interface MappingQueueItem extends MappingQueueItemInput {
  position: number;
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
  userId: string;
  accessToken: string;
  sourceType: 'url' | 'files';
  sourceUrl?: string | null;
  serviceSlug: string;
  keyPrefix: string;
  keyHash: string;
  items: MappingQueueItemInput[];
}

interface JobRuntimeContext {
  accessToken: string;
  cancelled: boolean;
  running: boolean;
  mappingJobsTableMissing: boolean;
}

const jobsById = new Map<string, MappingQueueJob>();
const latestJobIdByUser = new Map<string, string>();
const runtimeByJobId = new Map<string, JobRuntimeContext>();

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
    compressionStatuses[item.clientItemId] = item.r2Deleted ? 'error' : 'done';
    uploadStatuses[item.clientItemId] = item.r2Deleted ? 'error' : 'done';
    receiveStatuses[item.clientItemId] = item.r2Deleted ? 'error' : 'received';

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

    if (!item.r2Deleted) {
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
  const supabase = createUserSupabaseClient(ctx.accessToken);
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
  const supabase = createUserSupabaseClient(ctx.accessToken);
  if (!supabase) return;

  try {
    const snapshot = buildServiceSnapshotPayload(job);

    if (!job.serviceId) {
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
    } else {
      await supabase
        .from('servicios')
        .update({
          item_count: job.mappedCount,
          snapshot_json: snapshot,
          updated_at: new Date().toISOString(),
        })
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
  const supabase = createUserSupabaseClient(ctx.accessToken);
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
  const supabase = createUserSupabaseClient(ctx.accessToken);
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

  job.planBRolledBack = true;
  job.status = 'failed_rolled_back';
  job.cooldownUntil = null;
  job.notice = reasonNotice;
  recomputeCounters(job);
  await persistJobRecordToSupabase(job, ctx);
}

function findNextReadyItem(
  queue: MappingQueueItem[],
  now: number,
): { item: MappingQueueItem | null; earliestWaitMs: number | null } {
  // Prefer normal queued items first so 503 retries move to the back of the line
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

  // Dynamic rotation order: push 503 items to the back cleanly
  const workQueue: MappingQueueItem[] = [...job.items];
  let processedInBurst = 0;

  try {
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
          await persistJobRecordToSupabase(job, ctx);
          await sleep(Math.min(earliestWaitMs, 10_000));
          continue;
        }
        break;
      }

      // Apply 10-second breathing cooldown after every 5 mappings
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
      await persistJobRecordToSupabase(job, ctx);

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
        await persistSingleMappedProductToSupabase(job, item, ctx);
        await persistJobRecordToSupabase(job, ctx);
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
          // Stop entire job immediately if Gemini API Key is invalid/rejected
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

          // Move this item to the back of the queue so healthy items finish first
          const idx = workQueue.indexOf(item);
          if (idx !== -1) {
            workQueue.splice(idx, 1);
            workQueue.push(item);
          }

          recomputeCounters(job);
          await persistJobRecordToSupabase(job, ctx);
        } else {
          // Definitive failure (or exhausted all 503 retries): Plan B single-image R2 delete
          item.status = 'failed';
          item.nextRetryAt = null;
          await executePlanBForSingleItem(job, item);
          recomputeCounters(job);
          await persistJobRecordToSupabase(job, ctx);
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
      recomputeCounters(job);
      await persistJobRecordToSupabase(job, ctx);
      return;
    }

    recomputeCounters(job);

    // Plan B Batch Check:
    // If 0 mapped OR (definitive/fatal failures caused <= 60% success rate), roll back orphaned batch
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
    job.status = 'completed';
    job.cooldownUntil = null;
    job.notice =
      job.failedCount > 0
        ? `Catálogo guardado con ${job.mappedCount} productos válidos. Plan B eliminó ${job.planBDeletedKeys} imagen(es) inválida(s) de R2.`
        : null;
    recomputeCounters(job);
    await persistJobRecordToSupabase(job, ctx);
  } finally {
    ctx.running = false;
  }
}

export async function createAndStartMappingJob(
  input: CreateMappingJobInput,
): Promise<MappingQueueJob> {
  const nowIso = new Date().toISOString();
  const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;

  const items: MappingQueueItem[] = input.items.map((item, idx) => ({
    clientItemId: item.clientItemId,
    position: idx,
    r2Key: item.r2Key,
    imageUrl: item.imageUrl,
    originalUrl: item.originalUrl,
    savedPercent: item.savedPercent,
    compressedBytes: item.compressedBytes,
    status: 'queued',
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    errorKind: null,
    r2Deleted: false,
    persistedInService: false,
    mapped: null,
  }));

  const job: MappingQueueJob = {
    id: jobId,
    userId: input.userId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    serviceId: null,
    serviceSlug: input.serviceSlug,
    serviceName: null,
    keyPrefix: input.keyPrefix,
    keyHash: input.keyHash,
    status: 'running',
    totalItems: items.length,
    mappedCount: 0,
    failedCount: 0,
    retryingCount: 0,
    cooldownUntil: null,
    planBRolledBack: false,
    planBDeletedKeys: 0,
    notice: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    items,
  };

  const ctx: JobRuntimeContext = {
    accessToken: input.accessToken,
    cancelled: false,
    running: false,
    mappingJobsTableMissing: false,
  };

  jobsById.set(jobId, job);
  latestJobIdByUser.set(input.userId, jobId);
  runtimeByJobId.set(jobId, ctx);

  // Prune older finished jobs from RAM if map grows very large
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

  // Start background queue immediately without blocking HTTP response
  void runQueueWorker(jobId);

  return job;
}

function hydrateJobFromDbRow(row: Record<string, unknown>): MappingQueueJob {
  const rawItems = Array.isArray(row.items_json)
    ? (row.items_json as MappingQueueItem[])
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
  userId: string,
  accessToken: string,
): Promise<MappingQueueJob | null> {
  const latestId = latestJobIdByUser.get(userId);
  if (latestId) {
    const memJob = jobsById.get(latestId);
    if (memJob && memJob.userId === userId) {
      return memJob;
    }
  }

  const supabase = createUserSupabaseClient(accessToken);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('mapping_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const hydrated = hydrateJobFromDbRow(data as Record<string, unknown>);

    // If Render restarted while job was still 'running' or 'cooling_down', resume pending items cleanly
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
      jobsById.set(hydrated.id, hydrated);
      latestJobIdByUser.set(userId, hydrated.id);
      runtimeByJobId.set(hydrated.id, {
        accessToken,
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
    existing.status === 'running' ||
    existing.status === 'cooling_down'
  ) {
    existing.status = 'cancelled';
    existing.cooldownUntil = null;
    existing.updatedAt = new Date().toISOString();
  }
  return existing;
}
