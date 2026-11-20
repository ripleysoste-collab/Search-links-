import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getSearchLinkCoreManifest,
  SEARCH_LINK_CORE_VERSION,
} from '../../lib/supabaseServer.ts';
import { getRequestOrigin } from '../../lib/uploadHandler.ts';

function setCoreHeaders(res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, x-api-key, Content-Type',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Search-Link-Core', SEARCH_LINK_CORE_VERSION);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    setCoreHeaders(res);
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    setCoreHeaders(res);
    return res.end(JSON.stringify({ ok: false, error: 'Método no permitido. Usa GET.' }));
  }

  res.statusCode = 200;
  setCoreHeaders(res);
  return res.end(
    JSON.stringify(getSearchLinkCoreManifest(getRequestOrigin(req.headers)), null, 2),
  );
}
