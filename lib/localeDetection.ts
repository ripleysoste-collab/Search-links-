import type { IncomingHttpHeaders } from 'node:http';

export type SupportedLocale = 'es' | 'en' | 'pt';
export type LocaleSource = 'geo' | 'header' | 'default' | 'manual';

export interface DetectedLocaleResult {
  locale: SupportedLocale;
  countryCode: string | null;
  source: 'geo' | 'header' | 'default';
}

const PORTUGUESE_COUNTRIES = new Set([
  'BR',
  'PT',
  'AO',
  'MZ',
  'CV',
  'GW',
  'ST',
  'TL',
]);

const SPANISH_COUNTRIES = new Set([
  'ES',
  'MX',
  'CO',
  'AR',
  'CL',
  'PE',
  'VE',
  'EC',
  'GT',
  'CU',
  'BO',
  'DO',
  'HN',
  'PY',
  'SV',
  'NI',
  'CR',
  'PA',
  'UY',
  'PR',
  'GQ',
]);

function readHeaderString(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  const raw = headers[name.toLowerCase()];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const trimmed = String(raw[0] || '').trim();
    return trimmed || null;
  }
  return null;
}

function normalizeCountryCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (code === 'XX' || code === 'T1' || code === 'ZZ') return null;
  return code;
}

export function mapCountryToLocale(countryCode: string): SupportedLocale {
  const upper = countryCode.toUpperCase();
  if (PORTUGUESE_COUNTRIES.has(upper)) return 'pt';
  if (SPANISH_COUNTRIES.has(upper)) return 'es';
  return 'en';
}

export function parseAcceptLanguageLocale(
  headerValue: string | null,
): SupportedLocale | null {
  if (!headerValue) return null;

  const candidates = headerValue
    .split(',')
    .map((part) => {
      const [langRaw, ...params] = part.trim().split(';');
      const base = (langRaw || '').trim().toLowerCase().split('-')[0];
      let q = 1;
      for (const param of params) {
        const match = param.trim().match(/^q=([0-9.]+)$/i);
        if (match) {
          const parsed = Number(match[1]);
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      return { base, q };
    })
    .filter((entry) => entry.base.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const item of candidates) {
    if (item.base === 'pt') return 'pt';
    if (item.base === 'es') return 'es';
    if (item.base === 'en') return 'en';
  }

  return null;
}

function extractClientIp(
  headers: IncomingHttpHeaders,
  remoteAddress?: string,
): string | null {
  const forwarded = readHeaderString(headers, 'x-forwarded-for');
  const candidate =
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
    readHeaderString(headers, 'cf-connecting-ip') ||
    readHeaderString(headers, 'x-real-ip') ||
    remoteAddress?.trim() ||
    null;

  if (!candidate) return null;
  return candidate.replace(/^::ffff:/i, '');
}

function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  ) {
    return true;
  }

  const parts = normalized.split('.');
  if (parts.length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }
    if (first === 127 || first === 100) {
      return true;
    }
  }

  return false;
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  if (!ip || isPrivateOrLocalIp(ip)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/country/`,
      {
        signal: controller.signal,
        headers: { Accept: 'text/plain' },
      },
    );
    if (!response.ok) return null;
    const text = await response.text();
    return normalizeCountryCode(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectLocaleFromRequest(
  headers: IncomingHttpHeaders,
  remoteAddress?: string,
): Promise<DetectedLocaleResult> {
  const geoHeaders = [
    'x-vercel-ip-country',
    'cf-ipcountry',
    'x-country-code',
    'cloudfront-viewer-country',
    'x-appengine-country',
    'x-geo-country',
  ];

  for (const headerName of geoHeaders) {
    const code = normalizeCountryCode(readHeaderString(headers, headerName));
    if (code) {
      return {
        locale: mapCountryToLocale(code),
        countryCode: code,
        source: 'geo',
      };
    }
  }

  const clientIp = extractClientIp(headers, remoteAddress);
  if (clientIp) {
    const ipCountry = await lookupCountryByIp(clientIp);
    if (ipCountry) {
      return {
        locale: mapCountryToLocale(ipCountry),
        countryCode: ipCountry,
        source: 'geo',
      };
    }
  }

  const acceptLanguage = readHeaderString(headers, 'accept-language');
  const headerLocale = parseAcceptLanguageLocale(acceptLanguage);
  if (headerLocale) {
    return {
      locale: headerLocale,
      countryCode: null,
      source: 'header',
    };
  }

  return {
    locale: 'es',
    countryCode: null,
    source: 'default',
  };
}
