import type { IncomingMessage, ServerResponse } from 'node:http';
import { isValidMediaKey, readImageFromR2 } from '../lib/r2Storage.ts';

interface VercelLikeRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const queryParam = req.query?.k;
  let key = Array.isArray(queryParam) ? queryParam[0] : queryParam;

  if (!key && req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      key = parsed.searchParams.get('k') ?? undefined;
    } catch {
      key = undefined;
    }
  }

  if (!key || !isValidMediaKey(key)) {
    res.statusCode = 400;
    res.end('Invalid media key');
    return;
  }

  try {
    const { buffer, contentType, etag } = await readImageFromR2(key);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (etag) {
      res.setHeader('ETag', etag);
    }
    res.end(buffer);
  } catch {
    res.statusCode = 404;
    res.end('Media not found');
  }
}
