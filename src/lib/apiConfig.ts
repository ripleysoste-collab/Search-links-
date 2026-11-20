function normalizeOrigin(raw: string | undefined): string {
  const trimmed = (raw || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getApiBaseUrl(): string {
  return normalizeOrigin(import.meta.env.VITE_API_BASE_URL);
}

export function resolveApiUrl(pathOrUrl: string): string {
  const clean = (pathOrUrl || '').trim();
  if (!clean) return clean;
  if (/^https?:\/\//i.test(clean) || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }
  const base = getApiBaseUrl();
  if (!base) return clean;
  if (clean.startsWith('/')) {
    return `${base}${clean}`;
  }
  return `${base}/${clean}`;
}
