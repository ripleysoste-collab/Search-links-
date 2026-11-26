import type { IncomingMessage, ServerResponse } from 'node:http';
import { getUserQuotaSummary } from '../../lib/accountActions.ts';
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, {
      ok: false,
      error: 'Método no permitido. Usa GET.',
    });
  }

  const authUser = await verifySupabaseBearerUser(req.headers);
  if (!authUser) {
    return sendJson(res, 401, {
      ok: false,
      error: 'Inicia sesión para consultar tu cuota.',
    });
  }

  const summary = await getUserQuotaSummary(authUser);
  return sendJson(res, 200, summary);
}
