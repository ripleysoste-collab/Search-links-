import type { LegalDocId } from '../components/LegalDocumentPage';

export const PRIVACY_POLICY_PATH = '/politicas-de-privacidad';
export const TERMS_AND_CONDITIONS_PATH = '/terminos-y-condiciones';
export const CONTENT_POLICY_PATH = '/politicas-de-contenido';
export const COOKIE_POLICY_PATH = '/politicas-de-cookies';
export const AGENCY_MODE_PATH = '/modo-agencia';
export const AGENCY_GUIDE_PATH = '/cosas-a-tener-en-cuenta-modo-agencia';
export const AGENCY_LIABILITY_PATH = '/responsabilidad-modo-agencia';
export const INTELLECTUAL_PROPERTY_PATH = '/propiedad-intelectual-y-responsabilidad';
export const IMAGE_BANK_PATH = '/banco-publico';

export const LOGIN_PATH = '/login';
export const GOOGLE_ACCOUNT_PATH = '/cuenta-google';
export const ADVANCED_SETTINGS_PATH = '/ajustes-avanzados';
export const ORGANIZATION_PATH = '/organizacion';
export const CONNECT_SERVER_PATH = '/conectar-servidor';
export const LANGUAGE_PATH = '/idioma';
export const STORE_PATH = '/mi-tienda';
export const SCHEMA_PATH = '/esquema';
export const VIEW_API_PATH = '/ver-api';
export const TEST_ENDPOINT_PATH = '/probar-endpoint';
export const TRAFFIC_PATH = '/trafico';
export const TRAFFIC_LIMIT_PATH = '/limitar';
export const SEARCH_IA_PATH = '/search-ia';

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'login' }
  | { kind: 'image-bank' }
  | { kind: 'doc'; docId: LegalDocId }
  | { kind: 'google-account' }
  | { kind: 'advanced-settings' }
  | { kind: 'organization' }
  | { kind: 'connect-server' }
  | { kind: 'language' }
  | { kind: 'store'; slug?: string }
  | { kind: 'schema'; slug?: string }
  | { kind: 'api-key'; slug?: string }
  | { kind: 'endpoint-test'; slug?: string }
  | { kind: 'traffic'; slug?: string }
  | { kind: 'traffic-limit'; slug?: string }
  | { kind: 'search-ia'; slug?: string };

const PRIVACY_POLICY_ALIASES = new Set([
  '/politicas-de-privacidad',
  '/politica-de-privacidad',
  '/privacidad',
  '/privacy',
  '/privacidade',
  '/politicas-de-privacidade',
]);

const TERMS_ALIASES = new Set([
  '/terminos-y-condiciones',
  '/terminos',
  '/terms-and-conditions',
  '/terms',
  '/termos-e-condicoes',
  '/termos',
]);

const CONTENT_POLICY_ALIASES = new Set([
  '/politicas-de-contenido',
  '/politica-de-contenido',
  '/content-policies',
  '/content-policy',
  '/politicas-de-conteudo',
  '/politica-de-conteudo',
]);

const COOKIE_POLICY_ALIASES = new Set([
  '/politicas-de-cookies',
  '/politica-de-cookies',
  '/cookie-policies',
  '/cookie-policy',
  '/cookies',
]);

const AGENCY_MODE_ALIASES = new Set([
  '/modo-agencia',
  '/modo-desarrollador',
  '/agency-mode',
  '/developer-mode',
  '/modo-agencia-desarrollo',
]);

const AGENCY_GUIDE_ALIASES = new Set([
  '/cosas-a-tener-en-cuenta-modo-agencia',
  '/guia-modo-agencia',
  '/informacion-modo-agencia',
  '/agency-guide',
  '/agency-mode-guide',
  '/things-to-keep-in-mind-agency-mode',
  '/o-que-considerar-modo-agencia',
]);

const AGENCY_LIABILITY_ALIASES = new Set([
  '/responsabilidad-modo-agencia',
  '/responsabilidad-agencia',
  '/propiedad-modo-agencia',
  '/agency-liability',
  '/agency-mode-liability',
  '/responsabilidade-modo-agencia',
]);

const INTELLECTUAL_PROPERTY_ALIASES = new Set([
  '/propiedad-intelectual-y-responsabilidad',
  '/propiedad-intelectual',
  '/limites-y-responsabilidad',
  '/responsabilidad',
  '/intellectual-property',
  '/intellectual-property-and-liability',
  '/liability',
  '/dmca',
  '/propriedade-intelectual-e-responsabilidade',
  '/propriedade-intelectual',
  '/responsabilidade',
]);

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed ? trimmed.toLowerCase() : '/';
}

export function isImageBankPathname(pathname: string): boolean {
  return normalizePathname(pathname) === IMAGE_BANK_PATH;
}

export function isAuthCallbackPathname(pathname: string): boolean {
  return normalizePathname(pathname) === '/auth/callback';
}

export function resolveLegalDocRouteFromPathname(pathname: string): LegalDocId | null {
  const normalized = normalizePathname(pathname);
  if (PRIVACY_POLICY_ALIASES.has(normalized)) return 'privacy';
  if (TERMS_ALIASES.has(normalized)) return 'terms';
  if (CONTENT_POLICY_ALIASES.has(normalized)) return 'content';
  if (COOKIE_POLICY_ALIASES.has(normalized)) return 'cookies';
  if (AGENCY_MODE_ALIASES.has(normalized)) return 'agency';
  if (AGENCY_GUIDE_ALIASES.has(normalized)) return 'agency-guide';
  if (AGENCY_LIABILITY_ALIASES.has(normalized)) return 'agency-liability';
  if (INTELLECTUAL_PROPERTY_ALIASES.has(normalized)) return 'liability';
  return null;
}

export function getCanonicalLegalDocPath(docId: LegalDocId): string {
  if (docId === 'terms') return TERMS_AND_CONDITIONS_PATH;
  if (docId === 'content') return CONTENT_POLICY_PATH;
  if (docId === 'cookies') return COOKIE_POLICY_PATH;
  if (docId === 'agency') return AGENCY_MODE_PATH;
  if (docId === 'agency-guide') return AGENCY_GUIDE_PATH;
  if (docId === 'agency-liability') return AGENCY_LIABILITY_PATH;
  if (docId === 'liability') return INTELLECTUAL_PROPERTY_PATH;
  return PRIVACY_POLICY_PATH;
}

function decodeSlugSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    const clean = decodeURIComponent(segment).trim();
    return clean || undefined;
  } catch {
    return segment.trim() || undefined;
  }
}

export function parseAppRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname);

  const docId = resolveLegalDocRouteFromPathname(normalized);
  if (docId) return { kind: 'doc', docId };

  if (normalized === LOGIN_PATH) return { kind: 'login' };
  if (normalized === IMAGE_BANK_PATH) return { kind: 'image-bank' };
  if (normalized === GOOGLE_ACCOUNT_PATH) return { kind: 'google-account' };
  if (normalized === ADVANCED_SETTINGS_PATH) return { kind: 'advanced-settings' };
  if (normalized === ORGANIZATION_PATH) return { kind: 'organization' };
  if (normalized === CONNECT_SERVER_PATH) return { kind: 'connect-server' };
  if (normalized === LANGUAGE_PATH) return { kind: 'language' };

  if (normalized === STORE_PATH || normalized.startsWith(`${STORE_PATH}/`)) {
    const rest = normalized.slice(STORE_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'store', slug: decodeSlugSegment(firstSeg) };
  }

  if (normalized === SCHEMA_PATH || normalized.startsWith(`${SCHEMA_PATH}/`)) {
    const rest = normalized.slice(SCHEMA_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'schema', slug: decodeSlugSegment(firstSeg) };
  }

  if (normalized === VIEW_API_PATH || normalized.startsWith(`${VIEW_API_PATH}/`)) {
    const rest = normalized.slice(VIEW_API_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'api-key', slug: decodeSlugSegment(firstSeg) };
  }

  if (
    normalized === TEST_ENDPOINT_PATH ||
    normalized.startsWith(`${TEST_ENDPOINT_PATH}/`)
  ) {
    const rest = normalized.slice(TEST_ENDPOINT_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'endpoint-test', slug: decodeSlugSegment(firstSeg) };
  }

  if (normalized === TRAFFIC_PATH || normalized.startsWith(`${TRAFFIC_PATH}/`)) {
    const rest = normalized.slice(TRAFFIC_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'traffic', slug: decodeSlugSegment(firstSeg) };
  }

  if (
    normalized === TRAFFIC_LIMIT_PATH ||
    normalized.startsWith(`${TRAFFIC_LIMIT_PATH}/`)
  ) {
    const rest = normalized.slice(TRAFFIC_LIMIT_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'traffic-limit', slug: decodeSlugSegment(firstSeg) };
  }

  if (normalized === SEARCH_IA_PATH || normalized.startsWith(`${SEARCH_IA_PATH}/`)) {
    const rest = normalized.slice(SEARCH_IA_PATH.length).replace(/^\/+/, '');
    const firstSeg = rest.split('/')[0];
    return { kind: 'search-ia', slug: decodeSlugSegment(firstSeg) };
  }

  return { kind: 'home' };
}

export function buildAppRoutePath(route: AppRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'login':
      return LOGIN_PATH;
    case 'image-bank':
      return IMAGE_BANK_PATH;
    case 'doc':
      return getCanonicalLegalDocPath(route.docId);
    case 'google-account':
      return GOOGLE_ACCOUNT_PATH;
    case 'advanced-settings':
      return ADVANCED_SETTINGS_PATH;
    case 'organization':
      return ORGANIZATION_PATH;
    case 'connect-server':
      return CONNECT_SERVER_PATH;
    case 'language':
      return LANGUAGE_PATH;
    case 'store':
      return route.slug
        ? `${STORE_PATH}/${encodeURIComponent(route.slug)}`
        : STORE_PATH;
    case 'schema':
      return route.slug
        ? `${SCHEMA_PATH}/${encodeURIComponent(route.slug)}`
        : SCHEMA_PATH;
    case 'api-key':
      return route.slug
        ? `${VIEW_API_PATH}/${encodeURIComponent(route.slug)}`
        : VIEW_API_PATH;
    case 'endpoint-test':
      return route.slug
        ? `${TEST_ENDPOINT_PATH}/${encodeURIComponent(route.slug)}`
        : TEST_ENDPOINT_PATH;
    case 'traffic':
      return route.slug
        ? `${TRAFFIC_PATH}/${encodeURIComponent(route.slug)}`
        : TRAFFIC_PATH;
    case 'traffic-limit':
      return route.slug
        ? `${TRAFFIC_LIMIT_PATH}/${encodeURIComponent(route.slug)}`
        : TRAFFIC_LIMIT_PATH;
    case 'search-ia':
      return route.slug
        ? `${SEARCH_IA_PATH}/${encodeURIComponent(route.slug)}`
        : SEARCH_IA_PATH;
  }
}

export function isProtectedAppRoute(route: AppRoute): boolean {
  return (
    route.kind === 'google-account' ||
    route.kind === 'advanced-settings' ||
    route.kind === 'organization' ||
    route.kind === 'connect-server' ||
    route.kind === 'language' ||
    route.kind === 'store' ||
    route.kind === 'schema' ||
    route.kind === 'api-key' ||
    route.kind === 'endpoint-test' ||
    route.kind === 'traffic' ||
    route.kind === 'traffic-limit' ||
    route.kind === 'search-ia'
  );
}
