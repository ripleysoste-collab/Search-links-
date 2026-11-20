import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  checkFreeAccountImageQuota,
  FREE_PLAN_MAX_IMAGES,
  markFreeAccountImageConsumed,
  verifySupabaseBearerUser,
} from '../lib/planLimits.ts';
import {
  decodeBase64ImagePayload,
  getRequestOrigin,
  MAX_UPLOAD_BYTES,
  processAndStoreUploadedImage,
  sanitizeUploadFolderPrefix,
  type UploadFolderPrefix,
} from '../lib/uploadHandler.ts';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

const MAX_JSON_UPLOAD_BYTES = 6 * 1024 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readStreamBytes(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buf.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error('La imagen supera el límite máximo permitido de 4 MB.');
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

async function readUploadPayload(req: VercelLikeRequest): Promise<{
  buffer: Buffer;
  folder: UploadFolderPrefix;
}> {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const headerFolder =
    typeof req.headers['x-upload-folder'] === 'string'
      ? req.headers['x-upload-folder']
      : undefined;
  const queryFolder =
    typeof req.query?.folder === 'string' ? req.query.folder : undefined;

  if (contentType.includes('application/json')) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      const record = req.body as Record<string, unknown>;
      return {
        buffer: decodeBase64ImagePayload(record),
        folder: sanitizeUploadFolderPrefix(
          headerFolder || queryFolder || record.folder,
        ),
      };
    }

    const rawText =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : (await readStreamBytes(req, MAX_JSON_UPLOAD_BYTES)).toString('utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Payload JSON inválido al subir la imagen.');
    }
    const bodyFolder =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).folder
        : undefined;
    return {
      buffer: decodeBase64ImagePayload(parsed),
      folder: sanitizeUploadFolderPrefix(headerFolder || queryFolder || bodyFolder),
    };
  }

  if (contentType.startsWith('image/')) {
    const folder = sanitizeUploadFolderPrefix(headerFolder || queryFolder);
    if (Buffer.isBuffer(req.body)) {
      return { buffer: req.body, folder };
    }
    if (req.body instanceof Uint8Array) {
      return { buffer: Buffer.from(req.body), folder };
    }
    if (typeof req.body === 'string' && req.body.length > 0) {
      return { buffer: Buffer.from(req.body, 'binary'), folder };
    }
    return { buffer: await readStreamBytes(req, MAX_UPLOAD_BYTES), folder };
  }

  throw new Error('Tipo de contenido no válido. Envía una imagen.');
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Método no permitido. Usa POST.' });
  }

  try {
    const authUser = await verifySupabaseBearerUser(req.headers);
    if (!authUser) {
      return sendJson(res, 401, {
        error: 'Inicia sesión con Google para subir imágenes.',
      });
    }

    const { buffer, folder } = await readUploadPayload(req);
    if (folder === 'catalog') {
      const quota = await checkFreeAccountImageQuota(authUser);
      if (!quota.allowed) {
        return sendJson(res, 429, {
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

    return sendJson(res, 200, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'No se pudo guardar la imagen.';
    return sendJson(res, 400, { error: message });
  }
}
