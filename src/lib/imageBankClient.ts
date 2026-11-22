import { resolveApiUrl } from './apiConfig';
import { getSupabaseAccessToken } from './supabaseClient';

export type ImageBankProvider = 'pixabay' | 'pexels' | 'flux';

export interface ImageBankImageItem {
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

export interface ImageBankSearchResponse {
  query: string;
  providers: ImageBankProvider[];
  items: ImageBankImageItem[];
  cooldownSeconds?: number;
}

export class ImageBankClientError extends Error {
  readonly notConfigured?: boolean;
  readonly rateLimited?: boolean;
  readonly plusRequired?: boolean;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(
    message: string,
    options?: {
      notConfigured?: boolean;
      rateLimited?: boolean;
      plusRequired?: boolean;
      retryAfterSeconds?: number;
      status?: number;
    },
  ) {
    super(message);
    this.name = 'ImageBankClientError';
    this.notConfigured = options?.notConfigured;
    this.rateLimited = options?.rateLimited;
    this.plusRequired = options?.plusRequired;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.status = options?.status ?? 500;
  }
}

const SAVED_IMAGES_STORAGE_KEY = 'sl_image_bank_saved_v1';

export function loadSavedImageBankItems(): ImageBankImageItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_IMAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ImageBankImageItem =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as ImageBankImageItem).id === 'string' &&
        typeof (entry as ImageBankImageItem).previewUrl === 'string' &&
        typeof (entry as ImageBankImageItem).fullUrl === 'string',
    );
  } catch {
    return [];
  }
}

export function saveImageBankItems(items: ImageBankImageItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_IMAGES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export async function searchImageBank(
  query: string,
  signal?: AbortSignal,
): Promise<ImageBankSearchResponse> {
  const clean = query.trim();
  if (!clean) {
    return {
      query: '',
      providers: [],
      items: [],
    };
  }

  const endpoint = resolveApiUrl(
    `/api/image-bank/search?q=${encodeURIComponent(clean)}`,
  );

  const token = await getSupabaseAccessToken().catch(() => null);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers,
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    notConfigured?: boolean;
    rateLimited?: boolean;
    retryAfterSeconds?: number;
    cooldownSeconds?: number;
    query?: string;
    providers?: ImageBankProvider[];
    items?: ImageBankImageItem[];
  };

  if (!response.ok) {
    throw new ImageBankClientError(
      payload?.error || 'Failed to search image bank',
      {
        notConfigured: Boolean(payload?.notConfigured),
        rateLimited: Boolean(payload?.rateLimited) || response.status === 429,
        retryAfterSeconds:
          typeof payload?.retryAfterSeconds === 'number'
            ? payload.retryAfterSeconds
            : undefined,
        status: response.status,
      },
    );
  }

  return {
    query: payload.query || clean,
    providers: Array.isArray(payload.providers) ? payload.providers : [],
    items: Array.isArray(payload.items) ? payload.items : [],
    cooldownSeconds:
      typeof payload.cooldownSeconds === 'number'
        ? payload.cooldownSeconds
        : undefined,
  };
}

export async function fetchImageBankPlusAccess(): Promise<boolean> {
  const token = await getSupabaseAccessToken().catch(() => null);
  if (!token) return false;

  const response = await fetch(resolveApiUrl('/api/image-bank/access'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return false;
  const payload = (await response.json().catch(() => ({}))) as {
    hasPlusAccess?: boolean;
  };
  return Boolean(payload?.hasPlusAccess);
}

export async function generateAiImageFromPrompt(
  prompt: string,
  signal?: AbortSignal,
): Promise<ImageBankImageItem> {
  const clean = prompt.trim();
  if (!clean) {
    throw new ImageBankClientError('Prompt is required.', { status: 400 });
  }

  const token = await getSupabaseAccessToken().catch(() => null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolveApiUrl('/api/image-bank/generate'), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: JSON.stringify({ prompt: clean }),
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    plusRequired?: boolean;
    notConfigured?: boolean;
    item?: ImageBankImageItem;
  };

  if (!response.ok || !payload?.item) {
    throw new ImageBankClientError(
      payload?.error || 'Failed to generate AI image',
      {
        plusRequired: Boolean(payload?.plusRequired) || response.status === 403,
        notConfigured: Boolean(payload?.notConfigured),
        status: response.status,
      },
    );
  }

  return payload.item;
}
