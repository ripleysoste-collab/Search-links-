import * as cheerio from 'cheerio';
import { imageSize } from 'image-size';
import { safeFetch } from './urlSafety.ts';

export interface ExtractedCatalogImage {
  id: string;
  url: string;
  originalUrl: string;
  cleanUrl: string;
  sourcePageUrl: string;
  alt: string;
  width: number;
  height: number;
}

export interface ExtractImagesResult {
  sourceUrl: string;
  images: ExtractedCatalogImage[];
  totalCandidates: number;
  pagesScanned?: number;
  usedJsFallback?: boolean;
}

export interface ExtractImagesOptions {
  maxResults?: number;
}

interface RawCandidate {
  url: string;
  alt: string;
  priority: number;
  sourcePageUrl: string;
}

const MIN_DIMENSION_PX = 200;
const FALLBACK_MIN_DIMENSION_PX = 120;
const MAX_ASPECT_RATIO = 3.0;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_JS_BUNDLE_BYTES = 1_500_000;
const MAX_PROBE_CANDIDATES = 80;
const MAX_RESULTS = 24;
const MAX_ALLOWED_RESULTS = 50;
const PROBE_WAVE_SIZE = 24;
const PROBE_CONCURRENCY = 12;
const MAX_IMAGE_PROBE_BYTES = 160 * 1024;
const MAX_SUBPAGES_TO_CRAWL = 3;
const MAX_JS_BUNDLES_TO_SCAN = 2;

const BROWSER_HEADER_PROFILES: Record<string, string>[] = [
  {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/png,image/jpeg,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
  {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
  },
];

const JUNK_EXTENSIONS = /\.(svg|ico|cur|woff2?|ttf|eot|mp4|webm|mov|mp3|wav|pdf|css|js|mjs|json|xml)(\?|#|$)/i;
const JUNK_KEYWORDS =
  /(^|[^a-z])(logo|logotipo|icon|icono|favicon|sprite|spacer|pixel|1x1|tracking|analytics|telemetry|spinner|loader|loading|placeholder|emoji|doubleclick|adsense|blank|transparent|avatar|badge|trust-?seal|payment|visa|mastercard|paypal|amex|diners|elo|boleto|pix|nequi|daviplata|bancolombia|yape|plin|efecty|oxxo|pse|mercado-?pago|apple-?pay|google-?pay|app-?store|google-?play|play-?store|qr-?code|whatsapp-?(?:btn|button|icon)|facebook-?icon|instagram-?icon)([^a-z]|$)/i;
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i;

const KNOWN_IMAGE_CDN_HOSTS = [
  'images.unsplash.com',
  'res.cloudinary.com',
  'cdn.shopify.com',
  'static.wixstatic.com',
  'images.squarespace-cdn.com',
  'http2.mlstatic.com',
  'm.media-amazon.com',
  'lh3.googleusercontent.com',
  'firebasestorage.googleapis.com',
  'images.ctfassets.net',
  'cdn.sanity.io',
  'imgix.net',
  'assets.olaclick.app',
  'olaclick.app',
  'cdn.tiendanube.com',
  'acdn.mitiendanube.com',
  'cdn.webflow.com',
  'website-files.com',
  'images.rappi.com',
  'cdn.builder.io',
];

const CATALOG_LINK_KEYWORDS =
  /\/(productos?|products?|tienda|shop|store|catalo[gq]o?|collections?|colecciones?|menu|carta|servicios?|services?|categori[ae]s?|category|item|articulos?|ofertas?|destacados?|novedades?)(\/|$|\?)/i;
const EXCLUDED_LINK_KEYWORDS =
  /\/(cart|carrito|checkout|login|signin|register|registro|account|cuenta|mi-cuenta|wp-admin|wp-login|privacy|privacidad|terms|terminos|condiciones|cookies|contacto|contact|about|nosotros|faq|ayuda|help|search|buscar|wishlist|favoritos)(\/|$|\?)/i;

const ANALYTICS_SCRIPT_PATTERN =
  /(googletagmanager|google-analytics|gtag|fbevents|facebook\.net|hotjar|clarity\.ms|sentry|tiktok|snapchat|pinterest|intercom|crisp|tawk|hubspot|doubleclick)/i;

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
]);

const RESIZE_QUERY_PARAMS = new Set([
  'w',
  'width',
  'h',
  'height',
  'maxwidth',
  'maxheight',
  'mw',
  'mh',
  'q',
  'quality',
  'fit',
  'crop',
  'auto',
  'format',
  'fm',
  'dpr',
  'resize',
  'size',
  'imwidth',
  'sw',
  'sh',
  'sm',
  'upscale',
  'sharpen',
  'blur',
]);

const SIGNED_QUERY_PARAMS = new Set([
  'signature',
  'sig',
  'token',
  'hash',
  'hmac',
  'x-amz-signature',
  'x-amz-credential',
  'googleaccessid',
  'policy',
  'key-pair-id',
  'auth',
  'st',
  'sp',
]);

function normalizeCandidateString(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/\{\{?\s*width\s*\}?\}/gi, '1000')
    .replace(/\{\{?\s*height\s*\}?\}/gi, '1000')
    .replace(/\{\{?\s*size\s*\}?\}/gi, '1024x1024')
    .replace(/\{\{?\s*quality\s*\}?\}/gi, '85');
}

function unwrapImageProxyPath(resolved: URL): string {
  // Unwrap Next.js image optimizer: /_next/image?url=%2Fimg.jpg&w=640&q=75
  if (resolved.pathname === '/_next/image') {
    const inner = resolved.searchParams.get('url');
    if (inner) {
      try {
        const innerUrl = new URL(inner, resolved.origin);
        if (innerUrl.protocol === 'http:' || innerUrl.protocol === 'https:') {
          return innerUrl.href;
        }
      } catch {
        // Keep proxy URL as fallback with larger width
      }
    }
    resolved.searchParams.set('w', '1200');
    return resolved.href;
  }

  // Unwrap Cloudflare Image Resizing: /cdn-cgi/image/width=300,.../https://...
  const cfMatch = resolved.pathname.match(/^\/cdn-cgi\/image\/[^/]+\/(https?:\/\/.+)$/i);
  if (cfMatch?.[1]) {
    return cfMatch[1];
  }

  return resolved.href;
}

function resolveHttpUrl(raw: string | undefined, baseUrl: string): string | null {
  if (!raw) return null;
  const trimmed = normalizeCandidateString(raw);

  if (
    !trimmed ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('#') ||
    trimmed.includes('{')
  ) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    resolved.hash = '';
    return unwrapImageProxyPath(resolved);
  } catch {
    return null;
  }
}

function pickBestSrcsetCandidate(srcset: string | undefined, baseUrl: string): string | null {
  if (!srcset) return null;

  let bestUrl: string | null = null;
  let bestScore = -1;

  for (const entry of srcset.split(',')) {
    const parts = entry.trim().split(/\s+/);
    if (!parts[0]) continue;
    const candidateUrl = resolveHttpUrl(parts[0], baseUrl);
    if (!candidateUrl) continue;

    let score = 1;
    const descriptor = parts[1]?.toLowerCase() ?? '';
    if (descriptor.endsWith('w')) {
      score = parseInt(descriptor, 10) || 1;
    } else if (descriptor.endsWith('x')) {
      score = Math.round((parseFloat(descriptor) || 1) * 1000);
    }

    if (score > bestScore) {
      bestScore = score;
      bestUrl = candidateUrl;
    }
  }

  return bestUrl;
}

function extractCssUrlValues(cssText: string, baseUrl: string): string[] {
  const results: string[] = [];
  const regex = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cssText)) !== null) {
    const resolved = resolveHttpUrl(match[2], baseUrl);
    if (resolved) results.push(resolved);
  }
  return results;
}

function extractScriptImageUrls(
  scriptText: string,
  baseUrl: string,
  maxItems = 45,
): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (raw: string) => {
    const resolved = resolveHttpUrl(raw, baseUrl);
    if (!resolved || seen.has(resolved) || isJunkCandidateUrl(resolved)) return;
    seen.add(resolved);
    results.push(resolved);
  };

  // 1. Standard image extension URLs (including relative /assets/... or escaped https:\/\/...)
  const extRegex =
    /(?:https?:\\?\/\\?\/|\/)[^\s"'`<>()\\]{4,360}\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'`<>()\\]{0,140})?/gi;
  let match: RegExpExecArray | null;
  while ((match = extRegex.exec(scriptText)) !== null) {
    pushUnique(match[0]);
    if (results.length >= maxItems) return results;
  }

  // 2. Extensionless known image CDNs (Unsplash, Cloudinary, Wixstatic, Shopify, Google, Firebase, etc.)
  const cdnHostPattern = KNOWN_IMAGE_CDN_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|');
  const cdnRegex = new RegExp(
    `https?:\\\\?\\/\\\\?\\/(?:${cdnHostPattern})[^\\s"'\`<>()\\\\]{6,320}`,
    'gi',
  );
  while ((match = cdnRegex.exec(scriptText)) !== null) {
    pushUnique(match[0]);
    if (results.length >= maxItems) return results;
  }

  return results;
}

function isJunkCandidateUrl(url: string): boolean {
  if (JUNK_EXTENSIONS.test(url)) return true;
  try {
    const parsed = new URL(url);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    if (JUNK_KEYWORDS.test(pathAndQuery)) return true;
    return false;
  } catch {
    return true;
  }
}

function isSignedUrl(parsed: URL): boolean {
  for (const key of parsed.searchParams.keys()) {
    if (SIGNED_QUERY_PARAMS.has(key.toLowerCase())) {
      return true;
    }
  }
  if (parsed.hostname.includes('cloudinary.com') && /\/s--[^/]+--\//.test(parsed.pathname)) {
    return true;
  }
  return false;
}

function computeCanonicalImageKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname;

    // Normalize WordPress Photon CDN hosts (i0.wp.com/domain.com/...)
    if (/^i[0-3]\.wp\.com$/i.test(host) && pathname.length > 2) {
      pathname = pathname.replace(/^\/+/, '');
    }

    // Wix: static.wixstatic.com/media/<assetId>/v1/fill/... -> media/<assetId>
    if (host.endsWith('wixstatic.com')) {
      const wixMatch = pathname.match(/^\/media\/([^/]+)/i);
      if (wixMatch?.[1]) {
        return `wixstatic.com/media/${wixMatch[1].toLowerCase()}`;
      }
    }

    // Cloudinary: strip transformation chain between /upload/ and asset path
    if (host.includes('cloudinary.com') && pathname.includes('/image/upload/')) {
      const parts = pathname.split('/image/upload/');
      if (parts.length === 2) {
        const restSegments = parts[1].split('/');
        while (
          restSegments.length > 1 &&
          !restSegments[0].match(/^v\d+$/) &&
          /(?:^|,)(?:w|h|c|q|f|dpr|g|ar|e|bo|t)_/i.test(restSegments[0])
        ) {
          restSegments.shift();
        }
        pathname = `${parts[0]}/image/upload/${restSegments.join('/')}`;
      }
    }

    // MercadoLibre: collapse -I/-S/-V/-F/-O size suffixes and jpg/webp mirrors
    if (host.endsWith('mlstatic.com')) {
      pathname = pathname.replace(/-[A-Z](?=\.(?:jpe?g|png|webp|avif)$)/i, '');
      pathname = pathname.replace(/\.(?:jpe?g|webp|avif)$/i, '.jpg');
    }

    // WordPress WebP mirrors (.jpg.webp / .png.webp -> .jpg / .png)
    pathname = pathname.replace(/\.(jpe?g|png)\.webp$/i, '.$1');

    // WordPress/WooCommerce size suffixes (-300x300, -1024x1024, -scaled)
    pathname = pathname.replace(
      /(?:-\d{2,4}x\d{2,4}|-scaled)(?=\.(?:jpe?g|png|webp|avif)$)/i,
      '',
    );

    // Shopify size suffixes (_300x300, _1200x, _medium, _grande, _master, etc.)
    pathname = pathname.replace(
      /_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande|master)(?=\.(?:jpe?g|png|webp|avif)$)/i,
      '',
    );

    const remainingParams = new URLSearchParams();
    for (const [key, value] of Array.from(parsed.searchParams.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const lower = key.toLowerCase();
      if (TRACKING_QUERY_PARAMS.has(lower) || RESIZE_QUERY_PARAMS.has(lower)) {
        continue;
      }
      remainingParams.append(key, value);
    }

    const query = remainingParams.toString();
    return `${host}${pathname.toLowerCase()}${query ? `?${query}` : ''}`;
  } catch {
    return rawUrl.toLowerCase();
  }
}

function estimateUrlResolutionScore(rawUrl: string): number {
  let score = 1500;
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;

    // Check explicit resize query params
    for (const key of ['w', 'width', 'imwidth']) {
      const val = parsed.searchParams.get(key);
      if (val && /^\d+$/.test(val)) {
        score = Math.min(score, parseInt(val, 10));
      }
    }

    const resizeParam = parsed.searchParams.get('resize') || parsed.searchParams.get('size');
    if (resizeParam) {
      const nums = resizeParam.match(/\d+/g)?.map((n) => parseInt(n, 10)) ?? [];
      if (nums.length > 0) {
        score = Math.min(score, Math.max(...nums));
      }
    }

    // WordPress suffix: -300x300.jpg
    const wpMatch = pathname.match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)$/i);
    if (wpMatch) {
      score = Math.max(parseInt(wpMatch[1], 10), parseInt(wpMatch[2], 10));
    }

    // Shopify suffix
    const shopifyNum = pathname.match(/_(\d+)x(\d*)\.(?:jpe?g|png|webp|avif)$/i);
    if (shopifyNum) {
      const w = parseInt(shopifyNum[1], 10);
      const h = shopifyNum[2] ? parseInt(shopifyNum[2], 10) : w;
      score = Math.max(w, h);
    } else if (/_(pico|icon|thumb)\./i.test(pathname)) {
      score = 64;
    } else if (/_(small|compact)\./i.test(pathname)) {
      score = 160;
    } else if (/_medium\./i.test(pathname)) {
      score = 240;
    } else if (/_large\./i.test(pathname)) {
      score = 480;
    } else if (/_grande\./i.test(pathname)) {
      score = 600;
    } else if (/_master\./i.test(pathname)) {
      score = 1800;
    }

    // Cloudinary transform w_300
    const cldW = pathname.match(/(?:^|[,/])w_(\d+)/i);
    if (cldW) {
      score = parseInt(cldW[1], 10);
    }

    // Wix fill w_240
    if (parsed.hostname.endsWith('wixstatic.com')) {
      const wixW = pathname.match(/\/w_(\d+)/i);
      if (wixW) {
        score = parseInt(wixW[1], 10);
      } else if (/^\/media\/[^/]+$/i.test(pathname)) {
        score = 1800;
      }
    }

    // MercadoLibre suffixes
    if (parsed.hostname.endsWith('mlstatic.com')) {
      if (/-O\.(?:jpe?g|png|webp)$/i.test(pathname)) score = 1600;
      else if (/-F\.(?:jpe?g|png|webp)$/i.test(pathname)) score = 1200;
      else if (/-I\.(?:jpe?g|png|webp)$/i.test(pathname)) score = 200;
      else if (/-S\.(?:jpe?g|png|webp)$/i.test(pathname)) score = 120;
    }

    if (/\.avif(\?|#|$)/i.test(rawUrl)) {
      score -= 10;
    }
    if (parsed.protocol === 'https:') {
      score += 1;
    }
  } catch {
    return 0;
  }
  return score;
}

function tryUpgradeUrlToHd(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (isSignedUrl(parsed)) return null;

    let changed = false;
    const host = parsed.hostname.toLowerCase();

    // 1. Wix full original media asset
    if (host.endsWith('wixstatic.com')) {
      const wixMatch = parsed.pathname.match(/^(\/media\/[^/]+)\/v1\/(?:fill|fit|crop)\/.+$/i);
      if (wixMatch?.[1]) {
        parsed.pathname = wixMatch[1];
        parsed.search = '';
        return parsed.href;
      }
    }

    // 2. MercadoLibre thumbnail -> original (-O)
    if (host.endsWith('mlstatic.com')) {
      const upgradedMl = parsed.pathname.replace(
        /-(?:I|S|V)(\.(?:jpe?g|png|webp))$/i,
        '-O$1',
      );
      if (upgradedMl !== parsed.pathname) {
        parsed.pathname = upgradedMl;
        changed = true;
      }
    }

    // 3. WordPress / WooCommerce cropped filename (-300x300.jpg -> .jpg)
    const wpCropped = parsed.pathname.match(
      /^(.+?)-(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp))$/i,
    );
    if (wpCropped) {
      const w = parseInt(wpCropped[2], 10);
      const h = parseInt(wpCropped[3], 10);
      if (Math.max(w, h) < 800) {
        parsed.pathname = `${wpCropped[1]}${wpCropped[4]}`;
        changed = true;
      }
    }

    // 4. Shopify size suffix (_300x300.jpg / _medium.jpg -> .jpg)
    if (
      host.includes('shopify.com') ||
      parsed.pathname.includes('/cdn/shop/') ||
      parsed.pathname.includes('/s/files/')
    ) {
      const shopifySize = parsed.pathname.match(
        /^(.+?)_(?:(\d+)x(\d*)|(\d*)x(\d+)|pico|icon|thumb|small|compact|medium|large|grande)(\.(?:jpe?g|png|webp))$/i,
      );
      if (shopifySize) {
        const w = shopifySize[2] ? parseInt(shopifySize[2], 10) : 0;
        const h = shopifySize[5] ? parseInt(shopifySize[5], 10) : 0;
        if (Math.max(w, h) < 800) {
          parsed.pathname = `${shopifySize[1]}${shopifySize[6]}`;
          changed = true;
        }
      }
    }

    // 5. Cloudinary small width transform
    if (host.includes('cloudinary.com') && parsed.pathname.includes('/image/upload/')) {
      const upgradedCld = parsed.pathname.replace(/(\b|,)w_(\d+)(\b|,)/gi, (full, pre, num, post) => {
        const val = parseInt(num, 10);
        if (val > 0 && val < 900) {
          changed = true;
          return `${pre}w_1200${post}`;
        }
        return full;
      });
      if (upgradedCld !== parsed.pathname) {
        parsed.pathname = upgradedCld;
      }
    }

    // 6. Query-string width parameters (Shopify ?width=300, Unsplash ?w=400, Imgix, Sanity, WordPress)
    for (const key of ['w', 'width', 'imwidth']) {
      const val = parsed.searchParams.get(key);
      if (val && /^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (num > 0 && num < 900) {
          parsed.searchParams.set(key, '1200');
          if (parsed.searchParams.has('h') || parsed.searchParams.has('height')) {
            parsed.searchParams.delete('h');
            parsed.searchParams.delete('height');
          }
          changed = true;
        }
      }
    }

    return changed && parsed.href !== rawUrl ? parsed.href : null;
  } catch {
    return null;
  }
}

function isCatalogFriendlyDimensions(width: number, height: number, minSide: number): boolean {
  if (width < minSide || height < minSide) return false;
  const aspect = Math.max(width / height, height / width);
  return aspect <= MAX_ASPECT_RATIO;
}

function buildCleanDisplayUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

function deriveTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    const cleanName = decodeURIComponent(lastSegment)
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (cleanName.length >= 2) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1, 80);
    }
    return parsed.hostname;
  } catch {
    return 'Imagen extraída';
  }
}

function looksLikeImageUrlString(value: string): boolean {
  const clean = normalizeCandidateString(value);
  if (!/^https?:\/\/|^\/[^/]/i.test(clean)) return false;
  if (IMAGE_EXT_REGEX.test(clean)) return true;
  return KNOWN_IMAGE_CDN_HOSTS.some((host) => clean.toLowerCase().includes(host));
}

function collectJsonTreeImages(
  node: unknown,
  baseUrl: string,
  out: RawCandidate[],
  inheritedTitle = '',
  depth = 0,
) {
  if (!node || depth > 10 || out.length > 250) return;

  if (typeof node === 'string') {
    if (looksLikeImageUrlString(node)) {
      const resolved = resolveHttpUrl(node, baseUrl);
      if (resolved) {
        out.push({
          url: resolved,
          alt: inheritedTitle,
          priority: inheritedTitle ? 1 : 2,
          sourcePageUrl: baseUrl,
        });
      }
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node.slice(0, 80)) {
      collectJsonTreeImages(item, baseUrl, out, inheritedTitle, depth + 1);
    }
    return;
  }

  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    const rawLabel =
      (typeof record.name === 'string' && record.name) ||
      (typeof record.title === 'string' && record.title) ||
      (typeof record.productName === 'string' && record.productName) ||
      (typeof record.headline === 'string' && record.headline) ||
      (typeof record.alt === 'string' && record.alt) ||
      inheritedTitle;
    const label = rawLabel.replace(/\s+/g, ' ').trim().slice(0, 90);

    const priorityImageKeys = [
      'image',
      'images',
      'featuredImage',
      'featured_image',
      'thumbnailUrl',
      'thumbnail',
      'contentUrl',
      'imageUrl',
      'image_url',
      'mediaUrl',
      'assetUrl',
      'photo',
      'src',
      'url',
    ];

    for (const key of priorityImageKeys) {
      if (!(key in record)) continue;
      const val = record[key];
      if (typeof val === 'string') {
        if (key === 'url' || key === 'src' ? looksLikeImageUrlString(val) : true) {
          const resolved = resolveHttpUrl(val, baseUrl);
          if (resolved && (IMAGE_EXT_REGEX.test(resolved) || key !== 'url')) {
            out.push({
              url: resolved,
              alt: label,
              priority: label ? 1 : 2,
              sourcePageUrl: baseUrl,
            });
          }
        }
      } else {
        collectJsonTreeImages(val, baseUrl, out, label, depth + 1);
      }
    }

    for (const [key, val] of Object.entries(record)) {
      if (priorityImageKeys.includes(key)) continue;
      if (val && typeof val === 'object') {
        collectJsonTreeImages(val, baseUrl, out, label, depth + 1);
      }
    }
  }
}

function extractNearestHeading(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>,
): {
  alt: string;
  isProductContext: boolean;
  isChromeOrBanner: boolean;
} {
  const ownAlt = ($el.attr('alt') || $el.attr('title') || $el.attr('aria-label') || '').trim();
  const imgClassAndId = `${$el.attr('class') || ''} ${$el.attr('id') || ''}`.toLowerCase();

  let isProductClass = $el.attr('itemprop') === 'image';
  let hasPriceSignal = false;
  let isChromeOrBanner =
    /(hero|banner|slider|carousel-bg|logo|brand-mark|payment|trust|badge|social)/i.test(imgClassAndId);
  let alt = ownAlt.slice(0, 90);

  const ancestors = $el.parents().slice(0, 5);
  ancestors.each((idx, node) => {
    const $anc = $(node);
    const tagName = (node as { tagName?: string }).tagName?.toLowerCase() || '';
    const ancMeta = `${tagName} ${$anc.attr('class') || ''} ${$anc.attr('id') || ''}`.toLowerCase();

    if (
      tagName === 'footer' ||
      tagName === 'nav' ||
      /(footer|navbar|site-header|announcement|payment-?method|social-?link|trust-?badge|partner-?logo|client-?logo|hero-?banner|promo-?banner)/i.test(
        ancMeta,
      )
    ) {
      isChromeOrBanner = true;
    }

    if (
      idx <= 3 &&
      /(product|producto|item|card|catalog|woo|shopify|grid-item|menu-?item|dish|platillo|food)/i.test(
        ancMeta,
      )
    ) {
      isProductClass = true;
    }

    if (idx <= 3 && !hasPriceSignal) {
      const snippet = $anc.text().replace(/\s+/g, ' ').trim().slice(0, 260);
      if (/[$€£]\s?\d|\d+[.,]\d{2}\s?(?:usd|mxn|cop|eur|ars|pen|clp|brl)?/i.test(snippet)) {
        hasPriceSignal = true;
      }
      if (alt.length < 2) {
        const nearby = $anc
          .find('figcaption, h1, h2, h3, h4, [class*="title"], [class*="name"]')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim();
        if (nearby.length >= 2 && nearby.length <= 90) {
          alt = nearby;
        }
      }
    }
  });

  return {
    alt,
    isProductContext: (hasPriceSignal || isProductClass) && !isChromeOrBanner,
    isChromeOrBanner,
  };
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return (await response.text()).slice(0, maxBytes);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function fetchHtmlWithFallback(
  targetUrl: string,
  timeoutMs = 8000,
): Promise<{ html: string; finalUrl: string; status: number }> {
  let lastError: Error | null = null;
  let lastStatus = 0;

  for (const headers of BROWSER_HEADER_PROFILES) {
    try {
      const { response, finalUrl } = await safeFetch(targetUrl, {
        headers,
        timeoutMs,
      });

      lastStatus = response.status;

      if (response.status === 403 || response.status === 406 || response.status === 429) {
        lastError = new Error(`El sitio respondió con estado ${response.status}.`);
        await response.body?.cancel().catch(() => {});
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`No se pudo cargar la página (HTTP ${response.status}).`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        contentType &&
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        await response.body?.cancel().catch(() => {});
        throw new Error('La URL no corresponde a una página web HTML.');
      }

      const html = await readTextWithLimit(response, MAX_HTML_BYTES);
      return { html, finalUrl, status: response.status };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('No se pudo leer la página.');
    }
  }

  if (lastStatus === 403 || lastStatus === 429) {
    return { html: '', finalUrl: targetUrl, status: lastStatus };
  }

  throw lastError ?? new Error('No fue posible leer la página solicitada.');
}

function collectCandidatesFromHtml(
  html: string,
  pageUrl: string,
  rawCandidates: RawCandidate[],
): { imgCount: number; isSpaShell: boolean; scriptSrcs: string[]; catalogLinks: string[] } {
  const $ = cheerio.load(html);
  let imgCount = 0;

  // 1. <img> tags (lazy attrs, srcset, src)
  $('img').each((_, el) => {
    imgCount++;
    const $el = $(el);

    // Skip tiny icons or extreme banner strips declared directly in HTML attributes
    const attrW = parseInt($el.attr('width') || '', 10);
    const attrH = parseInt($el.attr('height') || '', 10);
    if (Number.isFinite(attrW) && Number.isFinite(attrH) && attrW > 0 && attrH > 0) {
      if (attrW <= 64 || attrH <= 64) return;
      if (Math.max(attrW / attrH, attrH / attrW) > 3.8) return;
    }

    const { alt, isProductContext, isChromeOrBanner } = extractNearestHeading($, $el);
    const preferredUrls = [
      pickBestSrcsetCandidate($el.attr('data-srcset'), pageUrl),
      pickBestSrcsetCandidate($el.attr('srcset'), pageUrl),
      resolveHttpUrl($el.attr('data-large_image'), pageUrl),
      resolveHttpUrl($el.attr('data-zoom-image'), pageUrl),
      resolveHttpUrl($el.attr('data-hi-res-src'), pageUrl),
      resolveHttpUrl($el.attr('data-full-src'), pageUrl),
      resolveHttpUrl($el.attr('data-src-retina'), pageUrl),
      resolveHttpUrl($el.attr('data-original'), pageUrl),
      resolveHttpUrl($el.attr('data-lazy-src'), pageUrl),
      resolveHttpUrl($el.attr('data-lazy'), pageUrl),
      resolveHttpUrl($el.attr('data-src'), pageUrl),
      resolveHttpUrl($el.attr('data-image'), pageUrl),
      resolveHttpUrl($el.attr('src'), pageUrl),
    ]
      .filter((u): u is string => Boolean(u))
      .filter((u) => !isJunkCandidateUrl(u));

    const nonAvif = preferredUrls.find((u) => !/\.avif(\?|#|$)/i.test(u));
    const chosen = nonAvif ?? preferredUrls[0];
    if (chosen) {
      rawCandidates.push({
        url: chosen,
        alt,
        priority: isChromeOrBanner ? 5 : isProductContext ? 0 : 1,
        sourcePageUrl: pageUrl,
      });
    }
  });

  // 2. <picture> <source> & background data attributes
  $('picture source').each((_, el) => {
    const $el = $(el);
    const best =
      pickBestSrcsetCandidate($el.attr('data-srcset'), pageUrl) ??
      pickBestSrcsetCandidate($el.attr('srcset'), pageUrl);
    if (best) {
      rawCandidates.push({ url: best, alt: '', priority: 2, sourcePageUrl: pageUrl });
    }
  });

  $('[data-bg], [data-background], [data-background-image]').each((_, el) => {
    const $el = $(el);
    const rawBg =
      $el.attr('data-bg') || $el.attr('data-background') || $el.attr('data-background-image');
    const resolved = resolveHttpUrl(rawBg, pageUrl);
    if (resolved) {
      rawCandidates.push({ url: resolved, alt: '', priority: 2, sourcePageUrl: pageUrl });
    }
  });

  // 3. Inline CSS background-image & <style> blocks
  $('[style*="background"]').each((_, el) => {
    const styleAttr = $(el).attr('style') || '';
    for (const cssUrl of extractCssUrlValues(styleAttr, pageUrl)) {
      rawCandidates.push({ url: cssUrl, alt: '', priority: 3, sourcePageUrl: pageUrl });
    }
  });

  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    for (const cssUrl of extractCssUrlValues(cssText, pageUrl).slice(0, 12)) {
      rawCandidates.push({ url: cssUrl, alt: '', priority: 4, sourcePageUrl: pageUrl });
    }
  });

  // 4. OpenGraph & Twitter Card meta images (low priority so catalog photos fill slots first)
  const metaTitle = (
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    ''
  ).trim();
  const metaSelectors = [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];
  for (const selector of metaSelectors) {
    $(selector).each((_, el) => {
      const resolved = resolveHttpUrl($(el).attr('content'), pageUrl);
      if (resolved) {
        rawCandidates.push({
          url: resolved,
          alt: metaTitle.slice(0, 90),
          priority: 4,
          sourcePageUrl: pageUrl,
        });
      }
    });
  }

  // 5. Structured JSON-LD & Hydration Scripts (__NEXT_DATA__, __NUXT__, Wix, Shopify, etc.)
  $('script[type="application/ld+json"], script[type="application/json"], script#__NEXT_DATA__').each(
    (_, el) => {
      const rawJson = $(el).contents().text().trim();
      if (!rawJson || rawJson.length < 10) return;
      try {
        const parsed = JSON.parse(rawJson);
        collectJsonTreeImages(parsed, pageUrl, rawCandidates);
      } catch {
        for (const scriptUrl of extractScriptImageUrls(rawJson.slice(0, 200_000), pageUrl)) {
          rawCandidates.push({ url: scriptUrl, alt: '', priority: 2, sourcePageUrl: pageUrl });
        }
      }
    },
  );

  $('script:not([src])').each((_, el) => {
    const type = ($(el).attr('type') || '').toLowerCase();
    if (type === 'application/ld+json' || type === 'application/json') return;
    const text = $(el).contents().text();
    if (!text || text.length < 20) return;
    for (const scriptUrl of extractScriptImageUrls(text.slice(0, 250_000), pageUrl)) {
      rawCandidates.push({ url: scriptUrl, alt: '', priority: 2, sourcePageUrl: pageUrl });
    }
  });

  // 6. Collect external app JS bundles & same-origin catalog links
  const scriptSrcs: string[] = [];
  const pageOrigin = new URL(pageUrl).origin;
  $('script[src]').each((_, el) => {
    const resolved = resolveHttpUrl($(el).attr('src'), pageUrl);
    if (!resolved || ANALYTICS_SCRIPT_PATTERN.test(resolved)) return;
    // Prefer same-origin or module bundles
    if (resolved.startsWith(pageOrigin) || $(el).attr('type') === 'module') {
      scriptSrcs.push(resolved);
    }
  });

  const linkScores = new Map<string, number>();
  $('a[href]').each((_, el) => {
    const $a = $(el);
    const resolved = resolveHttpUrl($a.attr('href'), pageUrl);
    if (!resolved || !resolved.startsWith(pageOrigin)) return;
    const cleanTarget = resolved.split('#')[0];
    if (cleanTarget === pageUrl || EXCLUDED_LINK_KEYWORDS.test(cleanTarget)) return;
    if (/\.(jpe?g|png|webp|pdf|zip|xml)$/i.test(cleanTarget)) return;

    const linkText = $a.text().replace(/\s+/g, ' ').trim().toLowerCase();
    let score = 0;
    if (CATALOG_LINK_KEYWORDS.test(cleanTarget)) score += 4;
    if (/(producto|product|tienda|shop|cat[áa]logo|catalog|colecci|men[úu]|carta|store|comprar)/i.test(linkText)) {
      score += 3;
    }
    if (score > 0) {
      linkScores.set(cleanTarget, Math.max(linkScores.get(cleanTarget) ?? 0, score));
    }
  });

  const catalogLinks = Array.from(linkScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([u]) => u)
    .slice(0, MAX_SUBPAGES_TO_CRAWL);

  const visibleBodyTextLen = $('body').text().replace(/\s+/g, ' ').trim().length;
  const hasSpaMountNode =
    $('#root, #app, #__next, #__nuxt, app-root').length > 0 && visibleBodyTextLen < 700;
  const isSpaShell = hasSpaMountNode || (imgCount <= 2 && scriptSrcs.length > 0);

  return { imgCount, isSpaShell, scriptSrcs, catalogLinks };
}

async function tryPlatformJsonApis(
  origin: string,
  pageUrl: string,
  htmlHint: string,
  targetMaxResults: number,
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = [];
  const lowerHint = htmlHint.toLowerCase();
  const parsedPage = new URL(pageUrl);
  const shopifyLimit = targetMaxResults > 24 ? 60 : 30;
  const wpLimit = targetMaxResults > 24 ? 50 : 24;
  const vtexEnd = targetMaxResults > 24 ? 49 : 23;

  const endpointsToTry: Array<{
    kind: 'shopify' | 'woo-store' | 'wp-media' | 'squarespace' | 'vtex';
    url: string;
  }> = [];

  // Shopify /products.json works on virtually all Shopify stores
  const isLikelyShopify =
    lowerHint.includes('shopify') || lowerHint.includes('cdn.shopify.com') || parsedPage.pathname === '/';
  if (isLikelyShopify) {
    endpointsToTry.push({ kind: 'shopify', url: `${origin}/products.json?limit=${shopifyLimit}` });
    if (parsedPage.pathname.includes('/collections/')) {
      const colSlug = parsedPage.pathname.split('/collections/')[1]?.split('/')[0];
      if (colSlug) {
        endpointsToTry.push({
          kind: 'shopify',
          url: `${origin}/collections/${colSlug}/products.json?limit=${shopifyLimit}`,
        });
      }
    }
  }

  // WooCommerce / WordPress JSON REST APIs
  const isLikelyWp =
    lowerHint.includes('wp-content') ||
    lowerHint.includes('woocommerce') ||
    parsedPage.pathname === '/';
  if (isLikelyWp) {
    endpointsToTry.push({
      kind: 'woo-store',
      url: `${origin}/wp-json/wc/store/v1/products?per_page=${wpLimit}`,
    });
    if (lowerHint.includes('wp-content')) {
      endpointsToTry.push({
        kind: 'wp-media',
        url: `${origin}/wp-json/wp/v2/media?per_page=${wpLimit}`,
      });
    }
  }

  // Squarespace JSON API
  if (lowerHint.includes('squarespace')) {
    const sqspUrl = new URL(pageUrl);
    sqspUrl.searchParams.set('format', 'json');
    endpointsToTry.push({ kind: 'squarespace', url: sqspUrl.href });
  }

  // VTEX catalog API
  if (lowerHint.includes('vtex')) {
    endpointsToTry.push({
      kind: 'vtex',
      url: `${origin}/api/catalog_system/pub/products/search?_from=0&_to=${vtexEnd}`,
    });
  }

  await Promise.allSettled(
    endpointsToTry.map(async ({ kind, url }) => {
      try {
        const { response } = await safeFetch(url, {
          headers: {
            'User-Agent': BROWSER_HEADER_PROFILES[0]['User-Agent'],
            Accept: 'application/json',
          },
          timeoutMs: 2200,
        });

        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          return;
        }
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('json')) {
          await response.body?.cancel().catch(() => {});
          return;
        }

        const rawJson = await readTextWithLimit(response, 1_500_000);
        const parsed = JSON.parse(rawJson) as unknown;

        if (kind === 'shopify' && parsed && typeof parsed === 'object' && 'products' in parsed) {
          const products = (parsed as { products?: Array<Record<string, unknown>> }).products;
          if (Array.isArray(products)) {
            for (const prod of products.slice(0, shopifyLimit)) {
              const title = typeof prod.title === 'string' ? prod.title.trim().slice(0, 90) : '';
              const imgs = Array.isArray(prod.images) ? prod.images : [];
              if (imgs.length > 0) {
                for (let idx = 0; idx < Math.min(imgs.length, 3); idx++) {
                  const imgRec = imgs[idx] as Record<string, unknown> | undefined;
                  const src = typeof imgRec?.src === 'string' ? imgRec.src : '';
                  const resolved = resolveHttpUrl(src, origin);
                  if (resolved) {
                    candidates.push({
                      url: resolved,
                      alt: title,
                      priority: idx === 0 ? 0 : 1,
                      sourcePageUrl: url,
                    });
                  }
                }
              } else {
                const fallbackSrc =
                  typeof (prod.image as Record<string, unknown> | undefined)?.src === 'string'
                    ? String((prod.image as Record<string, unknown>).src)
                    : '';
                const resolved = resolveHttpUrl(fallbackSrc, origin);
                if (resolved) {
                  candidates.push({
                    url: resolved,
                    alt: title,
                    priority: 0,
                    sourcePageUrl: url,
                  });
                }
              }
            }
          }
          return;
        }

        if (kind === 'woo-store' && Array.isArray(parsed)) {
          for (const prod of parsed.slice(0, wpLimit)) {
            if (!prod || typeof prod !== 'object') continue;
            const rec = prod as Record<string, unknown>;
            const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, 90) : '';
            const imgs = Array.isArray(rec.images) ? rec.images : [];
            const firstImg = imgs[0] as Record<string, unknown> | undefined;
            const src = typeof firstImg?.src === 'string' ? firstImg.src : '';
            const resolved = resolveHttpUrl(src, origin);
            if (resolved) {
              candidates.push({
                url: resolved,
                alt: name,
                priority: 0,
                sourcePageUrl: url,
              });
            }
          }
          return;
        }

        if (kind === 'wp-media' && Array.isArray(parsed)) {
          for (const media of parsed.slice(0, wpLimit)) {
            if (!media || typeof media !== 'object') continue;
            const rec = media as Record<string, unknown>;
            if (rec.media_type !== 'image') continue;
            const src = typeof rec.source_url === 'string' ? rec.source_url : '';
            const altText =
              (typeof rec.alt_text === 'string' && rec.alt_text) ||
              (typeof (rec.title as Record<string, unknown> | undefined)?.rendered === 'string' &&
                String((rec.title as Record<string, unknown>).rendered)) ||
              '';
            const resolved = resolveHttpUrl(src, origin);
            if (resolved) {
              candidates.push({
                url: resolved,
                alt: altText.replace(/<[^>]+>/g, '').trim().slice(0, 90),
                priority: 1,
                sourcePageUrl: url,
              });
            }
          }
          return;
        }

        collectJsonTreeImages(parsed, origin, candidates);
      } catch {
        // Platform API not available on this domain
      }
    }),
  );

  return candidates;
}

async function discoverSitemapCatalogUrls(origin: string): Promise<string[]> {
  try {
    const { response } = await safeFetch(`${origin}/sitemap.xml`, {
      headers: { 'User-Agent': BROWSER_HEADER_PROFILES[0]['User-Agent'] },
      timeoutMs: 3200,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return [];
    }
    const xml = await readTextWithLimit(response, 512 * 1024);
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi))
      .map((m) => m[1].trim())
      .filter((u) => u.startsWith(origin) && !EXCLUDED_LINK_KEYWORDS.test(u));

    const prioritized = locs.filter((u) => CATALOG_LINK_KEYWORDS.test(u));
    return (prioritized.length > 0 ? prioritized : locs.slice(1)).slice(0, MAX_SUBPAGES_TO_CRAWL);
  } catch {
    return [];
  }
}

async function scanSpaJsBundles(
  scriptSrcs: string[],
  baseUrl: string,
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = [];
  const targets = scriptSrcs.slice(0, MAX_JS_BUNDLES_TO_SCAN);

  await Promise.allSettled(
    targets.map(async (src) => {
      try {
        const { response } = await safeFetch(src, {
          headers: {
            'User-Agent': BROWSER_HEADER_PROFILES[0]['User-Agent'],
            Referer: baseUrl,
          },
          timeoutMs: 4200,
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          return;
        }
        const jsText = await readTextWithLimit(response, MAX_JS_BUNDLE_BYTES);
        for (const imgUrl of extractScriptImageUrls(jsText, baseUrl, 50)) {
          candidates.push({
            url: imgUrl,
            alt: '',
            priority: 1,
            sourcePageUrl: baseUrl,
          });
        }
      } catch {
        // Ignore unreachable bundle
      }
    }),
  );

  return candidates;
}

async function tryJsRenderedFallback(targetUrl: string): Promise<{
  candidates: RawCandidate[];
  usedJsFallback: boolean;
}> {
  const candidates: RawCandidate[] = [];

  // 1. Optional Browserless / remote headless Chromium endpoint if configured
  const browserlessUrl = (process.env.BROWSERLESS_URL || '').trim();
  if (browserlessUrl) {
    try {
      const token = (process.env.BROWSERLESS_TOKEN || '').trim();
      const endpoint = token
        ? `${browserlessUrl.replace(/\/+$/, '')}/content?token=${encodeURIComponent(token)}`
        : `${browserlessUrl.replace(/\/+$/, '')}/content`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          waitForTimeout: 2500,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const renderedHtml = (await res.text()).slice(0, MAX_HTML_BYTES);
        if (renderedHtml.length > 200) {
          collectCandidatesFromHtml(renderedHtml, targetUrl, candidates);
          if (candidates.length > 0) {
            return { candidates, usedJsFallback: true };
          }
        }
      }
    } catch {
      // Fall through to reader fallback
    }
  }

  // 2. Zero-config Jina Reader headless Chromium render fallback
  try {
    const headers: Record<string, string> = {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
      'X-With-Images-Summary': 'true',
      'X-Timeout': '9',
    };
    const jinaApiKey = (process.env.JINA_API_KEY || '').trim();
    if (jinaApiKey) {
      headers.Authorization = `Bearer ${jinaApiKey}`;
    }

    const readerResponse = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers,
      signal: AbortSignal.timeout(10500),
    });

    if (readerResponse.ok) {
      const markdown = await readTextWithLimit(readerResponse, 1_500_000);
      // Extract Markdown image syntax: ![alt text](https://...)
      const mdRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = mdRegex.exec(markdown)) !== null) {
        const resolved = resolveHttpUrl(match[2], targetUrl);
        if (resolved && !isJunkCandidateUrl(resolved)) {
          candidates.push({
            url: resolved,
            alt: match[1].replace(/\s+/g, ' ').trim().slice(0, 90),
            priority: 1,
            sourcePageUrl: targetUrl,
          });
        }
      }
      if (candidates.length > 0) {
        return { candidates, usedJsFallback: true };
      }
    }
  } catch {
    // External reader fallback unavailable or timed out
  }

  return { candidates, usedJsFallback: false };
}

async function probeImageDimensions(
  candidateUrl: string,
  refererUrl: string,
): Promise<{ width: number; height: number } | null> {
  const attemptProbe = async (useRange: boolean, includeReferer: boolean) => {
    const headers: Record<string, string> = {
      'User-Agent': BROWSER_HEADER_PROFILES[0]['User-Agent'],
      Accept: 'image/webp,image/png,image/jpeg,image/avif,image/*;q=0.8',
    };
    if (includeReferer) {
      headers.Referer = refererUrl;
    }
    if (useRange) {
      headers.Range = 'bytes=0-65535';
    }

    const { response } = await safeFetch(candidateUrl, {
      headers,
      timeoutMs: 2400,
    });

    if (!response.ok && response.status !== 206) {
      const status = response.status;
      await response.body?.cancel().catch(() => {});
      return { status, dims: null };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isImageHeader = contentType.startsWith('image/');
    const isBinaryFallback =
      (!contentType || contentType.includes('octet-stream')) &&
      IMAGE_EXT_REGEX.test(candidateUrl);

    if (
      (!isImageHeader && !isBinaryFallback) ||
      contentType.includes('svg') ||
      contentType.includes('icon')
    ) {
      await response.body?.cancel().catch(() => {});
      return { status: response.status, dims: null };
    }

    const reader = response.body?.getReader();
    if (!reader) return { status: response.status, dims: null };

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (totalBytes < MAX_IMAGE_PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;

      const combined = Buffer.concat(chunks);
      try {
        const size = imageSize(combined);
        if (size.width && size.height) {
          await reader.cancel().catch(() => {});
          return { status: response.status, dims: { width: size.width, height: size.height } };
        }
      } catch {
        // Need more bytes from header stream
      }
    }

    await reader.cancel().catch(() => {});
    return { status: response.status, dims: null };
  };

  try {
    let first = await attemptProbe(true, true);
    if (first.dims) return first.dims;

    // Retry without Range if origin rejects partial requests (416/400/501)
    if (first.status === 416 || first.status === 400 || first.status === 501) {
      first = await attemptProbe(false, true);
      if (first.dims) return first.dims;
    }

    // Retry without Referer if hotlink protection blocked the Referer header
    if (first.status === 403 || first.status === 401) {
      const retryNoRef = await attemptProbe(true, false);
      if (retryNoRef.dims) return retryNoRef.dims;
    }

    return null;
  } catch {
    return null;
  }
}

async function probeCandidateWithHdUpgrade(
  candidateUrl: string,
  refererUrl: string,
): Promise<{ resolvedUrl: string; dims: { width: number; height: number } } | null> {
  const hdUrl = tryUpgradeUrlToHd(candidateUrl);
  if (hdUrl && hdUrl !== candidateUrl) {
    const hdDims = await probeImageDimensions(hdUrl, refererUrl);
    if (hdDims && isCatalogFriendlyDimensions(hdDims.width, hdDims.height, FALLBACK_MIN_DIMENSION_PX)) {
      return { resolvedUrl: hdUrl, dims: hdDims };
    }
  }

  const baseDims = await probeImageDimensions(candidateUrl, refererUrl);
  if (!baseDims) return null;
  return { resolvedUrl: candidateUrl, dims: baseDims };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function extractImagesFromUrl(
  rawUrl: string,
  options?: ExtractImagesOptions,
): Promise<ExtractImagesResult> {
  const requestedMax =
    typeof options?.maxResults === 'number' && Number.isFinite(options.maxResults)
      ? Math.trunc(options.maxResults)
      : MAX_RESULTS;
  const targetMaxResults = Math.min(Math.max(requestedMax, 1), MAX_ALLOWED_RESULTS);
  const probeCap = targetMaxResults > MAX_RESULTS ? 135 : MAX_PROBE_CANDIDATES;
  const subpageCap = targetMaxResults > MAX_RESULTS ? 6 : MAX_SUBPAGES_TO_CRAWL;

  const initialFetch = await fetchHtmlWithFallback(rawUrl);
  const finalUrl = initialFetch.finalUrl;
  const origin = new URL(finalUrl).origin;
  const rawCandidates: RawCandidate[] = [];
  let pagesScanned = initialFetch.html ? 1 : 0;
  let usedJsFallback = false;

  // Start Layer 1 (Platform Store JSON APIs) in parallel with HTML parsing
  const platformPromise = tryPlatformJsonApis(
    origin,
    finalUrl,
    initialFetch.html,
    targetMaxResults,
  );

  let htmlInfo = {
    imgCount: 0,
    isSpaShell: true,
    scriptSrcs: [] as string[],
    catalogLinks: [] as string[],
  };

  if (initialFetch.html) {
    htmlInfo = collectCandidatesFromHtml(initialFetch.html, finalUrl, rawCandidates);
  }

  const platformCandidates = await platformPromise;
  rawCandidates.push(...platformCandidates);

  // Layer 2 & 3: If main page still has few candidates, scan SPA JS bundles + internal catalog pages
  const parallelExtraTasks: Array<Promise<void>> = [];

  if (htmlInfo.isSpaShell && htmlInfo.scriptSrcs.length > 0 && platformCandidates.length < 6) {
    parallelExtraTasks.push(
      scanSpaJsBundles(htmlInfo.scriptSrcs, finalUrl).then((bundleItems) => {
        rawCandidates.push(...bundleItems);
      }),
    );
  }

  if (
    rawCandidates.length < Math.ceil(targetMaxResults * 1.4) &&
    platformCandidates.length < targetMaxResults
  ) {
    parallelExtraTasks.push(
      (async () => {
        let subpages = htmlInfo.catalogLinks;
        if (subpages.length === 0) {
          subpages = await discoverSitemapCatalogUrls(origin);
        }
        if (subpages.length === 0) return;

        const subResults = await Promise.allSettled(
          subpages.slice(0, subpageCap).map((subUrl) =>
            fetchHtmlWithFallback(subUrl, 4500),
          ),
        );

        for (const res of subResults) {
          if (res.status === 'fulfilled' && res.value.html) {
            pagesScanned++;
            collectCandidatesFromHtml(res.value.html, res.value.finalUrl, rawCandidates);
          }
        }
      })(),
    );
  }

  if (parallelExtraTasks.length > 0) {
    await Promise.allSettled(parallelExtraTasks);
  }

  // Canonical deduplication: collapse same-image size/format variants and keep highest-res URL
  const dedupedMap = new Map<string, RawCandidate>();
  const addToDeduped = (items: RawCandidate[]) => {
    for (const item of items) {
      if (isJunkCandidateUrl(item.url)) continue;
      const canonicalKey = computeCanonicalImageKey(item.url);
      const existing = dedupedMap.get(canonicalKey);
      if (!existing) {
        dedupedMap.set(canonicalKey, item);
      } else {
        if (!existing.alt && item.alt) existing.alt = item.alt;
        if (item.priority < existing.priority) existing.priority = item.priority;

        const incomingRes = estimateUrlResolutionScore(item.url);
        const existingRes = estimateUrlResolutionScore(existing.url);
        if (incomingRes > existingRes) {
          existing.url = item.url;
          existing.sourcePageUrl = item.sourcePageUrl;
        }
      }
    }
  };

  addToDeduped(rawCandidates);

  // Layer 4: If direct HTML + Platform APIs + JS Bundles + Multi-Page Crawl still found < 5 candidates (or site returned 403/429), invoke JS-render fallback
  if (dedupedMap.size < 5) {
    const jsFallback = await tryJsRenderedFallback(finalUrl);
    if (jsFallback.candidates.length > 0) {
      addToDeduped(jsFallback.candidates);
      usedJsFallback = jsFallback.usedJsFallback;
    }
  }

  const orderedCandidates = Array.from(dedupedMap.values())
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return estimateUrlResolutionScore(b.url) - estimateUrlResolutionScore(a.url);
    })
    .slice(0, probeCap);

  // Wave-based dimension probing with safe HD upgrade + aspect ratio filtering
  const validItems: ExtractedCatalogImage[] = [];
  const mediumFallbackItems: ExtractedCatalogImage[] = [];
  const emittedCanonicalKeys = new Set<string>();

  const toExtractedItem = (
    candidate: RawCandidate,
    resolvedUrl: string,
    dims: { width: number; height: number },
    index: number,
  ): ExtractedCatalogImage => {
    const cleanUrl = buildCleanDisplayUrl(resolvedUrl);
    const proxyParams = new URLSearchParams({
      url: resolvedUrl,
      ref: candidate.sourcePageUrl,
    });

    return {
      id: `ext-${index + 1}-${Buffer.from(resolvedUrl).toString('base64url').slice(0, 10)}`,
      url: `/api/image-proxy?${proxyParams.toString()}`,
      originalUrl: resolvedUrl,
      cleanUrl,
      sourcePageUrl: resolvedUrl,
      alt: candidate.alt || deriveTitleFromUrl(resolvedUrl),
      width: dims.width,
      height: dims.height,
    };
  };

  const pushVerifiedEntry = (
    candidate: RawCandidate,
    resolvedUrl: string,
    dims: { width: number; height: number },
  ): boolean => {
    const finalCanonicalKey = computeCanonicalImageKey(resolvedUrl);
    if (emittedCanonicalKeys.has(finalCanonicalKey)) return false;

    if (isCatalogFriendlyDimensions(dims.width, dims.height, MIN_DIMENSION_PX)) {
      emittedCanonicalKeys.add(finalCanonicalKey);
      validItems.push(toExtractedItem(candidate, resolvedUrl, dims, validItems.length));
      return true;
    }

    if (
      isCatalogFriendlyDimensions(dims.width, dims.height, FALLBACK_MIN_DIMENSION_PX) &&
      mediumFallbackItems.length < targetMaxResults
    ) {
      emittedCanonicalKeys.add(finalCanonicalKey);
      mediumFallbackItems.push(
        toExtractedItem(candidate, resolvedUrl, dims, mediumFallbackItems.length),
      );
    }

    return false;
  };

  for (
    let i = 0;
    i < orderedCandidates.length && validItems.length < targetMaxResults;
    i += PROBE_WAVE_SIZE
  ) {
    const wave = orderedCandidates.slice(i, i + PROBE_WAVE_SIZE);
    const probed = await mapWithConcurrency(wave, PROBE_CONCURRENCY, async (candidate) => {
      const result = await probeCandidateWithHdUpgrade(candidate.url, candidate.sourcePageUrl);
      if (!result) return null;
      return { candidate, ...result };
    });

    for (const entry of probed) {
      if (!entry) continue;
      pushVerifiedEntry(entry.candidate, entry.resolvedUrl, entry.dims);
      if (validItems.length >= targetMaxResults) break;
    }
  }

  // Last-resort JS fallback if 0 images >= 200x200 passed aspect-ratio + catalog checks
  if (validItems.length === 0 && !usedJsFallback) {
    const jsFallback = await tryJsRenderedFallback(finalUrl);
    if (jsFallback.candidates.length > 0) {
      usedJsFallback = jsFallback.usedJsFallback;
      const fallbackOnly = jsFallback.candidates
        .filter((c) => !dedupedMap.has(computeCanonicalImageKey(c.url)))
        .slice(0, 32);
      const probed = await mapWithConcurrency(fallbackOnly, PROBE_CONCURRENCY, async (candidate) => {
        const result = await probeCandidateWithHdUpgrade(candidate.url, candidate.sourcePageUrl);
        if (!result) return null;
        return { candidate, ...result };
      });
      for (const entry of probed) {
        if (!entry) continue;
        pushVerifiedEntry(entry.candidate, entry.resolvedUrl, entry.dims);
        if (validItems.length >= targetMaxResults) break;
      }
    }
  }

  const finalImages = validItems.length > 0 ? validItems : mediumFallbackItems;

  return {
    sourceUrl: finalUrl,
    images: finalImages,
    totalCandidates: dedupedMap.size,
    pagesScanned,
    usedJsFallback,
  };
}
