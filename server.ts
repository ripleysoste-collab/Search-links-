import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlockedPolicyDomain } from './lib/blockedDomains.ts';
import { extractImagesFromUrl } from './lib/extractor.ts';
import { PolicyBlockedDomainError } from './lib/urlSafety.ts';
import {
  cancelMappingJobForUser,
  createAndStartMappingJob,
  getLatestMappingJobForUser,
  getMappingJobForUser,
  type MappingQueueItemInput,
  type PendingR2UploadPayload,
} from './lib/mappingQueue.ts';
import {
  checkAndBlockExhaustedGuestImageBank,
  checkAndConsumeGuestExtractQuota,
  checkFreeAccountImageQuota,
  consumeGuestImageBankAttempt,
  fetchUserFreeUsageLedger,
  FREE_PLAN_MAX_IMAGES,
  GUEST_EXTRACT_MAX_IMAGES,
  inspectGuestExtractStatus,
  inspectGuestImageBankStatus,
  invalidateUserImageQuotaCache,
  isAdminTestEmail,
  markFreeAccountImageConsumed,
  verifySupabaseBearerUser,
} from './lib/planLimits.ts';
import {
  buildClearQuotaCookiesHeaders,
  deleteUserCoreService,
  getServiceTrafficLimitsForUser,
  getUserQuotaSummary,
  pauseAllUserApis,
  permanentlyDeleteUserAccount,
  purgeAllUserR2Images,
  saveServiceTrafficLimitsForUser,
  unfreezeAllUserApis,
} from './lib/accountActions.ts';
import {
  checkDailyLimit,
  consumeDailyLimit,
  streamSearchLinkChat,
  type SearchLinkChatTurn,
} from './lib/searchLinkChat.ts';
import {
  detectLocaleFromRequest,
  type SupportedLocale,
} from './lib/localeDetection.ts';
import { fetchProxiedImage } from './lib/imageProxy.ts';
import {
  checkImageBankCooldown,
  consumeImageBankCooldown,
  generateFluxImageWithCloudflare,
  getImageBankConfigStatus,
  hasImageBankPlusAccess,
  ImageBankConfigError,
  ImageBankUpstreamError,
  searchPublicImageBank,
} from './lib/imageBank.ts';
import {
  getMissingR2EnvNames,
  isR2Configured,
  isValidMediaKey,
  readImageFromR2,
} from './lib/r2Storage.ts';
import {
  extractCoreRequestParams,
  getSearchLinkCoreManifest,
  invalidateCoreCatalogCache,
  resolveSearchLinkCoreEndpoint,
  SEARCH_LINK_CORE_NAME,
  SEARCH_LINK_CORE_VERSION,
} from './lib/supabaseServer.ts';
import {
  decodeBase64ImagePayload,
  getRequestOrigin,
  MAX_UPLOAD_BYTES,
  processAndStoreUploadedImage,
  sanitizeUploadFolderPrefix,
} from './lib/uploadHandler.ts';
import {
  executeAgencyServerDisconnect,
  executeAgencyServerSync,
  executeAgencyServerTest,
  type AgencySyncEventType,
  type AgencySyncFallbackService,
} from './lib/agencySync.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

function parseAllowedOrigins(): string[] {
  const combined = [process.env.ALLOWED_ORIGINS, process.env.APP_URL]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(',');
  return combined
    .split(',')
    .map((entry) => entry.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
    .filter(Boolean);
}

function isOriginAllowed(origin: string, allowList: string[]): boolean {
  if (!origin) return false;
  if (allowList.length === 0) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  const normalized = origin.replace(/\/+$/, '').toLowerCase();
  return allowList.some((pattern) => {
    const cleanPattern = pattern.toLowerCase();
    if (cleanPattern === '*') return true;
    if (cleanPattern.startsWith('*.')) {
      const suffix = cleanPattern.slice(1);
      try {
        return new URL(normalized).hostname.endsWith(suffix);
      } catch {
        return false;
      }
    }
    return normalized === cleanPattern;
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = parseAllowedOrigins();
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/v1/')) {
      return next();
    }
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Upload-Folder, x-api-key',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  // Skip small global JSON parser for routes that define their own larger body limits
  const defaultJsonParser = express.json({ limit: '128kb' });
  app.use((req, res, next) => {
    if (
      req.path === '/api/upload' ||
      req.path === '/api/jobs/map' ||
      req.path === '/api/chat'
    ) {
      return next();
    }
    return defaultJsonParser(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    const imageBankStatus = getImageBankConfigStatus();
    return res.json({
      ok: true,
      service: 'search-link-api',
      status: 'up',
      configured: {
        r2: isR2Configured(),
        missingR2: getMissingR2EnvNames(),
        gemini: Boolean(geminiKey && !/^TU_/i.test(geminiKey)),
        groq: Boolean(groqKey && !/^TU_/i.test(groqKey)),
        pixabay: imageBankStatus.pixabay,
        pexels: imageBankStatus.pexels,
        flux: imageBankStatus.flux,
      },
    });
  });

  app.post('/api/cache/invalidate', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim()
        : undefined;
    invalidateUserImageQuotaCache(authUser.userId);
    invalidateCoreCatalogCache(slug ? { slug } : undefined);
    return res.json({ ok: true });
  });

  app.get('/api/extract', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    const status = inspectGuestExtractStatus(
      req.headers,
      req.socket?.remoteAddress,
      authUser,
    );
    if (status.clearCookieHeader) {
      res.setHeader('Set-Cookie', status.clearCookieHeader);
    }
    return res.json({
      ipBlocked: status.ipBlocked,
      attemptsUsed: status.attemptsUsed,
    });
  });

  app.post('/api/extract', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
      if (isBlockedPolicyDomain(rawUrl).blocked) {
        return res.status(403).json({
          policyBlocked: true,
          error: 'Este dominio viola nuestras políticas de contenido',
        });
      }

      const authUser = await verifySupabaseBearerUser(req.headers);
      const guestQuota = checkAndConsumeGuestExtractQuota(
        req.headers,
        req.socket?.remoteAddress,
        authUser,
      );
      res.setHeader('Set-Cookie', guestQuota.setCookieHeader);

      if (!guestQuota.allowed) {
        return res.status(429).json({
          ipBlocked: true,
          error: 'Su IP ha sido bloqueado. Inicia sesión.',
        });
      }

      const requestedMax =
        typeof req.body?.maxResults === 'number' && Number.isFinite(req.body.maxResults)
          ? Math.max(1, Math.trunc(req.body.maxResults))
          : undefined;

      const maxResults = !authUser
        ? GUEST_EXTRACT_MAX_IMAGES
        : isAdminTestEmail(authUser.email)
          ? Math.min(requestedMax ?? 50, 50)
          : Math.min(requestedMax ?? FREE_PLAN_MAX_IMAGES, FREE_PLAN_MAX_IMAGES);

      const result = await extractImagesFromUrl(rawUrl, { maxResults });

      if (result.images.length === 0) {
        return res.status(422).json({
          error:
            'No se encontraron imágenes válidas de al menos 200×200 píxeles en esa página.',
          sourceUrl: result.sourceUrl,
        });
      }

      return res.json(result);
    } catch (err) {
      if (err instanceof PolicyBlockedDomainError) {
        return res.status(403).json({
          policyBlocked: true,
          error: err.message,
        });
      }
      const message =
        err instanceof Error ? err.message : 'Ocurrió un error al analizar la página.';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/image-proxy', async (req, res) => {
    const rawImageUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const rawReferer = typeof req.query.ref === 'string' ? req.query.ref : undefined;

    if (!rawImageUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const { contentType, buffer } = await fetchProxiedImage(rawImageUrl, rawReferer);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch {
      return res.status(502).send('Image fetch failed');
    }
  });

  app.get('/api/image-bank/search', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      return res.status(400).json({
        error: 'Escribe una descripción para buscar imágenes.',
      });
    }

    const authUser = await verifySupabaseBearerUser(req.headers);
    const guestCheck = checkAndBlockExhaustedGuestImageBank(
      req.headers,
      req.socket?.remoteAddress,
      authUser,
    );
    if (guestCheck.setCookieHeader) {
      res.append('Set-Cookie', guestCheck.setCookieHeader);
    }
    if (!guestCheck.allowed) {
      return res.status(429).json({
        ipBlocked: true,
        error: 'Su IP ha sido bloqueado. Inicia sesión.',
      });
    }

    const cooldown = checkImageBankCooldown(
      req.headers,
      authUser?.userId,
      req.socket?.remoteAddress,
    );
    if (!cooldown.allowed) {
      res.setHeader('Retry-After', String(cooldown.retryAfterSeconds));
      return res.status(429).json({
        rateLimited: true,
        retryAfterSeconds: cooldown.retryAfterSeconds,
        error: 'Prohibido saturar servidores ajenos. Espera un momento.',
      });
    }

    try {
      const result = await searchPublicImageBank(rawQuery);
      const consumed = consumeImageBankCooldown(
        req.headers,
        authUser?.userId,
        req.socket?.remoteAddress,
      );
      res.append('Set-Cookie', consumed.cookieHeader);

      const guestConsumed = consumeGuestImageBankAttempt(
        req.headers,
        req.socket?.remoteAddress,
        authUser,
      );
      if (guestConsumed.setCookieHeader) {
        res.append('Set-Cookie', guestConsumed.setCookieHeader);
      }

      return res.json({
        ok: true,
        cooldownSeconds: consumed.cooldownSeconds,
        ...result,
      });
    } catch (err) {
      if (err instanceof ImageBankConfigError) {
        return res.status(503).json({
          notConfigured: true,
          error:
            'El banco público de imágenes aún no tiene configurada la variable PIXABAY_API_KEY en el servidor.',
        });
      }
      if (err instanceof ImageBankUpstreamError) {
        return res.status(err.status).json({
          error: err.message,
        });
      }
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo consultar el banco público de imágenes.';
      return res.status(502).json({ error: message });
    }
  });

  app.get('/api/image-bank/access', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    const guestStatus = inspectGuestImageBankStatus(
      req.headers,
      req.socket?.remoteAddress,
      authUser,
    );
    if (guestStatus.clearCookieHeader) {
      res.append('Set-Cookie', guestStatus.clearCookieHeader);
    }
    const hasPlusAccess = authUser
      ? hasImageBankPlusAccess(authUser.email, authUser.appMetadata)
      : false;
    return res.json({
      ok: true,
      hasPlusAccess,
      guestIpBlocked: guestStatus.ipBlocked,
    });
  });

  app.post('/api/image-bank/generate', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser || !hasImageBankPlusAccess(authUser.email, authUser.appMetadata)) {
      return res.status(403).json({
        plusRequired: true,
        error: 'Tienes que ser nivel Plus para generar.',
      });
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      return res.status(400).json({
        error: 'Escribe una descripción primero para generar la imagen.',
      });
    }

    try {
      const item = await generateFluxImageWithCloudflare(prompt);
      return res.json({
        ok: true,
        item,
      });
    } catch (err) {
      if (err instanceof ImageBankConfigError) {
        return res.status(503).json({
          notConfigured: true,
          error:
            'La generación con IA aún no está configurada en el servidor (CLOUDFLARE_WORKERS_AI_API_TOKEN).',
        });
      }
      if (err instanceof ImageBankUpstreamError) {
        return res.status(err.status).json({
          error: err.message,
        });
      }
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo generar la imagen con IA.';
      return res.status(502).json({ error: message });
    }
  });

  app.get('/api/media', async (req, res) => {
    const key = typeof req.query.k === 'string' ? req.query.k : '';
    if (!key || !isValidMediaKey(key)) {
      return res.status(400).send('Invalid media key');
    }

    try {
      const { buffer, contentType, etag } = await readImageFromR2(key);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (etag) {
        res.setHeader('ETag', etag);
      }
      return res.send(buffer);
    } catch {
      return res.status(404).send('Media not found');
    }
  });

  app.post(
    '/api/upload',
    express.json({ type: 'application/json', limit: '6mb' }),
    express.raw({ type: 'image/*', limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      try {
        const authUser = await verifySupabaseBearerUser(req.headers);
        if (!authUser) {
          return res.status(401).json({
            error: 'Inicia sesión con Google para subir imágenes.',
          });
        }

        const buffer = Buffer.isBuffer(req.body)
          ? req.body
          : decodeBase64ImagePayload(req.body);

        if (!buffer || buffer.byteLength === 0) {
          return res.status(400).json({
            error: 'No se recibió un archivo de imagen válido.',
          });
        }

        const rawFolder =
          typeof req.headers['x-upload-folder'] === 'string'
            ? req.headers['x-upload-folder']
            : typeof req.query.folder === 'string'
              ? req.query.folder
              : req.body &&
                  typeof req.body === 'object' &&
                  !Buffer.isBuffer(req.body)
                ? (req.body as Record<string, unknown>).folder
                : undefined;

        const folder = sanitizeUploadFolderPrefix(rawFolder);
        if (folder === 'catalog') {
          const quota = await checkFreeAccountImageQuota(authUser);
          if (!quota.allowed) {
            return res.status(429).json({
              quotaExceeded: true,
              used: quota.used,
              limit: quota.limit,
              error: `Has alcanzado el límite de ${FREE_PLAN_MAX_IMAGES} imágenes del plan gratuito.`,
            });
          }
        }

        const result = await processAndStoreUploadedImage(
          buffer,
          getRequestOrigin(req.headers),
          folder,
        );

        if (folder === 'catalog') {
          markFreeAccountImageConsumed(authUser, result.key);
        }

        return res.json(result);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Ocurrió un error al subir la imagen.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/jobs/map',
    express.json({ type: 'application/json', limit: '30mb' }),
    async (req, res) => {
      try {
        const authUser = await verifySupabaseBearerUser(req.headers);
        if (!authUser) {
          return res.status(401).json({
            error: 'Inicia sesión con Google para iniciar el proceso en segundo plano.',
          });
        }

        const body = (req.body ?? {}) as Record<string, unknown>;
        const sourceType = body.sourceType === 'url' ? 'url' : 'files';
        const sourceUrl =
          typeof body.sourceUrl === 'string' && body.sourceUrl.trim()
            ? body.sourceUrl.trim()
            : null;
        const serviceSlug =
          typeof body.serviceSlug === 'string' ? body.serviceSlug.trim() : '';
        const keyPrefix =
          typeof body.keyPrefix === 'string' ? body.keyPrefix.trim() : '';
        const keyHash =
          typeof body.keyHash === 'string' ? body.keyHash.trim() : '';
        const rawItems = Array.isArray(body.items) ? body.items : [];

        if (!serviceSlug || !keyPrefix || !keyHash || rawItems.length === 0) {
          return res.status(400).json({
            error: 'Faltan datos válidos del lote para iniciar en segundo plano.',
          });
        }

        if (sourceUrl && isBlockedPolicyDomain(sourceUrl).blocked) {
          return res.status(403).json({
            policyBlocked: true,
            error: 'Este dominio viola nuestras políticas de contenido',
          });
        }

        const items: MappingQueueItemInput[] = [];
        const pendingUploads = new Map<string, PendingR2UploadPayload>();

        for (const entry of rawItems) {
          if (!entry || typeof entry !== 'object') continue;
          const item = entry as Record<string, unknown>;
          const clientItemId =
            typeof item.clientItemId === 'string' ? item.clientItemId.trim() : '';
          if (!clientItemId) continue;

          const r2Key = typeof item.r2Key === 'string' ? item.r2Key.trim() : '';
          const imageUrl =
            typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
          const dataBase64 =
            typeof item.dataBase64 === 'string' ? item.dataBase64.trim() : '';
          const sourceImageUrl =
            typeof item.sourceImageUrl === 'string'
              ? item.sourceImageUrl.trim()
              : '';
          const originalUrl =
            typeof item.originalUrl === 'string' ? item.originalUrl.trim() : undefined;

          if (
            (sourceImageUrl && isBlockedPolicyDomain(sourceImageUrl).blocked) ||
            (originalUrl && isBlockedPolicyDomain(originalUrl).blocked)
          ) {
            return res.status(403).json({
              policyBlocked: true,
              error: 'Este dominio viola nuestras políticas de contenido',
            });
          }

          const savedPercent =
            typeof item.savedPercent === 'number' && Number.isFinite(item.savedPercent)
              ? Math.max(0, Math.min(99, Math.trunc(item.savedPercent)))
              : 0;
          const compressedBytes =
            typeof item.compressedBytes === 'number' &&
            Number.isFinite(item.compressedBytes)
              ? Math.max(0, Math.trunc(item.compressedBytes))
              : 0;

          if (r2Key && imageUrl && isValidMediaKey(r2Key)) {
            items.push({
              clientItemId,
              r2Key,
              imageUrl,
              originalUrl,
              savedPercent,
              compressedBytes,
            });
            continue;
          }

          if (dataBase64) {
            const buffer = decodeBase64ImagePayload({ dataBase64 });
            pendingUploads.set(clientItemId, { buffer });
            items.push({
              clientItemId,
              originalUrl,
              savedPercent,
              compressedBytes: compressedBytes || buffer.byteLength,
            });
            continue;
          }

          if (sourceImageUrl && /^https?:\/\//i.test(sourceImageUrl)) {
            pendingUploads.set(clientItemId, { sourceImageUrl });
            items.push({
              clientItemId,
              sourceImageUrl,
              originalUrl,
              savedPercent,
              compressedBytes,
            });
          }
        }

        if (items.length === 0) {
          return res.status(400).json({
            error: 'No hay imágenes válidas para procesar en segundo plano.',
          });
        }

        const maxAllowed = isAdminTestEmail(authUser.email)
          ? 50
          : FREE_PLAN_MAX_IMAGES;
        if (items.length > maxAllowed) {
          return res.status(429).json({
            quotaExceeded: true,
            error: `El lote excede el máximo permitido (${maxAllowed} imágenes).`,
          });
        }

        if (pendingUploads.size > 0 && !isAdminTestEmail(authUser.email)) {
          const quota = await checkFreeAccountImageQuota(authUser);
          if (!quota.allowed || pendingUploads.size > quota.remaining) {
            return res.status(429).json({
              quotaExceeded: true,
              used: quota.used,
              limit: quota.limit,
              error: `Has alcanzado el límite de ${FREE_PLAN_MAX_IMAGES} imágenes del plan gratuito.`,
            });
          }
        }

        const job = await createAndStartMappingJob({
          authUser,
          requestOrigin: getRequestOrigin(req.headers),
          sourceType,
          sourceUrl,
          serviceSlug,
          keyPrefix,
          keyHash,
          items,
          pendingUploads,
        });

        return res.status(202).json({ ok: true, job });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo iniciar la cola en segundo plano.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.get('/api/jobs/map/active', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({
        error: 'Inicia sesión para consultar tu cola activa.',
      });
    }

    const job = await getLatestMappingJobForUser(authUser);
    return res.json({ ok: true, job });
  });

  app.get('/api/jobs/map/:jobId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({
        error: 'Inicia sesión para consultar el progreso del mapeo.',
      });
    }

    const jobId = typeof req.params.jobId === 'string' ? req.params.jobId.trim() : '';
    if (!jobId) {
      return res.status(400).json({ error: 'Falta el ID del trabajo.' });
    }

    const job = await getMappingJobForUser(
      jobId,
      authUser.userId,
      authUser.accessToken,
    );
    if (!job) {
      return res.status(404).json({ error: 'Trabajo de mapeo no encontrado.' });
    }

    return res.json({ ok: true, job });
  });

  app.post('/api/jobs/map/:jobId/cancel', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({
        error: 'Inicia sesión para cancelar el trabajo.',
      });
    }

    const jobId = typeof req.params.jobId === 'string' ? req.params.jobId.trim() : '';
    if (!jobId) {
      return res.status(400).json({ error: 'Falta el ID del trabajo.' });
    }

    const job = await cancelMappingJobForUser(
      jobId,
      authUser.userId,
      authUser.accessToken,
    );
    if (!job) {
      return res.status(404).json({ error: 'Trabajo de mapeo no encontrado.' });
    }

    return res.json({ ok: true, job });
  });

  app.post(
    '/api/chat',
    express.json({ type: 'application/json', limit: '512kb' }),
    async (req, res) => {
      const authUser = await verifySupabaseBearerUser(req.headers);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = typeof body.message === 'string' ? body.message : '';
      const serviceSlug =
        typeof body.serviceSlug === 'string' ? body.serviceSlug : undefined;
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;
      const serviceName =
        typeof body.serviceName === 'string' ? body.serviceName : undefined;
      const organizationName =
        typeof body.organizationName === 'string'
          ? body.organizationName
          : undefined;
      const bodyUserId = typeof body.userId === 'string' ? body.userId : undefined;
      const userId = authUser?.userId || bodyUserId;
      const locale: SupportedLocale =
        body.locale === 'en' || body.locale === 'pt' || body.locale === 'es'
          ? body.locale
          : 'es';
      const history = Array.isArray(body.history)
        ? (body.history as SearchLinkChatTurn[])
        : undefined;
      const fallbackProducts = Array.isArray(body.fallbackProducts)
        ? (body.fallbackProducts as Array<{
            id?: string;
            nombre: string;
            categoria: string;
            descripcion: string;
            imagen_url?: string;
            url?: string;
          }>)
        : undefined;

      const carriedChatUsed = authUser
        ? (await fetchUserFreeUsageLedger(authUser)).freeChatUsed
        : 0;

      const limitStatus = checkDailyLimit(
        req.headers,
        userId,
        req.socket?.remoteAddress,
        carriedChatUsed,
      );
      if (!limitStatus.allowed) {
        return res.status(429).json({
          ok: false,
          dailyLimitReached: true,
          used: limitStatus.used,
          limit: limitStatus.limit,
          day: limitStatus.day,
          error:
            locale === 'en'
              ? 'Your limit has been reached, upgrade to the Plus plan.'
              : locale === 'pt'
                ? 'Seu limite foi atingido, mude para o plano Plus.'
                : 'Su límite ha sido alcanzado, pase al plan Plus.',
        });
      }

      let headersSentAsStream = false;
      let consumedDaily: ReturnType<typeof consumeDailyLimit> | null = null;

      for await (const evt of streamSearchLinkChat({
        message,
        history,
        serviceSlug,
        apiKey,
        serviceName,
        organizationName,
        userId,
        locale,
        fallbackProducts,
      })) {
        if (evt.type === 'error' && !headersSentAsStream) {
          return res.status(evt.status).json({
            ok: false,
            error: evt.error,
          });
        }

        if (!headersSentAsStream) {
          headersSentAsStream = true;
          consumedDaily = consumeDailyLimit(
            req.headers,
            userId,
            req.socket?.remoteAddress,
            carriedChatUsed,
          );
          res.setHeader('Set-Cookie', consumedDaily.cookieHeader);
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders?.();
        }

        const outgoingEvent =
          evt.type === 'done' && consumedDaily
            ? {
                ...evt,
                dailyLimit: {
                  used: consumedDaily.used,
                  limit: consumedDaily.limit,
                  day: consumedDaily.day,
                },
              }
            : evt;

        res.write(`event: ${evt.type}\ndata: ${JSON.stringify(outgoingEvent)}\n\n`);
      }

      if (headersSentAsStream) {
        return res.end();
      }
      return res.status(500).json({ ok: false, error: 'Sin respuesta del servidor.' });
    },
  );

  app.get('/api/locale', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const detected = await detectLocaleFromRequest(
        req.headers,
        req.socket?.remoteAddress,
      );
      return res.json({
        ok: true,
        ...detected,
      });
    } catch {
      return res.json({
        ok: true,
        locale: 'es',
        countryCode: null,
        source: 'default',
      });
    }
  });

  app.options(['/api/v1/core', '/api/v1/catalog', '/api/v1/services/:slug'], (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, x-api-key, Content-Type',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('X-Search-Link-Core', SEARCH_LINK_CORE_VERSION);
    return res.status(204).end();
  });

  app.get('/api/v1/core', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Search-Link-Core', SEARCH_LINK_CORE_VERSION);
    return res.json(getSearchLinkCoreManifest(getRequestOrigin(req.headers)));
  });

  app.get(['/api/v1/catalog', '/api/v1/services/:slug'], async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, x-api-key, Content-Type',
    );
    res.setHeader('X-Search-Link-Core', SEARCH_LINK_CORE_VERSION);
    res.setHeader('Cache-Control', 'no-store');

    const slugParam =
      typeof req.params.slug === 'string' ? req.params.slug.trim() : undefined;
    const params = extractCoreRequestParams(req.originalUrl, req.headers, slugParam);
    const result = await resolveSearchLinkCoreEndpoint({
      ...params,
      enforceTrafficRules: true,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        system: SEARCH_LINK_CORE_NAME,
        version: SEARCH_LINK_CORE_VERSION,
        error: result.error,
      });
    }

    return res.json({
      ok: true,
      ...result.data,
    });
  });

  app.post('/api/agency/sync', express.json({ limit: '1mb' }), async (req, res) => {
    const body = (req.body || {}) as {
      serverUrl?: unknown;
      serviceScope?: unknown;
      secretKey?: unknown;
      eventType?: unknown;
      changedServiceId?: unknown;
      dedupeKey?: unknown;
      servicesFallback?: unknown;
    };

    const rawEventType: AgencySyncEventType =
      body.eventType === 'service.created' ||
      body.eventType === 'service.updated' ||
      body.eventType === 'resync'
        ? body.eventType
        : 'manual';

    const result = await executeAgencyServerSync(req.headers, {
      serverUrl: typeof body.serverUrl === 'string' ? body.serverUrl : '',
      serviceScope: typeof body.serviceScope === 'string' ? body.serviceScope : '',
      secretKey: typeof body.secretKey === 'string' ? body.secretKey : '',
      eventType: rawEventType,
      changedServiceId:
        typeof body.changedServiceId === 'string' ? body.changedServiceId : undefined,
      dedupeKey: typeof body.dedupeKey === 'string' ? body.dedupeKey : undefined,
      servicesFallback: Array.isArray(body.servicesFallback)
        ? (body.servicesFallback as AgencySyncFallbackService[])
        : undefined,
    });

    if (!result.ok) {
      return res.status(result.status).json(result);
    }

    return res.json(result);
  });

  app.post('/api/agency/disconnect', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await executeAgencyServerDisconnect(req.headers);
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    return res.json(result);
  });

  app.post('/api/agency/test', express.json({ limit: '64kb' }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = (req.body || {}) as {
      serverUrl?: unknown;
      catalogApiKey?: unknown;
    };
    const result = await executeAgencyServerTest(req.headers, {
      serverUrl: typeof body.serverUrl === 'string' ? body.serverUrl : undefined,
      catalogApiKey:
        typeof body.catalogApiKey === 'string' ? body.catalogApiKey : undefined,
    });
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    return res.json(result);
  });

  app.get('/api/account/quota', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'Inicia sesión para consultar tu cuota.' });
    }
    const summary = await getUserQuotaSummary(authUser);
    return res.json(summary);
  });

  app.post('/api/account/r2-purge', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const result = await purgeAllUserR2Images(authUser);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  });

  app.post(
    '/api/account/services/delete',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const authUser = await verifySupabaseBearerUser(req.headers);
      if (!authUser) {
        return res.status(401).json({ error: 'No autorizado.' });
      }
      const rawServiceId =
        typeof req.body?.serviceId === 'string' ? req.body.serviceId.trim() : '';
      if (!rawServiceId) {
        return res.status(400).json({ error: 'Falta el identificador del servicio.' });
      }
      const result = await deleteUserCoreService(authUser, rawServiceId);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    },
  );

  app.get('/api/account/services/traffic-limits', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const rawServiceId =
      typeof req.query?.serviceId === 'string' ? req.query.serviceId.trim() : '';
    const result = await getServiceTrafficLimitsForUser(authUser, rawServiceId);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  });

  app.post(
    '/api/account/services/traffic-limits',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const authUser = await verifySupabaseBearerUser(req.headers);
      if (!authUser) {
        return res.status(401).json({ error: 'No autorizado.' });
      }
      const body = (req.body || {}) as {
        serviceId?: unknown;
        perMinuteLimit?: unknown;
        perHourLimit?: unknown;
        dailyLimit?: unknown;
        allowedOrigins?: unknown;
      };
      const serviceId =
        typeof body.serviceId === 'string' ? body.serviceId.trim() : '';
      const perMinuteLimit = Number(body.perMinuteLimit);
      const perHourLimit = Number(body.perHourLimit);
      const dailyLimit = Number(body.dailyLimit);
      const allowedOrigins = Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.filter((item): item is string => typeof item === 'string')
        : [];

      const result = await saveServiceTrafficLimitsForUser(authUser, {
        serviceId,
        perMinuteLimit,
        perHourLimit,
        dailyLimit,
        allowedOrigins,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    },
  );

  app.post('/api/account/pause-all-apis', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const result = await pauseAllUserApis(authUser);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  });

  app.post('/api/account/unfreeze-all-apis', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const result = await unfreezeAllUserApis(authUser);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  });

  app.post('/api/account/clear-browser-data', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const clearHeaders = buildClearQuotaCookiesHeaders(req.headers);
    for (const cookieHeader of clearHeaders) {
      res.append('Set-Cookie', cookieHeader);
    }
    return res.json({ ok: true });
  });

  app.post('/api/account/delete', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const result = await permanentlyDeleteUserAccount(
      authUser,
      req.headers,
      req.socket?.remoteAddress,
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    const clearHeaders = buildClearQuotaCookiesHeaders(req.headers);
    for (const cookieHeader of clearHeaders) {
      res.append('Set-Cookie', cookieHeader);
    }
    return res.json(result);
  });

  app.get(['/auth/callback', '/auth/callback/'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conectando con Search Link…</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        padding: 24px;
        text-align: center;
      }
      .card {
        max-width: 360px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.14);
      }
      p { margin: 8px 0 0; font-size: 13px; color: #64748b; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <strong>Autenticación completada</strong>
      <p id="status">Volviendo a Search Link…</p>
    </div>
    <script>
      (function () {
        var payload = {
          type: 'SEARCHLINK_OAUTH_RESULT',
          hash: window.location.hash || '',
          search: window.location.search || '',
        };
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var ch = new BroadcastChannel('searchlink-oauth');
            ch.postMessage(payload);
            ch.close();
          }
        } catch (e) {}
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(payload, window.location.origin);
          } catch (e) {}
          try {
            window.opener.postMessage(payload, '*');
          } catch (e) {}
          window.close();
          setTimeout(function () {
            document.getElementById('status').textContent =
              'Ya puedes cerrar esta ventana y volver a Search Link.';
          }, 400);
        } else {
          window.location.replace('/' + (window.location.search || '') + (window.location.hash || ''));
        }
      })();
    </script>
  </body>
</html>`);
  });

  app.use(
    '/api',
    (
      err: { status?: number; statusCode?: number; type?: string; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.statusCode === 'number'
            ? err.statusCode
            : 400;
      const message =
        err?.type === 'entity.too.large'
          ? 'La imagen o solicitud supera el tamaño máximo permitido.'
          : err?.message || 'Error procesando la solicitud.';
      return res.status(status).json({ error: message });
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(rootDir, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    if (fs.existsSync(distIndex)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(distIndex);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({
          ok: true,
          service: 'search-link-api',
          health: '/api/health',
        });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Search Link server running on http://localhost:${PORT}`);
  });
}

startServer();
