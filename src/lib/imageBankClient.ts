import { resolveApiUrl } from './apiConfig';

export type ImageBankProvider = 'pixabay' | 'pexels';

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
  translatedQuery: string;
  providers: ImageBankProvider[];
  items: ImageBankImageItem[];
}

export class ImageBankClientError extends Error {
  readonly notConfigured?: boolean;
  readonly status: number;

  constructor(
    message: string,
    options?: { notConfigured?: boolean; status?: number },
  ) {
    super(message);
    this.name = 'ImageBankClientError';
    this.notConfigured = options?.notConfigured;
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
      translatedQuery: '',
      providers: [],
      items: [],
    };
  }

  const endpoint = resolveApiUrl(
    `/api/image-bank/search?q=${encodeURIComponent(clean)}`,
  );

  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    notConfigured?: boolean;
    query?: string;
    translatedQuery?: string;
    providers?: ImageBankProvider[];
    items?: ImageBankImageItem[];
  };

  if (!response.ok) {
    throw new ImageBankClientError(
      payload?.error || 'Failed to search image bank',
      {
        notConfigured: Boolean(payload?.notConfigured),
        status: response.status,
      },
    );
  }

  return {
    query: payload.query || clean,
    translatedQuery: payload.translatedQuery || clean,
    providers: Array.isArray(payload.providers) ? payload.providers : [],
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}
