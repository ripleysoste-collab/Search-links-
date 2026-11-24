import type { SupportedLocale } from './i18n';
import { buildCoreServiceEndpointUrl } from './searchLinkCore';

interface SchemaExportInput {
  serviceName: string;
  serviceSlug?: string;
  endpointUrl?: string;
  organizationName?: string;
  categories?: string[];
  totalProducts?: number;
  locale?: SupportedLocale;
}

interface ZipEntryInput {
  name: string;
  content: string | Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

/**
 * Pure TypeScript PKZIP builder (Store compression method 0 with UTF-8 flag 0x0800).
 * Produces a universally valid .zip archive without external dependencies.
 */
function createZipBlob(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosTime, dosDate } = getDosDateTime(now);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanName = entry.name.replace(/^\/+/, '');
    const nameBytes = encoder.encode(cleanName);
    const dataBytes =
      typeof entry.content === 'string'
        ? encoder.encode(entry.content)
        : entry.content;
    const crc = computeCrc32(dataBytes);

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose bit flag: UTF-8 filename
    lv.setUint16(8, 0, true); // Compression method: 0 (store)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true); // Compressed size
    lv.setUint32(22, dataBytes.length, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectorySize = centralParts.reduce(
    (sum, part) => sum + part.length,
    0,
  );

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectorySize, true);
  ev.setUint32(16, offset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // ZIP file comment length

  const totalLength = offset + centralDirectorySize + eocd.length;
  const archive = new Uint8Array(totalLength);
  let cursor = 0;

  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);

  return new Blob([archive], { type: 'application/zip' });
}

function resolveSlugAndEndpoint(input: SchemaExportInput): {
  slug: string;
  endpointUrl: string;
  serverOrigin: string;
  servicePath: string;
} {
  const rawSlug = (input.serviceSlug || '').trim();
  let endpointUrl = (input.endpointUrl || '').trim();
  let slug = rawSlug;

  if (!slug && endpointUrl) {
    const match = endpointUrl.match(/\/api\/v1\/services\/([^/?#]+)/i);
    if (match?.[1]) {
      try {
        slug = decodeURIComponent(match[1]);
      } catch {
        slug = match[1];
      }
    }
  }

  if (!slug) {
    slug = 'srv_catalog';
  }

  if (!endpointUrl) {
    endpointUrl = buildCoreServiceEndpointUrl(slug);
  }

  let serverOrigin = 'https://search-links.onrender.com';
  let servicePath = `/api/v1/services/${encodeURIComponent(slug)}`;

  try {
    const parsed = new URL(endpointUrl);
    serverOrigin = parsed.origin;
    servicePath = parsed.pathname || servicePath;
  } catch {
    if (typeof window !== 'undefined' && window.location?.origin) {
      serverOrigin = window.location.origin;
    }
  }

  return { slug, endpointUrl, serverOrigin, servicePath };
}

function normalizeCategories(categories?: string[]): string[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const cat of categories) {
    const trimmed = typeof cat === 'string' ? cat.trim() : '';
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  return clean;
}

function getSafeOrgName(name?: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed === 'Sin nombre') return 'Search Link Organization';
  return trimmed;
}

function buildServiceOpenApiSchemaObject(
  input: SchemaExportInput,
): Record<string, unknown> {
  const { serverOrigin, servicePath } = resolveSlugAndEndpoint(input);
  const serviceName = (input.serviceName || '').trim() || 'Catálogo Search Link';
  const orgName = getSafeOrgName(input.organizationName);
  const categories = normalizeCategories(input.categories);
  const categoriesHint =
    categories.length > 0
      ? ` Categorías detectadas: ${categories.slice(0, 12).join(', ')}.`
      : '';

  return {
    openapi: '3.1.0',
    info: {
      title: `${serviceName} · Search Link Core API`,
      version: '1.0.0',
      description: `Esquema oficial de conexión para bots y agentes IA de ${orgName}. Permite buscar productos en vivo y obtener URLs WebP optimizadas listas para WhatsApp, Telegram, web chat o automatizaciones.${categoriesHint}`,
    },
    servers: [
      {
        url: serverOrigin,
        description: 'Search Link Core Production API',
      },
    ],
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    paths: {
      [servicePath]: {
        get: {
          operationId: 'searchCatalogProducts',
          summary: `Consultar catálogo en vivo de ${serviceName}`,
          description:
            'Busca y filtra productos publicados del catálogo. Devuelve nombres, categorías, descripciones e URLs de imagen limpias e inmutables.',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: false,
              description:
                'Texto libre para buscar coincidencias por nombre, categoría o descripción.',
              schema: { type: 'string' },
            },
            {
              name: 'categoria',
              in: 'query',
              required: false,
              description: `Filtro por categoría de producto.${categoriesHint}`,
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Cantidad máxima de resultados por consulta (1 a 100).',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 20,
              },
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              description: 'Desplazamiento para paginación de resultados.',
              schema: {
                type: 'integer',
                minimum: 0,
                default: 0,
              },
            },
          ],
          responses: {
            '200': {
              description: 'Catálogo devuelto correctamente.',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SearchLinkCoreResponse',
                  },
                },
              },
            },
            '401': {
              description: 'API Key faltante, inválida o servicio pausado.',
            },
            '429': {
              description: 'Límite mensual de peticiones alcanzado.',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Tu API Key de Search Link Core (prefijo sl_core_...).',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Alternativa usando Authorization: Bearer <TU_API_KEY_SL_CORE>.',
        },
      },
      schemas: {
        SearchLinkCoreProduct: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nombre: { type: 'string' },
            categoria: { type: 'string' },
            descripcion: { type: 'string' },
            imagen_url: {
              type: 'string',
              format: 'uri',
              description: 'URL CDN WebP limpia lista para enviar en el bot.',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Alias compatible con imagen_url.',
            },
            ahorro_porcentaje: { type: 'number' },
          },
          required: ['id', 'nombre', 'categoria', 'descripcion', 'imagen_url', 'url'],
        },
        SearchLinkCoreResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            system: { type: 'string', example: 'Search Link Core' },
            version: { type: 'string', example: '1.0' },
            organizacion: {
              type: 'object',
              properties: {
                nombre: { type: 'string', example: orgName },
                logo_url: { type: ['string', 'null'] },
              },
            },
            servicio: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                slug: { type: 'string' },
                nombre: { type: 'string', example: serviceName },
                origen: { type: 'string' },
                origen_url: { type: ['string', 'null'] },
                creado_en: { type: 'string', format: 'date-time' },
              },
            },
            filtros: {
              type: 'object',
              properties: {
                q: { type: ['string', 'null'] },
                categoria: { type: ['string', 'null'] },
                categorias_disponibles: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            paginacion: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                devueltos: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
              },
            },
            total_productos: {
              type: 'integer',
              example: input.totalProducts ?? 0,
            },
            productos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SearchLinkCoreProduct',
              },
            },
          },
          required: [
            'ok',
            'system',
            'version',
            'organizacion',
            'servicio',
            'filtros',
            'paginacion',
            'total_productos',
            'productos',
          ],
        },
      },
    },
  };
}

export function buildServiceOpenApiSchemaJson(input: SchemaExportInput): string {
  return JSON.stringify(buildServiceOpenApiSchemaObject(input), null, 2);
}

function buildBotSystemPrompt(input: SchemaExportInput): string {
  const { endpointUrl } = resolveSlugAndEndpoint(input);
  const serviceName = (input.serviceName || '').trim() || 'Catálogo';
  const orgName = getSafeOrgName(input.organizationName);
  const categories = normalizeCategories(input.categories);
  const locale = input.locale || 'es';

  if (locale === 'en') {
    return [
      `You are the official shopping assistant for ${orgName} (${serviceName}).`,
      '',
      'CORE RULES:',
      '1. Always call the `searchCatalogProducts` tool/HTTP GET endpoint before answering product questions.',
      `2. Live endpoint: ${endpointUrl}`,
      '3. Pass query parameter `q` for user search terms or `categoria` when filtering a category.',
      '4. Never invent product names, prices, or image URLs. Always return the exact `imagen_url` returned by the API.',
      '5. Keep replies concise, helpful, and include only verified products from `productos[]`.',
      ...(categories.length > 0
        ? ['', `Available categories: ${categories.join(', ')}`]
        : []),
      '',
    ].join('\n');
  }

  if (locale === 'pt') {
    return [
      `Você é o assistente oficial do catálogo de ${orgName} (${serviceName}).`,
      '',
      'REGRAS PRINCIPAIS:',
      '1. Sempre consulte a ferramenta/endpoint `searchCatalogProducts` antes de responder sobre produtos.',
      `2. Endpoint ao vivo: ${endpointUrl}`,
      '3. Use o parâmetro `q` para buscas por palavra-chave ou `categoria` para filtrar por categoria.',
      '4. Nunca invente nomes nem URLs de imagens. Envie exatamente o campo `imagen_url` retornado pela API.',
      '5. Responda de forma clara e objetiva usando apenas os itens reais de `productos[]`.',
      ...(categories.length > 0
        ? ['', `Categorias disponíveis: ${categories.join(', ')}`]
        : []),
      '',
    ].join('\n');
  }

  return [
    `Eres el asistente oficial del catálogo de ${orgName} (${serviceName}).`,
    '',
    'REGLAS PRINCIPALES:',
    '1. Consulta siempre la herramienta o endpoint `searchCatalogProducts` antes de responder sobre productos.',
    `2. Endpoint en vivo: ${endpointUrl}`,
    '3. Envía el parámetro `q` para búsquedas por texto o `categoria` cuando el cliente pida una categoría específica.',
    '4. Nunca inventes productos ni enlaces de imagen. Usa siempre el campo exacto `imagen_url` devuelto por la API.',
    '5. Responde de forma amable y directa mostrando únicamente resultados reales de `productos[]`.',
    ...(categories.length > 0
      ? ['', `Categorías disponibles: ${categories.join(', ')}`]
      : []),
    '',
  ].join('\n');
}

function buildReadmeText(input: SchemaExportInput): string {
  const { endpointUrl, slug } = resolveSlugAndEndpoint(input);
  const serviceName = (input.serviceName || '').trim() || 'Servicio';
  const orgName = getSafeOrgName(input.organizationName);
  const locale = input.locale || 'es';

  if (locale === 'en') {
    return [
      `${orgName} — ${serviceName} · Search Link Core Integration Bundle`,
      '====================================================================',
      '',
      'Files included in this ZIP:',
      '- openapi-search-link.json     OpenAPI 3.1.0 schema (ChatGPT Actions, LangChain, Voiceflow, Botpress)',
      '- bot-integration-config.json  Quick HTTP config & query template for n8n, Make, WhatsApp & Telegram bots',
      '- bot-system-prompt.txt        Ready-to-paste AI agent instructions',
      '',
      'Connection details:',
      `- Service slug : ${slug}`,
      `- Endpoint URL : ${endpointUrl}`,
      '- Auth header  : x-api-key: <YOUR_SL_CORE_API_KEY>',
      '- Alt header   : Authorization: Bearer <YOUR_SL_CORE_API_KEY>',
      '',
      'Note: For security, this export uses a placeholder key. Copy or regenerate your',
      'full `sl_core_...` key inside Organization -> View API Key in Search Link.',
      '',
    ].join('\n');
  }

  if (locale === 'pt') {
    return [
      `${orgName} — ${serviceName} · Pacote de Integração Search Link Core`,
      '====================================================================',
      '',
      'Arquivos incluídos neste ZIP:',
      '- openapi-search-link.json     Esquema OpenAPI 3.1.0 (ChatGPT Actions, LangChain, Voiceflow, Botpress)',
      '- bot-integration-config.json  Configuração HTTP rápida para n8n, Make, WhatsApp e bots do Telegram',
      '- bot-system-prompt.txt        Prompt de sistema pronto para o seu agente de IA',
      '',
      'Dados de conexão:',
      `- Slug do serviço : ${slug}`,
      `- Endpoint URL    : ${endpointUrl}`,
      '- Header Auth     : x-api-key: <SUA_API_KEY_SL_CORE>',
      '- Alternativa     : Authorization: Bearer <SUA_API_KEY_SL_CORE>',
      '',
      'Nota de segurança: por proteção, este arquivo não inclui sua chave secreta real.',
      'Copie ou gere sua chave `sl_core_...` dentro de Organização -> Ver API Key.',
      '',
    ].join('\n');
  }

  return [
    `${orgName} — ${serviceName} · Paquete de Integración Search Link Core`,
    '====================================================================',
    '',
    'Archivos incluidos en este ZIP:',
    '- openapi-search-link.json     Esquema OpenAPI 3.1.0 (ChatGPT Actions, LangChain, Voiceflow, Botpress)',
    '- bot-integration-config.json  Configuración HTTP rápida para n8n, Make, WhatsApp y bots de Telegram',
    '- bot-system-prompt.txt        Instrucciones (System Prompt) listas para pegar en tu agente IA',
    '',
    'Datos de conexión:',
    `- Slug del servicio : ${slug}`,
    `- Endpoint URL      : ${endpointUrl}`,
    '- Header Auth       : x-api-key: <TU_API_KEY_SL_CORE>',
    '- Alternativa       : Authorization: Bearer <TU_API_KEY_SL_CORE>',
    '',
    'Nota de seguridad: por protección, este paquete usa un marcador para la API Key.',
    'Copia o regenera tu llave completa `sl_core_...` desde Organización -> Ver API Key.',
    '',
  ].join('\n');
}

function buildServiceSchemaBundleFiles(
  input: SchemaExportInput,
): Array<{ name: string; content: string }> {
  const { slug, endpointUrl } = resolveSlugAndEndpoint(input);
  const serviceName = (input.serviceName || '').trim() || 'Catálogo Search Link';
  const orgName = getSafeOrgName(input.organizationName);
  const categories = normalizeCategories(input.categories);

  const openApiJson = buildServiceOpenApiSchemaJson(input);
  const integrationConfig = JSON.stringify(
    {
      system: 'Search Link Core',
      version: '1.0',
      organization: orgName,
      service: {
        name: serviceName,
        slug,
        total_products: input.totalProducts ?? 0,
        categories,
      },
      http: {
        method: 'GET',
        endpoint_url: endpointUrl,
        headers: {
          'x-api-key': 'TU_API_KEY_SL_CORE',
        },
        query_params: {
          q: '',
          categoria: '',
          limit: 20,
          offset: 0,
        },
        curl_example: `curl -H "x-api-key: TU_API_KEY_SL_CORE" "${endpointUrl}?q=&limit=20"`,
      },
      response_mapping: {
        items_array: 'productos',
        name_field: 'nombre',
        category_field: 'categoria',
        description_field: 'descripcion',
        image_url_field: 'imagen_url',
      },
    },
    null,
    2,
  );

  return [
    { name: 'openapi-search-link.json', content: openApiJson },
    { name: 'bot-integration-config.json', content: integrationConfig },
    { name: 'bot-system-prompt.txt', content: buildBotSystemPrompt(input) },
    { name: 'README.txt', content: buildReadmeText(input) },
  ];
}

function sanitizeZipFilePrefix(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'search-link-schema';
}

export function downloadServiceSchemaZip(input: SchemaExportInput): void {
  const { slug } = resolveSlugAndEndpoint(input);
  const files = buildServiceSchemaBundleFiles(input);
  const blob = createZipBlob(files);
  const filePrefix = sanitizeZipFilePrefix(
    input.serviceSlug || input.serviceName || slug,
  );
  const filename = `${filePrefix}-search-link-schema.zip`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 4000);
}

interface ServiceLikeForSchema {
  name: string;
  slug?: string;
  endpointUrl: string;
  itemCount: number;
  products?: Array<{ categoria?: string }>;
  snapshot?: {
    mappedResults?: Record<string, { categoria?: string }>;
  };
}

export function buildSchemaInputFromService(
  service: ServiceLikeForSchema,
  organizationName?: string,
  locale?: SupportedLocale,
): SchemaExportInput {
  const categories: string[] = [];
  if (Array.isArray(service.products)) {
    for (const prod of service.products) {
      if (prod?.categoria) categories.push(prod.categoria);
    }
  }
  if (service.snapshot?.mappedResults) {
    for (const entry of Object.values(service.snapshot.mappedResults)) {
      if (entry?.categoria) categories.push(entry.categoria);
    }
  }

  return {
    serviceName: service.name,
    serviceSlug: service.slug,
    endpointUrl: service.endpointUrl,
    organizationName,
    categories,
    totalProducts: service.products?.length || service.itemCount,
    locale,
  };
}

