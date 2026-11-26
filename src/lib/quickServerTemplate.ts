import { createZipBlob } from './schemaExport';

export type QuickServerFileLang = 'js' | 'json' | 'env' | 'md';

export interface QuickServerFile {
  id: string;
  name: string;
  lang: QuickServerFileLang;
  code: string;
}

const SERVER_MJS_CODE = `import http from 'node:http';
import { verifyWebhookSignature } from './security.mjs';
import {
  applyWebhookSync,
  buildCatalogSchema,
  loadStore,
  searchCatalog,
} from './storage.mjs';

const PORT = Number(process.env.PORT || 3000);
const WEBHOOK_SECRET = (process.env.SEARCHLINK_WEBHOOK_SECRET || '').trim();
const CATALOG_API_KEY = (process.env.CATALOG_API_KEY || '').trim();
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isCatalogAuthorized(req, url) {
  if (!CATALOG_API_KEY) return true;
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';
  const headerKey = String(req.headers['x-api-key'] || '').trim();
  const queryKey = String(url.searchParams.get('key') || '').trim();
  return [bearer, headerKey, queryKey].includes(CATALOG_API_KEY);
}

await loadStore();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', \`http://\${req.headers.host || 'localhost'}\`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, status: 'ready' });
  }

  if (req.method === 'POST' && (url.pathname === '/webhook' || url.pathname === '/')) {
    if (!WEBHOOK_SECRET) {
      return sendJson(res, 500, {
        ok: false,
        error: 'Missing SEARCHLINK_WEBHOOK_SECRET environment variable.',
      });
    }

    try {
      const rawBody = await readRawBody(req);
      const isValid = verifyWebhookSignature({
        rawBody,
        timestampHeader: req.headers['x-searchlink-timestamp'],
        signatureHeader: req.headers['x-searchlink-signature'],
        secret: WEBHOOK_SECRET,
      });

      if (!isValid) {
        return sendJson(res, 401, { ok: false, error: 'Invalid webhook signature.' });
      }

      const payload = JSON.parse(rawBody);
      const summary = await applyWebhookSync(payload);
      return sendJson(res, 200, { ok: true, ...summary });
    } catch (err) {
      return sendJson(res, 400, {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid request payload.',
      });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/schema') {
    if (!isCatalogAuthorized(req, url)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }
    const baseUrl = \`\${url.protocol}//\${req.headers.host || 'localhost'}\`;
    return sendJson(res, 200, buildCatalogSchema(baseUrl));
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    if (!isCatalogAuthorized(req, url)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }
    const result = searchCatalog({
      slug: url.searchParams.get('slug') || url.searchParams.get('service') || '',
      query:
        url.searchParams.get('q') ||
        url.searchParams.get('search') ||
        url.searchParams.get('buscar') ||
        '',
      categoria:
        url.searchParams.get('categoria') ||
        url.searchParams.get('category') ||
        '',
      limit: Number(url.searchParams.get('limit') || 25),
      offset: Number(url.searchParams.get('offset') || 0),
    });
    return sendJson(res, result.ok ? 200 : 404, result);
  }

  return sendJson(res, 404, { ok: false, error: 'Route not found.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Agency server listening on port \${PORT}\`);
});
`;

const STORAGE_MJS_CODE = `import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve(process.env.DATA_FILE || './data/catalog.json');

let state = {
  organizacion: { nombre: 'Organization', logo_url: null },
  servicios: [],
  lastSyncedAt: null,
};

const SEARCH_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'y', 'o', 'u',
  'the', 'an', 'of', 'in', 'on', 'with', 'for', 'and', 'or', 'to',
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'do', 'da', 'dos', 'das', 'em', 'com', 'e', 'ou',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function tokenizeQuery(rawQuery) {
  const normalized = normalizeText(rawQuery);
  if (!normalized) return [];
  const rawTokens = normalized.split(' ').filter(Boolean);
  const meaningful = rawTokens.filter((token) => !SEARCH_STOPWORDS.has(token));
  return meaningful.length > 0 ? meaningful : rawTokens;
}

function tokenMatchesText(haystack, token) {
  if (!haystack || !token) return false;
  if (haystack.includes(token)) return true;
  if (token.length >= 5 && token.endsWith('es') && haystack.includes(token.slice(0, -2))) {
    return true;
  }
  if (token.length >= 4 && token.endsWith('s') && haystack.includes(token.slice(0, -1))) {
    return true;
  }
  return false;
}

export async function loadStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.servicios)) {
      state = {
        organizacion: parsed.organizacion || state.organizacion,
        servicios: parsed.servicios,
        lastSyncedAt: parsed.lastSyncedAt || null,
      };
    }
  } catch {
    // Starts cleanly with empty state before first webhook delivery
  }
}

async function persistStore() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = \`\${DATA_FILE}.tmp\`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tempPath, DATA_FILE);
}

export async function applyWebhookSync(payload) {
  if (!payload || !Array.isArray(payload.servicios)) {
    throw new Error('Missing servicios array in webhook payload.');
  }

  if (payload.organizacion) {
    state.organizacion = {
      nombre: String(payload.organizacion.nombre || 'Organization'),
      logo_url: payload.organizacion.logo_url || null,
    };
  }

  if (payload.scope === 'all' && payload.event === 'searchlink.catalog.sync') {
    state.servicios = payload.servicios;
  } else {
    const byId = new Map(state.servicios.map((srv) => [String(srv.id), srv]));
    for (const incoming of payload.servicios) {
      if (incoming && incoming.id) {
        byId.set(String(incoming.id), incoming);
      }
    }
    state.servicios = Array.from(byId.values());
  }

  state.lastSyncedAt = String(payload.synced_at || new Date().toISOString());
  await persistStore();

  const totalProducts = state.servicios.reduce(
    (sum, srv) => sum + (Array.isArray(srv.productos) ? srv.productos.length : 0),
    0,
  );

  return {
    event: payload.event || 'searchlink.catalog.sync',
    synced_services: payload.servicios.length,
    stored_services: state.servicios.length,
    stored_products: totalProducts,
  };
}

export function searchCatalog({ slug, query, categoria, limit, offset }) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const matchedBySlug = cleanSlug
    ? state.servicios.filter(
        (srv) =>
          String(srv.slug || '').toLowerCase() === cleanSlug ||
          String(srv.id || '').toLowerCase() === cleanSlug,
      )
    : [];

  if (cleanSlug && matchedBySlug.length === 0) {
    return { ok: false, error: 'Service not found in external server.' };
  }

  const selected = (cleanSlug ? matchedBySlug : state.servicios).filter(
    (srv) => srv.activo !== false,
  );

  if (cleanSlug && selected.length === 0) {
    return { ok: false, error: 'Service is paused or unavailable.' };
  }

  const allProducts = selected.flatMap((srv) =>
    (Array.isArray(srv.productos) ? srv.productos : []).map((prod) => ({
      ...prod,
      servicio_slug: srv.slug,
      servicio_nombre: srv.nombre,
    })),
  );

  const normQuery = normalizeText(query);
  const queryTokens = tokenizeQuery(query);
  const normCategory = normalizeText(categoria);

  const scored = [];
  for (let idx = 0; idx < allProducts.length; idx += 1) {
    const item = allProducts[idx];
    const normItemCategory = normalizeText(item.categoria);
    if (normCategory && !normItemCategory.includes(normCategory)) {
      continue;
    }

    if (queryTokens.length === 0) {
      scored.push({ item, score: 0, index: idx });
      continue;
    }

    const normName = normalizeText(item.nombre);
    const normDesc = normalizeText(item.descripcion);
    const normService = normalizeText(item.servicio_nombre);
    const combined = \`\${normName} \${normItemCategory} \${normDesc} \${normService}\`.trim();

    let allMatched = true;
    let score = 0;

    if (normQuery && normName.includes(normQuery)) {
      score += 100;
    } else if (normQuery && combined.includes(normQuery)) {
      score += 40;
    }

    for (const token of queryTokens) {
      if (!tokenMatchesText(combined, token)) {
        allMatched = false;
        break;
      }
      if (tokenMatchesText(normName, token)) {
        score += 20;
      } else if (tokenMatchesText(normItemCategory, token)) {
        score += 10;
      } else {
        score += 5;
      }
    }

    if (allMatched) {
      scored.push({ item, score, index: idx });
    }
  }

  if (queryTokens.length > 0) {
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
  }

  const filtered = scored.map((entry) => entry.item);

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const items = filtered.slice(safeOffset, safeOffset + safeLimit);
  const categories = Array.from(
    new Set(allProducts.map((item) => item.categoria).filter(Boolean)),
  );

  return {
    ok: true,
    organizacion: state.organizacion,
    synced_at: state.lastSyncedAt,
    filtros: {
      slug: cleanSlug || null,
      q: query || null,
      categoria: categoria || null,
      categorias_disponibles: categories,
    },
    paginacion: {
      total: filtered.length,
      devueltos: items.length,
      limit: safeLimit,
      offset: safeOffset,
    },
    productos: items,
  };
}

export function buildCatalogSchema(baseUrl) {
  return {
    version: '1.0',
    organizacion: state.organizacion,
    endpoints: {
      webhook: \`\${baseUrl}/webhook\`,
      catalog: \`\${baseUrl}/api/catalog\`,
    },
    query_params: ['slug', 'q', 'categoria', 'limit', 'offset'],
    servicios: state.servicios
      .filter((srv) => srv.activo !== false)
      .map((srv) => ({
        id: srv.id,
        slug: srv.slug,
        nombre: srv.nombre,
        total_productos: Array.isArray(srv.productos) ? srv.productos.length : 0,
        categorias: Array.from(
          new Set((srv.productos || []).map((p) => p.categoria).filter(Boolean)),
        ),
      })),
  };
}
`;

const SECURITY_MJS_CODE = `import crypto from 'node:crypto';

const MAX_CLOCK_SKEW_SEC = 300;

export function verifyWebhookSignature({
  rawBody,
  timestampHeader,
  signatureHeader,
  secret,
}) {
  const timestamp = Array.isArray(timestampHeader)
    ? timestampHeader[0]
    : String(timestampHeader || '').trim();
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : String(signatureHeader || '').trim();

  if (!timestamp || !signature || !secret) return false;

  const parsedTs = Number(timestamp);
  if (!Number.isFinite(parsedTs)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsedTs) > MAX_CLOCK_SKEW_SEC) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`, 'utf8')
    .digest('hex');

  const expectedHeader = \`sha256=\${expectedHex}\`;
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expectedHeader, 'utf8');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
`;

const PACKAGE_JSON_CODE = `{
  "name": "agency-catalog-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node server.mjs"
  }
}
`;

function buildEnvExampleCode(secretKey?: string): string {
  const cleanSecret = (secretKey || '').trim() || 'sl_whsec_replace_with_your_secret_key';
  return [
    'PORT=3000',
    `SEARCHLINK_WEBHOOK_SECRET=${cleanSecret}`,
    'DATA_FILE=./data/catalog.json',
    '# Optional: set a key to protect GET /api/catalog and GET /api/schema',
    'CATALOG_API_KEY=',
    '',
  ].join('\n');
}

const README_MD_CODE = `# Agency Catalog Server

Lightweight Node.js server with zero external dependencies designed to receive
signed catalog webhooks and serve live product search to any AI agent or bot.

## Quick Start

1. Copy \`.env.example\` to \`.env\` and ensure \`SEARCHLINK_WEBHOOK_SECRET\`
   matches your secret key.
2. Start the server:

\`\`\`bash
npm start
\`\`\`

3. Deploy on any Node.js host (Railway, Render, Fly.io, VPS) and paste your
   public \`https://your-domain.com/webhook\` URL to sync.

## Endpoints

- \`POST /webhook\` — Verifies \`X-SearchLink-Signature\` and updates local storage.
- \`GET /api/catalog\` — Query products (\`?slug=...&q=...&categoria=...&limit=25\`).
- \`GET /api/schema\` — Returns synced service slugs, categories, and schema info.
- \`GET /health\` — Simple readiness check.
`;

export function buildQuickServerFiles(secretKey?: string): QuickServerFile[] {
  return [
    { id: 'server', name: 'server.mjs', lang: 'js', code: SERVER_MJS_CODE },
    { id: 'storage', name: 'storage.mjs', lang: 'js', code: STORAGE_MJS_CODE },
    { id: 'security', name: 'security.mjs', lang: 'js', code: SECURITY_MJS_CODE },
    { id: 'pkg', name: 'package.json', lang: 'json', code: PACKAGE_JSON_CODE },
    { id: 'env', name: '.env.example', lang: 'env', code: buildEnvExampleCode(secretKey) },
    { id: 'readme', name: 'README.md', lang: 'md', code: README_MD_CODE },
  ];
}

export function downloadQuickServerZip(secretKey?: string): void {
  const files = buildQuickServerFiles(secretKey);
  const blob = createZipBlob(
    files.map((file) => ({
      name: `quick-server/${file.name}`,
      content: file.code,
    })),
  );

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = 'quick-server.zip';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 4000);
}
