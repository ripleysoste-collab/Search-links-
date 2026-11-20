import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  extractCoreRequestParams,
  resolveSearchLinkCoreEndpoint,
  SEARCH_LINK_CORE_NAME,
  SEARCH_LINK_CORE_VERSION,
} from '../../../lib/supabaseServer.ts';

interface VercelSlugRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

function setCoreHeaders(res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, x-api-key, Content-Type',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Search-Link-Core', SEARCH_LINK_CORE_VERSION);
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  setCoreHeaders(res);
  res.end(JSON.stringify(payload, null, 2));
}

function extractSlug(req: VercelSlugRequest): string {
  const fromQuery = req.query?.slug;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }
  if (Array.isArray(fromQuery) && fromQuery[0]?.trim()) {
    return fromQuery[0].trim();
  }
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const segments = parsed.pathname.split('/').filter(Boolean);
    return (segments[segments.length - 1] || '').trim();
  } catch {
    return '';
  }
}

export default async function handler(
  req: VercelSlugRequest,
  res: ServerResponse,
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    setCoreHeaders(res);
    return res.end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, {
      ok: false,
      system: SEARCH_LINK_CORE_NAME,
      error: 'Método no permitido. Usa GET.',
    });
  }

  const slug = extractSlug(req);
  const params = extractCoreRequestParams(req.url, req.headers, slug);
  const result = await resolveSearchLinkCoreEndpoint(params);

  if (!result.ok) {
    return sendJson(res, result.status, {
      ok: false,
      system: SEARCH_LINK_CORE_NAME,
      version: SEARCH_LINK_CORE_VERSION,
      error: result.error,
    });
  }

  return sendJson(res, 200, {
    ok: true,
    ...result.data,
  });
}
