import type { IncomingMessage, ServerResponse } from 'node:http';
import { unfreezeAllUserApis } from '../../lib/accountActions.ts';
import { verifySupabaseBearerUser } from '../../lib/planLimits.ts';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, {
      ok: false,
      error: 'Método no permitido. Usa POST.',
    });
  }

  const authUser = await verifySupabaseBearerUser(req.headers);
  if (!authUser) {
    return sendJson(res, 401, {
      ok: false,
      error: 'No autorizado.',
    });
  }

  const result = await unfreezeAllUserApis(authUser);
  if (!result.ok) {
    return sendJson(res, result.status, { error: result.error });
  }

  return sendJson(res, 200, result);
}
