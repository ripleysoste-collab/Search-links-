import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchProxiedImage } from '../lib/imageProxy.ts';

interface VercelLikeRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const rawImageUrl =
    (typeof req.query?.url === 'string' ? req.query.url : requestUrl.searchParams.get('url')) ||
    '';
  const rawReferer =
    (typeof req.query?.ref === 'string' ? req.query.ref : requestUrl.searchParams.get('ref')) ||
    undefined;

  if (!rawImageUrl) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }

  try {
    const { contentType, buffer } = await fetchProxiedImage(rawImageUrl, rawReferer);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  } catch {
    res.statusCode = 502;
    res.end('Image fetch failed');
  }
}
