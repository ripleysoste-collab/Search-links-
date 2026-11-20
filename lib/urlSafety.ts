import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
]);

export function normalizeTargetUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Por favor ingresa una URL válida.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('La URL no tiene un formato válido.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten direcciones web http:// o https://.');
  }

  if (!parsed.hostname || parsed.hostname.length > 253) {
    throw new Error('El dominio de la URL no es válido.');
  }

  return parsed.href;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 127) return true; // Loopback 127.0.0.0/8
  if (a === 169 && b === 254) return true; // Link-local / Cloud metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
  if (a >= 224) return true; // Multicast & reserved

  return false;
}

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  const zoneIndex = lower.indexOf('%');
  const cleanIp = zoneIndex >= 0 ? lower.slice(0, zoneIndex) : lower;

  if (net.isIPv4(cleanIp)) {
    return isPrivateIpv4(cleanIp);
  }

  if (net.isIPv6(cleanIp)) {
    if (cleanIp === '::' || cleanIp === '::1') return true;
    if (cleanIp.startsWith('::ffff:')) {
      const mapped = cleanIp.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
    }
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true; // ULA fc00::/7
    if (cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
      return true; // Link-local fe80::/10
    }
    if (cleanIp.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const normalized = normalizeTargetUrl(rawUrl);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error('No se permite consultar direcciones locales o privadas.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('No se permite consultar direcciones IP privadas.');
    }
    return parsed;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('No se pudo encontrar el dominio indicado.');
  }

  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw new Error('El dominio apunta a una dirección restringida.');
  }

  return parsed;
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit & { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ response: Response; finalUrl: string }> {
  const { timeoutMs = 9000, maxRedirects = 5, ...fetchInit } = init;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safeUrl = await assertSafePublicUrl(currentUrl);
    const response = await fetch(safeUrl.href, {
      ...fetchInit,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { response, finalUrl: safeUrl.href };
      }
      currentUrl = new URL(location, safeUrl.href).href;
      continue;
    }

    return { response, finalUrl: safeUrl.href };
  }

  throw new Error('La página realizó demasiadas redirecciones.');
}
