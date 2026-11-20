import { safeFetch } from './urlSafety.ts';

const MAX_PROXY_BYTES = 12 * 1024 * 1024;

export interface ProxiedImagePayload {
  contentType: string;
  buffer: Buffer;
}

export async function fetchProxiedImage(
  rawImageUrl: string,
  rawReferer?: string,
): Promise<ProxiedImagePayload> {
  let safeReferer: string | undefined;
  if (rawReferer) {
    try {
      const refParsed = new URL(rawReferer);
      if (refParsed.protocol === 'http:' || refParsed.protocol === 'https:') {
        safeReferer = refParsed.href;
      }
    } catch {
      safeReferer = undefined;
    }
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  };
  if (safeReferer) {
    headers.Referer = safeReferer;
  }

  let { response } = await safeFetch(rawImageUrl, {
    headers,
    timeoutMs: 9000,
  });

  if ((response.status === 403 || response.status === 401) && headers.Referer) {
    await response.body?.cancel().catch(() => {});
    const retryHeaders = { ...headers };
    delete retryHeaders.Referer;
    ({ response } = await safeFetch(rawImageUrl, {
      headers: retryHeaders,
      timeoutMs: 9000,
    }));
  }

  if (!response.ok) {
    throw new Error(`No se pudo cargar la imagen (${response.status}).`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/') || contentType.includes('svg')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('El recurso no es una imagen válida.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Respuesta de imagen vacía.');
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.byteLength;
    if (total > MAX_PROXY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error('La imagen supera el tamaño máximo permitido.');
    }
    chunks.push(value);
  }

  return {
    contentType: contentType.split(';')[0] || 'image/jpeg',
    buffer: Buffer.concat(chunks),
  };
}
