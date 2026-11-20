import {
  buildSafeObjectKey,
  getMissingR2EnvNames,
  isR2Configured,
  uploadImageToR2,
} from './r2Storage.ts';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadFolderPrefix = 'catalog' | 'org-logos';

export function sanitizeUploadFolderPrefix(raw: unknown): UploadFolderPrefix {
  return raw === 'org-logos' ? 'org-logos' : 'catalog';
}

interface DetectedImageFormat {
  extension: string;
  contentType: string;
}

export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
  if (buffer.byteLength < 12) return null;

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }

  // GIF: GIF87a or GIF89a
  const gifSig = buffer.subarray(0, 6).toString('ascii');
  if (gifSig === 'GIF87a' || gifSig === 'GIF89a') {
    return { extension: 'gif', contentType: 'image/gif' };
  }

  // AVIF / HEIF ISOBMFF box
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (brand === 'avif' || brand === 'avis') {
      return { extension: 'avif', contentType: 'image/avif' };
    }
  }

  return null;
}

export interface ImageUploadResponse {
  key: string;
  url: string;
  sizeBytes: number;
  contentType: string;
}

export function getRequestOrigin(headers: {
  host?: string | string[];
  'x-forwarded-host'?: string | string[];
  'x-forwarded-proto'?: string | string[];
}): string | undefined {
  const rawHost = headers['x-forwarded-host'] || headers.host;
  const hostValue = (Array.isArray(rawHost) ? rawHost[0] : rawHost || '')
    .split(',')[0]
    .trim();

  if (!hostValue || /[\s/\\]/.test(hostValue)) {
    return undefined;
  }

  const rawProto = headers['x-forwarded-proto'];
  const protoCandidate = (
    Array.isArray(rawProto) ? rawProto[0] : rawProto || ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase();

  const isLocal =
    hostValue.startsWith('localhost') || hostValue.startsWith('127.0.0.1');
  const proto =
    protoCandidate === 'http' || protoCandidate === 'https'
      ? protoCandidate
      : isLocal
        ? 'http'
        : 'https';

  return `${proto}://${hostValue}`;
}

export function decodeBase64ImagePayload(rawPayload: unknown): Buffer {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Formato de carga inválido.');
  }

  const record = rawPayload as Record<string, unknown>;
  const rawBase64 =
    typeof record.dataBase64 === 'string'
      ? record.dataBase64
      : typeof record.base64 === 'string'
        ? record.base64
        : '';

  const trimmed = rawBase64.trim();
  if (!trimmed) {
    throw new Error('La imagen enviada está vacía.');
  }

  const commaIndex = trimmed.indexOf(',');
  const base64Body =
    trimmed.startsWith('data:') && commaIndex !== -1
      ? trimmed.slice(commaIndex + 1)
      : trimmed;

  const buffer = Buffer.from(base64Body, 'base64');
  if (buffer.byteLength === 0) {
    throw new Error('No se pudo decodificar la imagen.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('La imagen supera el límite máximo permitido de 4 MB.');
  }
  return buffer;
}

export async function processAndStoreUploadedImage(
  buffer: Buffer,
  requestOrigin?: string,
  prefix: UploadFolderPrefix = 'catalog',
): Promise<ImageUploadResponse> {
  if (!isR2Configured()) {
    const missing = getMissingR2EnvNames();
    throw new Error(
      `Faltan variables en Vercel (${missing.join(', ')}). Activa Production + Preview y haz Redeploy sin usar caché.`,
    );
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new Error('El archivo de imagen está vacío.');
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('La imagen supera el límite máximo permitido de 4 MB.');
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('El archivo no corresponde a un formato de imagen válido.');
  }

  const key = buildSafeObjectKey({
    prefix: sanitizeUploadFolderPrefix(prefix),
    extension: detected.extension,
  });

  try {
    const stored = await uploadImageToR2({
      key,
      body: buffer,
      contentType: detected.contentType,
      requestOrigin,
    });

    return {
      key: stored.key,
      url: stored.url,
      sizeBytes: stored.sizeBytes,
      contentType: detected.contentType,
    };
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    const errMessage = err instanceof Error ? err.message : 'Error de conexión';
    throw new Error(
      `No se pudo guardar en R2 (${errName || 'S3Error'}: ${errMessage.slice(0, 120)})`,
    );
  }
}
