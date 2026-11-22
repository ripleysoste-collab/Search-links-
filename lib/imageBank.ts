import { GoogleGenAI } from '@google/genai';

export type ImageBankProvider = 'pixabay' | 'pexels';

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
  translatedQuery: string;
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

export function getImageBankConfigStatus(): {
  pixabay: boolean;
  pexels: boolean;
} {
  return {
    pixabay: isUsableKey(cleanEnv(process.env.PIXABAY_API_KEY)),
    pexels: isUsableKey(cleanEnv(process.env.PEXELS_API_KEY)),
  };
}

function normalizeSearchPhrase(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function cleanTranslatedOutput(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(translation|english|keywords)\s*:\s*/i, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[.;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > 100) {
    return fallback;
  }
  return cleaned;
}

/**
 * Lightweight translation to English so public image banks return richer, higher-recall results.
 * Uses fast Groq 8B if available, falling back to Gemini Flash-Lite, and safely falls back to original query.
 */
export async function translateImageQueryToEnglish(
  rawQuery: string,
): Promise<string> {
  const normalized = normalizeSearchPhrase(rawQuery);
  if (!normalized) return '';

  const systemPrompt =
    'Translate the user image search phrase into concise English search keywords (1 to 5 words). Reply ONLY with the English keywords, no quotes, no punctuation, no explanation.';

  const groqKey = cleanEnv(process.env.GROQ_API_KEY);
  if (isUsableKey(groqKey)) {
    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            temperature: 0,
            max_tokens: 24,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: normalized },
            ],
          }),
          signal: AbortSignal.timeout(3500),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          return cleanTranslatedOutput(content, normalized);
        }
      }
    } catch {
      // Fall through to Gemini or original query
    }
  }

  const geminiKey = cleanEnv(process.env.GEMINI_API_KEY);
  if (isUsableKey(geminiKey)) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `${systemPrompt}\n\nPhrase: ${normalized}`,
        config: {
          temperature: 0,
          maxOutputTokens: 24,
        },
      });
      const text = result.text;
      if (typeof text === 'string' && text.trim()) {
        return cleanTranslatedOutput(text, normalized);
      }
    } catch {
      // Fall back safely to original query
    }
  }

  return normalized;
}

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
  englishQuery: string,
  perPage = 24,
): Promise<ImageBankSearchItem[]> {
  const apiKey = cleanEnv(process.env.PIXABAY_API_KEY);
  if (!isUsableKey(apiKey)) return [];

  const endpoint = new URL('https://pixabay.com/api/');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('q', englishQuery);
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
      alt: (hit.tags || englishQuery).trim(),
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
  englishQuery: string,
  perPage = 24,
): Promise<ImageBankSearchItem[]> {
  const apiKey = cleanEnv(process.env.PEXELS_API_KEY);
  if (!isUsableKey(apiKey)) return [];

  const endpoint = new URL('https://api.pexels.com/v1/search');
  endpoint.searchParams.set('query', englishQuery);
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
      alt: (photo.alt || englishQuery).trim(),
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
      translatedQuery: '',
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

  const translatedQuery = await translateImageQueryToEnglish(query);
  const perPage = status.pixabay && status.pexels ? 15 : 24;

  const tasks: Array<Promise<{ provider: ImageBankProvider; items: ImageBankSearchItem[] }>> =
    [];

  if (status.pixabay) {
    tasks.push(
      searchPixabayImages(translatedQuery, perPage).then((items) => ({
        provider: 'pixabay' as const,
        items,
      })),
    );
  }
  if (status.pexels) {
    tasks.push(
      searchPexelsImages(translatedQuery, perPage).then((items) => ({
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
    translatedQuery,
    providers: successful.map((s) => s.provider),
    items: interleaveResults(pixabayItems, pexelsItems),
  };
}
