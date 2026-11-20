import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseServerClient,
  getSupabaseServerConfig,
} from './supabaseServer.ts';

export const ADMIN_TEST_EMAIL = 'cristiancuerodiaz@gmail.com';
export const GUEST_EXTRACT_MAX_ATTEMPTS = 3;
export const GUEST_EXTRACT_MAX_IMAGES = 10;
export const GUEST_IP_BLOCK_MS = 24 * 60 * 60 * 1000;
export const FREE_PLAN_MAX_IMAGES = 20;
export const FREE_PLAN_MAX_API_REQUESTS_MONTHLY = 1000;
export const GUEST_EXTRACT_COOKIE_NAME = 'sl_guest_ext';

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  accessToken: string;
}

interface GuestExtractRecord {
  count: number;
  blockedUntil: number;
  windowStart: number;
}

interface AccountImageTracker {
  baseDbCount: number;
  recentKeys: Set<string>;
}

const guestExtractMemory = new Map<string, GuestExtractRecord>();
const accountImageMemory = new Map<string, AccountImageTracker>();
const monthlyApiCounterMemory = new Map<string, number>();
const keyHashToServiceScope = new Map<string, string>();

export function isAdminTestEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === ADMIN_TEST_EMAIL;
}

export function getClientIp(
  headers: IncomingHttpHeaders,
  remoteAddress?: string,
): string {
  const cfIp = headers['cf-connecting-ip'];
  const realIp = headers['x-real-ip'];
  const forwarded = headers['x-forwarded-for'];

  const raw =
    (typeof cfIp === 'string' ? cfIp : Array.isArray(cfIp) ? cfIp[0] : '') ||
    (typeof realIp === 'string'
      ? realIp
      : Array.isArray(realIp)
        ? realIp[0]
        : '') ||
    (typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : Array.isArray(forwarded)
        ? forwarded[0]
        : '') ||
    remoteAddress ||
    'local';

  return raw.trim() || 'local';
}

export function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function getQuotaSecret(): string {
  return (
    process.env.QUOTA_SIGNING_SECRET ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.GEMINI_API_KEY ||
    'searchlink_quota_guard_secret_v1'
  ).trim();
}

function signCookiePayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = crypto
    .createHmac('sha256', getQuotaSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedCookiePayload<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getQuotaSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function verifySupabaseBearerUser(
  headers: IncomingHttpHeaders,
): Promise<AuthenticatedRequestUser | null> {
  const rawAuth = headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length < 20) return null;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return {
      userId: data.user.id,
      email: data.user.email || '',
      accessToken: token,
    };
  } catch {
    return null;
  }
}

function normalizeGuestRecord(
  mem: GuestExtractRecord | undefined,
  cookieRec: { c?: number; b?: number; w?: number } | null,
  now: number,
): GuestExtractRecord {
  const memValid =
    mem && (mem.blockedUntil > now || now - mem.windowStart < GUEST_IP_BLOCK_MS)
      ? mem
      : { count: 0, blockedUntil: 0, windowStart: now };

  const cookieValid =
    cookieRec &&
    typeof cookieRec.c === 'number' &&
    typeof cookieRec.b === 'number' &&
    typeof cookieRec.w === 'number' &&
    (cookieRec.b > now || now - cookieRec.w < GUEST_IP_BLOCK_MS)
      ? {
          count: Math.max(0, Math.trunc(cookieRec.c)),
          blockedUntil: Math.max(0, Math.trunc(cookieRec.b)),
          windowStart: Math.max(0, Math.trunc(cookieRec.w)),
        }
      : { count: 0, blockedUntil: 0, windowStart: now };

  return {
    count: Math.max(memValid.count, cookieValid.count),
    blockedUntil: Math.max(memValid.blockedUntil, cookieValid.blockedUntil),
    windowStart: Math.min(memValid.windowStart, cookieValid.windowStart),
  };
}

function pruneGuestMemory(now: number) {
  if (guestExtractMemory.size <= 4000) return;
  for (const [k, rec] of guestExtractMemory.entries()) {
    if (rec.blockedUntil <= now && now - rec.windowStart >= GUEST_IP_BLOCK_MS) {
      guestExtractMemory.delete(k);
    }
  }
}

function getCookieSecurityAttrs(headers: IncomingHttpHeaders): string {
  const proto =
    typeof headers['x-forwarded-proto'] === 'string'
      ? headers['x-forwarded-proto']
      : '';
  const origin =
    typeof headers.origin === 'string' ? headers.origin : '';
  const isHttps =
    proto.toLowerCase().includes('https') ||
    origin.toLowerCase().startsWith('https://');
  return isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
}

export function inspectGuestExtractStatus(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
  authenticatedUser: AuthenticatedRequestUser | null,
): {
  ipBlocked: boolean;
  attemptsUsed: number;
  clearCookieHeader?: string;
} {
  const ip = getClientIp(headers, remoteAddress);
  const cookieAttrs = getCookieSecurityAttrs(headers);
  if (authenticatedUser) {
    guestExtractMemory.delete(ip);
    return {
      ipBlocked: false,
      attemptsUsed: 0,
      clearCookieHeader: `${GUEST_EXTRACT_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    };
  }

  const now = Date.now();
  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookieRec = verifySignedCookiePayload<{ c?: number; b?: number; w?: number }>(
    cookies[GUEST_EXTRACT_COOKIE_NAME],
  );
  const merged = normalizeGuestRecord(guestExtractMemory.get(ip), cookieRec, now);

  return {
    ipBlocked: merged.blockedUntil > now,
    attemptsUsed: merged.count,
  };
}

export function checkAndConsumeGuestExtractQuota(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
  authenticatedUser: AuthenticatedRequestUser | null,
): {
  allowed: boolean;
  ipBlocked: boolean;
  attemptsUsed: number;
  setCookieHeader: string;
} {
  const ip = getClientIp(headers, remoteAddress);
  const cookieAttrs = getCookieSecurityAttrs(headers);

  if (authenticatedUser) {
    guestExtractMemory.delete(ip);
    return {
      allowed: true,
      ipBlocked: false,
      attemptsUsed: 0,
      setCookieHeader: `${GUEST_EXTRACT_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    };
  }

  const now = Date.now();
  pruneGuestMemory(now);

  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookieRec = verifySignedCookiePayload<{ c?: number; b?: number; w?: number }>(
    cookies[GUEST_EXTRACT_COOKIE_NAME],
  );
  const current = normalizeGuestRecord(guestExtractMemory.get(ip), cookieRec, now);

  if (current.blockedUntil > now || current.count >= GUEST_EXTRACT_MAX_ATTEMPTS) {
    const blockedRecord: GuestExtractRecord = {
      count: Math.max(current.count, GUEST_EXTRACT_MAX_ATTEMPTS),
      blockedUntil: Math.max(current.blockedUntil, now + GUEST_IP_BLOCK_MS),
      windowStart: current.windowStart,
    };
    guestExtractMemory.set(ip, blockedRecord);

    const signed = signCookiePayload({
      c: blockedRecord.count,
      b: blockedRecord.blockedUntil,
      w: blockedRecord.windowStart,
    });
    const setCookieHeader = `${GUEST_EXTRACT_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=86400`;

    return {
      allowed: false,
      ipBlocked: true,
      attemptsUsed: blockedRecord.count,
      setCookieHeader,
    };
  }

  const nextRecord: GuestExtractRecord = {
    count: current.count + 1,
    blockedUntil: 0,
    windowStart: current.windowStart,
  };
  guestExtractMemory.set(ip, nextRecord);

  const signed = signCookiePayload({
    c: nextRecord.count,
    b: nextRecord.blockedUntil,
    w: nextRecord.windowStart,
  });
  const setCookieHeader = `${GUEST_EXTRACT_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=86400`;

  return {
    allowed: true,
    ipBlocked: false,
    attemptsUsed: nextRecord.count,
    setCookieHeader,
  };
}

async function fetchUserDbImageCount(
  user: AuthenticatedRequestUser,
): Promise<number> {
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return 0;

  try {
    const userClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      },
    });
    const { data, error } = await userClient
      .from('servicios')
      .select('item_count')
      .eq('user_id', user.userId);

    if (error || !Array.isArray(data)) return 0;
    return data.reduce((sum, row) => {
      const count =
        typeof row?.item_count === 'number' && Number.isFinite(row.item_count)
          ? Math.max(0, Math.trunc(row.item_count))
          : 0;
      return sum + count;
    }, 0);
  } catch {
    return 0;
  }
}

export async function checkFreeAccountImageQuota(
  user: AuthenticatedRequestUser,
  candidateKey?: string,
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  if (isAdminTestEmail(user.email)) {
    return {
      allowed: true,
      used: 0,
      limit: 50,
      remaining: 50,
    };
  }

  const dbCount = await fetchUserDbImageCount(user);
  let tracker = accountImageMemory.get(user.userId);
  if (!tracker) {
    tracker = { baseDbCount: dbCount, recentKeys: new Set<string>() };
    accountImageMemory.set(user.userId, tracker);
  }

  const effectiveUsed = Math.max(
    dbCount,
    tracker.baseDbCount + tracker.recentKeys.size,
  );
  const alreadyTracked = Boolean(candidateKey && tracker.recentKeys.has(candidateKey));

  return {
    allowed: alreadyTracked || effectiveUsed < FREE_PLAN_MAX_IMAGES,
    used: effectiveUsed,
    limit: FREE_PLAN_MAX_IMAGES,
    remaining: Math.max(0, FREE_PLAN_MAX_IMAGES - effectiveUsed),
  };
}

export function markFreeAccountImageConsumed(
  user: AuthenticatedRequestUser,
  uniqueKey: string,
): void {
  if (isAdminTestEmail(user.email) || !uniqueKey) return;
  let tracker = accountImageMemory.get(user.userId);
  if (!tracker) {
    tracker = { baseDbCount: 0, recentKeys: new Set<string>() };
    accountImageMemory.set(user.userId, tracker);
  }
  tracker.recentKeys.add(uniqueKey);
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function isMonthlyApiQuotaExceeded(keyHash: string): boolean {
  const scopeId = keyHashToServiceScope.get(keyHash);
  if (!scopeId) return false;
  const month = getCurrentMonthKey();
  const used = monthlyApiCounterMemory.get(`${month}:${scopeId}`) ?? 0;
  return used >= FREE_PLAN_MAX_API_REQUESTS_MONTHLY;
}

export function recordAndCheckMonthlyApiQuota(
  scopeId: string,
  keyHash: string,
  dbRequestsHint = 0,
): { allowed: boolean; used: number; limit: number } {
  const month = getCurrentMonthKey();
  keyHashToServiceScope.set(keyHash, scopeId);
  const counterKey = `${month}:${scopeId}`;
  const currentMem = monthlyApiCounterMemory.get(counterKey) ?? 0;
  const currentUsed = Math.max(currentMem, Math.max(0, Math.trunc(dbRequestsHint)));

  if (currentUsed >= FREE_PLAN_MAX_API_REQUESTS_MONTHLY) {
    monthlyApiCounterMemory.set(counterKey, currentUsed);
    return {
      allowed: false,
      used: currentUsed,
      limit: FREE_PLAN_MAX_API_REQUESTS_MONTHLY,
    };
  }

  const nextUsed = currentUsed + 1;
  monthlyApiCounterMemory.set(counterKey, nextUsed);

  if (monthlyApiCounterMemory.size > 10000) {
    for (const k of monthlyApiCounterMemory.keys()) {
      if (!k.startsWith(`${month}:`)) {
        monthlyApiCounterMemory.delete(k);
      }
    }
  }

  return {
    allowed: true,
    used: nextUsed,
    limit: FREE_PLAN_MAX_API_REQUESTS_MONTHLY,
  };
}
