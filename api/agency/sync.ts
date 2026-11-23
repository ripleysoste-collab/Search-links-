import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  executeAgencyServerSync,
  type AgencySyncFallbackService,
} from '../../lib/agencySync.ts';

interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: VercelLikeRequest,
): Promise<Record<string, unknown>> {
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

export default async function handler(
  req: VercelLikeRequest,
  res: ServerResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, {
      ok: false,
      error: 'Método no permitido. Usa POST.',
    });
  }

  const body = await readJsonBody(req);
  const result = await executeAgencyServerSync(req.headers, {
    serverUrl: typeof body.serverUrl === 'string' ? body.serverUrl : '',
    serviceScope: typeof body.serviceScope === 'string' ? body.serviceScope : '',
    secretKey: typeof body.secretKey === 'string' ? body.secretKey : '',
    servicesFallback: Array.isArray(body.servicesFallback)
      ? (body.servicesFallback as AgencySyncFallbackService[])
      : undefined,
  });

  if (!result.ok) {
    return sendJson(res, result.status, result);
  }

  return sendJson(res, 200, result);
}
