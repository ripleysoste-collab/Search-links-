import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractImagesFromUrl } from './lib/extractor.ts';
import { mapStoredImageWithGemini } from './lib/geminiMapper.ts';
import {
  cancelMappingJobForUser,
  createAndStartMappingJob,
  getLatestMappingJobForUser,
  getMappingJobForUser,
  type MappingQueueItemInput,
} from './lib/mappingQueue.ts';
import {
  checkAndConsumeGuestExtractQuota,
  checkFreeAccountImageQuota,
  FREE_PLAN_MAX_IMAGES,
  GUEST_EXTRACT_MAX_IMAGES,
  inspectGuestExtractStatus,
  isAdminTestEmail,
  markFreeAccountImageConsumed,
  verifySupabaseBearerUser,
} from './lib/planLimits.ts';
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
import { isValidMediaKey, readImageFromR2 } from './lib/r2Storage.ts';
import {
  extractCoreRequestParams,
  getSearchLinkCoreManifest,
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
  app.use(express.json({ limit: '64kb' }));

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

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      service: 'search-link-api',
      status: 'up',
    });
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

      const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
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
    '/api/map-image',
    express.json({ type: 'application/json', limit: '5mb' }),
    async (req, res) => {
      try {
        const authUser = await verifySupabaseBearerUser(req.headers);
        if (!authUser) {
          return res.status(401).json({
            error: 'Inicia sesión con Google para mapear imágenes con IA.',
          });
        }

        const body = (req.body ?? {}) as Record<string, unknown>;
        const key = typeof body.key === 'string' ? body.key : undefined;
        const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
        const dataBase64 =
          typeof body.dataBase64 === 'string' ? body.dataBase64 : undefined;
        const mimeType =
          typeof body.mimeType === 'string' ? body.mimeType : undefined;

        if (!imageUrl) {
          return res.status(400).json({
            error: 'Falta la URL de la imagen para mapear.',
          });
        }

        const trackingKey = key || imageUrl;
        const quota = await checkFreeAccountImageQuota(authUser, trackingKey);
        if (!quota.allowed) {
          return res.status(429).json({
            quotaExceeded: true,
            used: quota.used,
            limit: quota.limit,
            error: `Has alcanzado el límite de ${FREE_PLAN_MAX_IMAGES} imágenes del plan gratuito.`,
          });
        }

        const mapped = await mapStoredImageWithGemini({
          key,
          imageUrl,
          dataBase64,
          mimeType,
        });

        markFreeAccountImageConsumed(authUser, trackingKey);

        return res.json(mapped);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo mapear la imagen con IA.';
        return res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    '/api/jobs/map',
    express.json({ type: 'application/json', limit: '512kb' }),
    async (req, res) => {
      try {
        const authUser = await verifySupabaseBearerUser(req.headers);
        if (!authUser) {
          return res.status(401).json({
            error: 'Inicia sesión con Google para iniciar la cola de mapeo.',
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
            error: 'Faltan datos válidos del lote para iniciar la cola de mapeo.',
          });
        }

        const items: MappingQueueItemInput[] = [];
        for (const entry of rawItems) {
          if (!entry || typeof entry !== 'object') continue;
          const item = entry as Record<string, unknown>;
          const clientItemId =
            typeof item.clientItemId === 'string' ? item.clientItemId.trim() : '';
          const r2Key = typeof item.r2Key === 'string' ? item.r2Key.trim() : '';
          const imageUrl =
            typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
          if (!clientItemId || !r2Key || !imageUrl || !isValidMediaKey(r2Key)) {
            continue;
          }
          items.push({
            clientItemId,
            r2Key,
            imageUrl,
            originalUrl:
              typeof item.originalUrl === 'string' ? item.originalUrl.trim() : undefined,
            savedPercent:
              typeof item.savedPercent === 'number' && Number.isFinite(item.savedPercent)
                ? Math.max(0, Math.min(99, Math.trunc(item.savedPercent)))
                : 0,
            compressedBytes:
              typeof item.compressedBytes === 'number' &&
              Number.isFinite(item.compressedBytes)
                ? Math.max(0, Math.trunc(item.compressedBytes))
                : 0,
          });
        }

        if (items.length === 0) {
          return res.status(400).json({
            error: 'No hay imágenes válidas almacenadas en R2 para encolar.',
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

        const job = await createAndStartMappingJob({
          userId: authUser.userId,
          accessToken: authUser.accessToken,
          sourceType,
          sourceUrl,
          serviceSlug,
          keyPrefix,
          keyHash,
          items,
        });

        return res.status(202).json({ ok: true, job });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo iniciar la cola de mapeo.';
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

    const job = await getLatestMappingJobForUser(
      authUser.userId,
      authUser.accessToken,
    );
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

      const limitStatus = checkDailyLimit(
        req.headers,
        userId,
        req.socket?.remoteAddress,
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
    const result = await resolveSearchLinkCoreEndpoint(params);

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
