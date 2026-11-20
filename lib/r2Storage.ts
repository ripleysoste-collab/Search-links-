import crypto from 'node:crypto';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ALLOWED_KEY_REGEX =
  /^[a-z0-9][a-z0-9/_-]{2,180}\.(webp|jpe?g|png|gif|avif)$/i;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
};

let cachedClient: S3Client | null = null;
let cachedSignature = '';

function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^["']|["']$/g, '').trim();
}

function getR2Env() {
  const endpoint = cleanEnv(process.env.R2_ENDPOINT).replace(/\/+$/, '');
  const accessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName = cleanEnv(process.env.R2_BUCKET_NAME) || 'searchlink-media';
  const publicBaseUrl = cleanEnv(process.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, '');

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
  };
}

export function isR2Configured(): boolean {
  const { endpoint, accessKeyId, secretAccessKey, bucketName } = getR2Env();
  return Boolean(endpoint && accessKeyId && secretAccessKey && bucketName);
}

export function getMissingR2EnvNames(): string[] {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Env();
  const missing: string[] = [];
  if (!endpoint) missing.push('R2_ENDPOINT');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  return missing;
}

export function getR2BucketName(): string {
  return getR2Env().bucketName;
}

export function getR2Client(): S3Client {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Env();
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('El almacenamiento multimedia en la nube no está configurado.');
  }

  const signature = `${endpoint}:${accessKeyId}`;
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    cachedSignature = signature;
  }

  return cachedClient;
}

export function isValidMediaKey(key: string): boolean {
  if (!key || key.includes('..') || key.includes('//')) return false;
  return ALLOWED_KEY_REGEX.test(key);
}

export function buildSafeObjectKey(options?: {
  prefix?: string;
  extension?: string;
}): string {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const rawPrefix = (options?.prefix || 'uploads')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32) || 'uploads';

  const rawExt = (options?.extension || 'webp')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const safeExt = rawExt in EXTENSION_CONTENT_TYPES ? rawExt : 'webp';

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${rawPrefix}/${yearMonth}/${id}.${safeExt}`;
}

export function resolveMediaUrl(key: string, requestOrigin?: string): string {
  const { publicBaseUrl } = getR2Env();
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key}`;
  }
  const relativePath = `/api/media?k=${encodeURIComponent(key)}`;
  const cleanOrigin = (requestOrigin || process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (cleanOrigin && /^https?:\/\//i.test(cleanOrigin)) {
    return `${cleanOrigin}${relativePath}`;
  }
  return relativePath;
}

export interface UploadImageToR2Input {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
  requestOrigin?: string;
}

export interface UploadImageToR2Result {
  key: string;
  url: string;
  sizeBytes: number;
}

export async function uploadImageToR2(
  input: UploadImageToR2Input,
): Promise<UploadImageToR2Result> {
  if (!isValidMediaKey(input.key)) {
    throw new Error('Ruta de archivo no válida para almacenamiento.');
  }
  if (!input.contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Solo se permite subir archivos de imagen.');
  }

  const client = getR2Client();
  const bucketName = getR2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl:
        input.cacheControl || 'public, max-age=31536000, immutable',
    }),
  );

  return {
    key: input.key,
    url: resolveMediaUrl(input.key, input.requestOrigin),
    sizeBytes: input.body.byteLength,
  };
}

export interface StoredR2Image {
  buffer: Buffer;
  contentType: string;
  etag?: string;
}

export async function readImageFromR2(key: string): Promise<StoredR2Image> {
  if (!isValidMediaKey(key)) {
    throw new Error('Clave de archivo no válida.');
  }

  const client = getR2Client();
  const bucketName = getR2BucketName();

  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error('Archivo no encontrado.');
  }

  const bytes = await result.Body.transformToByteArray();
  const ext = key.split('.').pop()?.toLowerCase() || 'webp';
  const fallbackType = EXTENSION_CONTENT_TYPES[ext] || 'image/webp';
  const rawType = (result.ContentType || fallbackType).toLowerCase();
  const contentType = rawType.startsWith('image/') ? rawType : fallbackType;

  return {
    buffer: Buffer.from(bytes),
    contentType,
    etag: result.ETag,
  };
}
