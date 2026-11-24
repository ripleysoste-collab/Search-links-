import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeAgencyServerDisconnect } from '../../lib/agencySync.ts';

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

  const result = await executeAgencyServerDisconnect(req.headers);

  if (!result.ok) {
    return sendJson(res, result.status, result);
  }

  return sendJson(res, 200, result);
}
