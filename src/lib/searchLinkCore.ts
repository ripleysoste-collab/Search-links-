import { getApiBaseUrl } from './apiConfig';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexClient(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

export function generateCoreServiceSlug(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `srv_${bytesToHex(bytes)}`;
}

export async function generateCoreApiKey(): Promise<{
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}> {
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  const rawKey = `sl_core_${bytesToHex(randomBytes)}`;
  const keyHash = await sha256HexClient(rawKey);
  const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;

  return {
    rawKey,
    keyPrefix,
    keyHash,
  };
}

export function isRawCoreApiKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('sl_core_') &&
    !trimmed.includes('...') &&
    trimmed.length >= 28
  );
}

export function buildCoreServiceEndpointUrl(slug: string): string {
  const cleanSlug = slug.trim();
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return `${apiBase}/api/v1/services/${encodeURIComponent(cleanSlug)}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1/services/${encodeURIComponent(cleanSlug)}`;
  }
  return `/api/v1/services/${encodeURIComponent(cleanSlug)}`;
}

export function buildCoreCurlSnippet(
  endpointUrl: string,
  apiKey?: string | null,
): string {
  const safeKey = isRawCoreApiKey(apiKey) ? apiKey!.trim() : 'TU_API_KEY_SL_CORE';
  return `curl -H "Authorization: Bearer ${safeKey}" "${endpointUrl}"`;
}

export interface CoreEndpointTestResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  rawJson: string;
  errorMessage?: string;
}

export async function testCoreServiceEndpoint(
  endpointUrl: string,
  apiKey: string,
  query?: string,
): Promise<CoreEndpointTestResult> {
  const startedAt = performance.now();
  let targetUrl = endpointUrl.trim();
  if (query && query.trim()) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}q=${encodeURIComponent(query.trim())}`;
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey.trim(),
      },
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const text = await response.text();
    let prettyJson = text;
    let parsedError: string | undefined;

    try {
      const parsed = JSON.parse(text) as { error?: string };
      prettyJson = JSON.stringify(parsed, null, 2);
      if (!response.ok && typeof parsed.error === 'string') {
        parsedError = parsed.error;
      }
    } catch {
      // Keep raw text when non-JSON
    }

    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      rawJson: prettyJson,
      errorMessage: parsedError,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const message =
      err instanceof Error ? err.message : 'No se pudo conectar al endpoint.';
    return {
      ok: false,
      status: 0,
      latencyMs,
      rawJson: JSON.stringify({ ok: false, error: message }, null, 2),
      errorMessage: message,
    };
  }
}
