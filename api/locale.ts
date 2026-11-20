import type { IncomingMessage, ServerResponse } from 'node:http';
import { detectLocaleFromRequest } from '../lib/localeDetection.ts';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const detected = await detectLocaleFromRequest(
      req.headers,
      req.socket?.remoteAddress,
    );
    return sendJson(res, 200, {
      ok: true,
      ...detected,
    });
  } catch {
    return sendJson(res, 200, {
      ok: true,
      locale: 'es',
      countryCode: null,
      source: 'default',
    });
  }
}
