import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { getClientIp, isAdminTestEmail, parseCookies } from './planLimits.ts';

export type ImageBankProvider = 'pixabay' | 'pexels' | 'flux';

export const IMAGE_BANK_COOLDOWN_MS = 3 * 60 * 1000;
export const IMAGE_BANK_COOKIE_NAME = 'sl_img_bank_cd';
export const CLOUDFLARE_FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export interface ImageBankSearchItem {
  id: string;
  provider: ImageBankProvider;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  authorUrl: string;
  sourcePageUrl: string;
}

export interface ImageBankSearchResult {
  query: string;
  providers: ImageBankProvider[];
  items: ImageBankSearchItem[];
}

export class ImageBankConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageBankConfigError';
  }
}

export class ImageBankUpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ImageBankUpstreamError';
    this.status = status;
  }
}

function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^["']|["']$/g, '').trim();
}

function isUsableKey(key: string): boolean {
  return Boolean(key && !/^TU_/i.test(key) && !/^YOUR_/i.test(key));
}

function getCloudflareAccountId(): string {
  return (
    cleanEnv(process.env.CLOUDFLARE_ACCOUNT_ID) ||
    cleanEnv(process.env.R2_ACCOUNT_ID)
  );
}

function getCloudflareWorkersAiToken(): string {
  return cleanEnv(process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN);
}

export function isCloudflareFluxConfigured(): boolean {
  return (
    isUsableKey(getCloudflareAccountId()) &&
    isUsableKey(getCloudflareWorkersAiToken())
  );
}

export function hasImageBankPlusAccess(
  email?: string | null,
  appMetadata?: Record<string, unknown> | null,
): boolean {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail && isAdminTestEmail(cleanEmail)) {
    return true;
  }

  const extraPlusEmails = cleanEnv(process.env.PLUS_PLAN_EMAILS)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (cleanEmail && extraPlusEmails.includes(cleanEmail)) {
    return true;
  }

  const plan =
    typeof appMetadata?.plan === 'string'
      ? appMetadata.plan.trim().toLowerCase()
      : '';
  const tier =
    typeof appMetadata?.tier === 'string'
      ? appMetadata.tier.trim().toLowerCase()
      : '';
  return plan === 'plus' || plan === 'pro' || tier === 'plus' || tier === 'pro';
}

export function getImageBankConfigStatus(): {
  pixabay: boolean;
  pexels: boolean;
  flux: boolean;
} {
  return {
    pixabay: isUsableKey(cleanEnv(process.env.PIXABAY_API_KEY)),
    pexels: isUsableKey(cleanEnv(process.env.PEXELS_API_KEY)),
    flux: isCloudflareFluxConfigured(),
  };
}

function normalizeSearchPhrase(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

/* ------------------------------------------------------------------ */
/*  3-minute anti-saturation cooldown (memory + signed HttpOnly cookie) */
/* ------------------------------------------------------------------ */

const cooldownMemory = new Map<string, number>();

function getCooldownSecret(): string {
  return (
    cleanEnv(process.env.QUOTA_SIGNING_SECRET) ||
    cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    cleanEnv(process.env.GEMINI_API_KEY) ||
    'searchlink_quota_guard_secret_v1'
  );
}

interface CooldownCookiePayload {
  lastAt: number;
}

function signCooldownPayload(payload: CooldownCookiePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = crypto
    .createHmac('sha256', getCooldownSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyCooldownPayload(raw: string | undefined): CooldownCookiePayload | null {
  if (!raw) return null;
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getCooldownSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as CooldownCookiePayload;
    if (
      typeof parsed?.lastAt === 'number' &&
      Number.isFinite(parsed.lastAt) &&
      parsed.lastAt > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getCooldownScopeKey(
  headers: IncomingHttpHeaders,
  userId?: string,
  remoteAddress?: string,
): string {
  if (userId && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  return `ip:${getClientIp(headers, remoteAddress)}`;
}

function pruneStaleCooldowns(now: number): void {
  if (cooldownMemory.size < 3000) return;
  for (const [key, ts] of cooldownMemory.entries()) {
    if (now - ts >= IMAGE_BANK_COOLDOWN_MS) {
      cooldownMemory.delete(key);
    }
  }
}

export function checkImageBankCooldown(
  headers: IncomingHttpHeaders,
  userId?: string,
  remoteAddress?: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const scopeKey = getCooldownScopeKey(headers, userId, remoteAddress);
  const memLastAt = cooldownMemory.get(scopeKey) ?? 0;

  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookiePayload = verifyCooldownPayload(cookies[IMAGE_BANK_COOKIE_NAME]);
  const cookieLastAt = cookiePayload?.lastAt ?? 0;

  const lastAt = Math.max(memLastAt, cookieLastAt);
  if (lastAt > 0) {
    const elapsed = now - lastAt;
    if (elapsed >= 0 && elapsed < IMAGE_BANK_COOLDOWN_MS) {
      const remainingMs = IMAGE_BANK_COOLDOWN_MS - elapsed;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function consumeImageBankCooldown(
  headers: IncomingHttpHeaders,
  userId?: string,
  remoteAddress?: string,
): { cookieHeader: string; cooldownSeconds: number } {
  const now = Date.now();
  pruneStaleCooldowns(now);
  const scopeKey = getCooldownScopeKey(headers, userId, remoteAddress);
  cooldownMemory.set(scopeKey, now);

  const signedValue = signCooldownPayload({ lastAt: now });
  const proto =
    typeof headers['x-forwarded-proto'] === 'string'
      ? headers['x-forwarded-proto']
      : '';
  const origin = typeof headers.origin === 'string' ? headers.origin : '';
  const isHttps =
    proto.toLowerCase().includes('https') ||
    origin.toLowerCase().startsWith('https://');
  const cookieAttrs = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
  const maxAgeSec = Math.ceil(IMAGE_BANK_COOLDOWN_MS / 1000);

  return {
    cookieHeader: `${IMAGE_BANK_COOKIE_NAME}=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=${maxAgeSec}`,
    cooldownSeconds: maxAgeSec,
  };
}

/* ------------------------------------------------------------------ */
/*  Direct public image bank queries (no AI translation overhead)      */
/* ------------------------------------------------------------------ */

interface PixabayHit {
  id: number;
  pageURL?: string;
  tags?: string;
  previewURL?: string;
  webformatURL?: string;
  webformatWidth?: number;
  webformatHeight?: number;
  largeImageURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  user_id?: number;
  user?: string;
}

async function searchPixabayImages(
  searchQuery: string,
  perPage = 24,
): Promise<ImageBankSearchItem[]> {
  const apiKey = cleanEnv(process.env.PIXABAY_API_KEY);
  if (!isUsableKey(apiKey)) return [];

  const endpoint = new URL('https://pixabay.com/api/');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('q', searchQuery);
  endpoint.searchParams.set('image_type', 'photo');
  endpoint.searchParams.set('safesearch', 'true');
  endpoint.searchParams.set('per_page', String(perPage));

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new ImageBankUpstreamError(
      `Pixabay API responded with status ${response.status}`,
      response.status === 429 ? 429 : 502,
    );
  }

  const payload = (await response.json()) as { hits?: PixabayHit[] };
  const hits = Array.isArray(payload?.hits) ? payload.hits : [];

  const items: ImageBankSearchItem[] = [];
  for (const hit of hits) {
    const previewUrl = (hit.webformatURL || hit.previewURL || '').trim();
    const fullUrl = (hit.largeImageURL || hit.webformatURL || '').trim();
    if (!previewUrl || !fullUrl) continue;

    const author = (hit.user || 'Pixabay').trim();
    const authorUrl =
      hit.user && hit.user_id
        ? `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`
        : 'https://pixabay.com';

    items.push({
      id: `pixabay-${hit.id}`,
      provider: 'pixabay',
      previewUrl,
      fullUrl,
      width: Number(hit.webformatWidth || hit.imageWidth) || 640,
      height: Number(hit.webformatHeight || hit.imageHeight) || 480,
      alt: (hit.tags || searchQuery).trim(),
      author,
      authorUrl,
      sourcePageUrl: (hit.pageURL || 'https://pixabay.com').trim(),
    });
  }
  return items;
}

interface PexelsPhoto {
  id: number;
  width?: number;
  height?: number;
  url?: string;
  photographer?: string;
  photographer_url?: string;
  alt?: string;
  src?: {
    medium?: string;
    large?: string;
    large2x?: string;
    original?: string;
  };
}

async function searchPexelsImages(
  searchQuery: string,
  perPage = 24,
): Promise<ImageBankSearchItem[]> {
  const apiKey = cleanEnv(process.env.PEXELS_API_KEY);
  if (!isUsableKey(apiKey)) return [];

  const endpoint = new URL('https://api.pexels.com/v1/search');
  endpoint.searchParams.set('query', searchQuery);
  endpoint.searchParams.set('per_page', String(perPage));

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new ImageBankUpstreamError(
      `Pexels API responded with status ${response.status}`,
      response.status === 429 ? 429 : 502,
    );
  }

  const payload = (await response.json()) as { photos?: PexelsPhoto[] };
  const photos = Array.isArray(payload?.photos) ? payload.photos : [];

  const items: ImageBankSearchItem[] = [];
  for (const photo of photos) {
    const previewUrl = (
      photo.src?.medium ||
      photo.src?.large ||
      photo.src?.original ||
      ''
    ).trim();
    const fullUrl = (
      photo.src?.large2x ||
      photo.src?.large ||
      photo.src?.original ||
      ''
    ).trim();
    if (!previewUrl || !fullUrl) continue;

    items.push({
      id: `pexels-${photo.id}`,
      provider: 'pexels',
      previewUrl,
      fullUrl,
      width: Number(photo.width) || 640,
      height: Number(photo.height) || 480,
      alt: (photo.alt || searchQuery).trim(),
      author: (photo.photographer || 'Pexels').trim(),
      authorUrl: (photo.photographer_url || 'https://www.pexels.com').trim(),
      sourcePageUrl: (photo.url || 'https://www.pexels.com').trim(),
    });
  }
  return items;
}

function interleaveResults(
  primary: ImageBankSearchItem[],
  secondary: ImageBankSearchItem[],
): ImageBankSearchItem[] {
  if (secondary.length === 0) return primary;
  if (primary.length === 0) return secondary;
  const merged: ImageBankSearchItem[] = [];
  const maxLen = Math.max(primary.length, secondary.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (i < primary.length) merged.push(primary[i]);
    if (i < secondary.length) merged.push(secondary[i]);
  }
  return merged;
}

export async function searchPublicImageBank(
  rawQuery: string,
): Promise<ImageBankSearchResult> {
  const query = normalizeSearchPhrase(rawQuery);
  if (!query) {
    return {
      query: '',
      providers: [],
      items: [],
    };
  }

  const status = getImageBankConfigStatus();
  if (!status.pixabay && !status.pexels) {
    throw new ImageBankConfigError(
      'Image bank API key is not configured on the server.',
    );
  }

  const perPage = status.pixabay && status.pexels ? 15 : 24;

  const tasks: Array<
    Promise<{ provider: ImageBankProvider; items: ImageBankSearchItem[] }>
  > = [];

  if (status.pixabay) {
    tasks.push(
      searchPixabayImages(query, perPage).then((items) => ({
        provider: 'pixabay' as const,
        items,
      })),
    );
  }
  if (status.pexels) {
    tasks.push(
      searchPexelsImages(query, perPage).then((items) => ({
        provider: 'pexels' as const,
        items,
      })),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const successful = settled
    .filter(
      (
        res,
      ): res is PromiseFulfilledResult<{
        provider: ImageBankProvider;
        items: ImageBankSearchItem[];
      }> => res.status === 'fulfilled',
    )
    .map((res) => res.value);

  if (successful.length === 0) {
    const firstRejected = settled.find(
      (res): res is PromiseRejectedResult => res.status === 'rejected',
    );
    if (firstRejected?.reason instanceof Error) {
      throw firstRejected.reason;
    }
    throw new ImageBankUpstreamError('Failed to query public image bank.');
  }

  const pixabayItems =
    successful.find((s) => s.provider === 'pixabay')?.items ?? [];
  const pexelsItems =
    successful.find((s) => s.provider === 'pexels')?.items ?? [];

  return {
    query,
    providers: successful.map((s) => s.provider),
    items: interleaveResults(pixabayItems, pexelsItems),
  };
}

interface CloudflareFluxJsonResponse {
  success?: boolean;
  result?: {
    image?: string;
  };
  errors?: Array<{ message?: string }>;
}

export async function generateFluxImageWithCloudflare(
  rawPrompt: string,
): Promise<ImageBankSearchItem> {
  const prompt = normalizeSearchPhrase(rawPrompt);
  if (!prompt) {
    throw new ImageBankUpstreamError('Prompt is required to generate an image.', 400);
  }

  const accountId = getCloudflareAccountId();
  const token = getCloudflareWorkersAiToken();
  if (!isUsableKey(accountId) || !isUsableKey(token)) {
    throw new ImageBankConfigError(
      'Cloudflare Workers AI credentials are not configured on the server.',
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_FLUX_MODEL}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 2048),
      steps: 4,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    let errorDetail = `Cloudflare AI error (${response.status})`;
    try {
      const errJson = (await response.json()) as CloudflareFluxJsonResponse;
      const msg = errJson?.errors?.[0]?.message;
      if (msg) errorDetail = msg;
    } catch {
      // Ignore parse error
    }
    throw new ImageBankUpstreamError(errorDetail, response.status >= 500 ? 502 : response.status);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let dataUrl = '';

  if (contentType.startsWith('image/')) {
    const mime = contentType.split(';')[0].trim() || 'image/jpeg';
    const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
    if (base64) {
      dataUrl = `data:${mime};base64,${base64}`;
    }
  } else {
    const payload = (await response.json()) as CloudflareFluxJsonResponse;
    if (payload.success === false) {
      const msg = payload?.errors?.[0]?.message || 'Cloudflare Workers AI rejected the request.';
      throw new ImageBankUpstreamError(msg, 502);
    }
    const rawBase64 = typeof payload?.result?.image === 'string' ? payload.result.image.trim() : '';
    if (rawBase64) {
      dataUrl = rawBase64.startsWith('data:')
        ? rawBase64
        : `data:image/jpeg;base64,${rawBase64}`;
    }
  }

  if (!dataUrl) {
    throw new ImageBankUpstreamError('Cloudflare Workers AI returned an empty image.', 502);
  }

  return {
    id: `flux-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    provider: 'flux',
    previewUrl: dataUrl,
    fullUrl: dataUrl,
    width: 1024,
    height: 1024,
    alt: prompt,
    author: 'Flux.1 Schnell',
    authorUrl: 'https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/',
    sourcePageUrl: '',
  };
}

