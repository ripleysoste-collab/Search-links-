import type { IncomingMessage, ServerResponse } from 'node:http';
import { mapStoredImageWithGemini } from '../lib/geminiMapper.ts';
import {
  checkFreeAccountImageQuota,
  FREE_PLAN_MAX_IMAGES,
  markFreeAccountImageConsumed,
  verifySupabaseBearerUser,
} from '../lib/planLimits.ts';

interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelLikeRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
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
        error: 'Inicia sesión con Google para mapear imágenes con IA.',
      });
    }

    const body = await readJsonBody(req);
    const key = typeof body.key === 'string' ? body.key : undefined;
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
    const dataBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64 : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : undefined;

    if (!imageUrl) {
      return sendJson(res, 400, { error: 'Falta la URL de la imagen para mapear.' });
    }

    const trackingKey = key || imageUrl;
    const quota = await checkFreeAccountImageQuota(authUser, trackingKey);
    if (!quota.allowed) {
      return sendJson(res, 429, {
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

    return sendJson(res, 200, mapped);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'No se pudo mapear la imagen con IA.';
    return sendJson(res, 400, { error: message });
  }
}
