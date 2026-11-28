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
export const GUEST_IMAGE_BANK_MAX_ATTEMPTS = 2;
export const GUEST_IP_BLOCK_MS = 24 * 60 * 60 * 1000;
export const FREE_PLAN_MAX_IMAGES = 20;
export const FREE_PLAN_MAX_API_REQUESTS_MONTHLY = 1000;
export const FREE_PLAN_MAX_REQUESTS_PER_MINUTE = 20;
export const FREE_PLAN_MAX_REQUESTS_PER_HOUR = 150;
export const FREE_PLAN_MAX_REQUESTS_PER_DAY = 400;
export const GUEST_EXTRACT_COOKIE_NAME = 'sl_guest_ext';
export const GUEST_IMAGE_BANK_COOKIE_NAME = 'sl_guest_img_bank';

export type PlanTier = 'free' | 'plus' | 'plus_max';

export interface PlanLimitsSpec {
  maxImages: number;
  maxApiRequestsMonthly: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

export const PLAN_LIMITS_BY_TIER: Record<PlanTier, PlanLimitsSpec> = {
  free: {
    maxImages: FREE_PLAN_MAX_IMAGES,
    maxApiRequestsMonthly: FREE_PLAN_MAX_API_REQUESTS_MONTHLY,
    maxRequestsPerMinute: FREE_PLAN_MAX_REQUESTS_PER_MINUTE,
    maxRequestsPerHour: FREE_PLAN_MAX_REQUESTS_PER_HOUR,
    maxRequestsPerDay: FREE_PLAN_MAX_REQUESTS_PER_DAY,
  },
  plus: {
    maxImages: 80,
    maxApiRequestsMonthly: FREE_PLAN_MAX_API_REQUESTS_MONTHLY,
    maxRequestsPerMinute: FREE_PLAN_MAX_REQUESTS_PER_MINUTE,
    maxRequestsPerHour: FREE_PLAN_MAX_REQUESTS_PER_HOUR,
    maxRequestsPerDay: FREE_PLAN_MAX_REQUESTS_PER_DAY,
  },
  plus_max: {
    maxImages: 150,
    maxApiRequestsMonthly: 25000,
    maxRequestsPerMinute: 120,
    maxRequestsPerHour: 1500,
    maxRequestsPerDay: 5000,
  },
};

export interface ServiceTrafficLimitRule {
  serviceId: string;
  userId: string;
  planTier: PlanTier;
  perMinuteLimit: number;
  perHourLimit: number;
  dailyLimit: number;
  allowedOrigins: string[];
  updatedAt: string;
}

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  accessToken: string;
  appMetadata?: Record<string, unknown>;
}

interface GuestExtractRecord {
  count: number;
  blockedUntil: number;
  windowStart: number;
}

interface AccountImageTracker {
  baseDbCount: number;
  lastDbSyncAt: number;
  recentKeys: Set<string>;
}

interface VerifiedTokenCacheEntry {
  userId: string;
  email: string;
  appMetadata: Record<string, unknown>;
  expiresAt: number;
}

const TOKEN_CACHE_TTL_MS = 45_000;
const TOKEN_CACHE_MAX_ENTRIES = 2000;
const QUOTA_DB_CACHE_TTL_MS = 120_000;

const guestExtractMemory = new Map<string, GuestExtractRecord>();
const guestImageBankMemory = new Map<string, GuestExtractRecord>();
const accountImageMemory = new Map<string, AccountImageTracker>();
const verifiedTokenCache = new Map<string, VerifiedTokenCacheEntry>();
const monthlyApiCounterMemory = new Map<string, number>();
const minuteApiCounterMemory = new Map<string, number>();
const hourApiCounterMemory = new Map<string, number>();
const dayApiCounterMemory = new Map<string, number>();
const keyHashToServiceScope = new Map<string, string>();
const userPlanTierMemory = new Map<string, PlanTier>();
const servicePlanTierMemory = new Map<string, PlanTier>();
const serviceOwnerUserMemory = new Map<string, string>();
const serviceTrafficRuleMemory = new Map<string, ServiceTrafficLimitRule>();

interface DeletedAccountLedgerFallback {
  freeImagesUsed: number;
  apiMonth: string;
  apiRequestsUsed: number;
  chatDay: string;
  chatUsed: number;
  lastDeletedPlan: 'free' | 'plus';
}

const deletedEmailLedgerFallback = new Map<string, DeletedAccountLedgerFallback>();

export function hashNormalizedEmail(email?: string | null): string {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function invalidateUserImageQuotaCache(userId: string): void {
  if (!userId) return;
  accountImageMemory.delete(userId);
}

export function clearUserVerificationCacheByUserId(userId: string): void {
  if (!userId) return;
  accountImageMemory.delete(userId);
  for (const [tokenHash, entry] of verifiedTokenCache.entries()) {
    if (entry.userId === userId) {
      verifiedTokenCache.delete(tokenHash);
    }
  }
}

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

function readJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return typeof payload?.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
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

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const cached = verifiedTokenCache.get(tokenHash);
  if (cached && cached.expiresAt > now) {
    return {
      userId: cached.userId,
      email: cached.email,
      accessToken: token,
      appMetadata: cached.appMetadata,
    };
  }
  if (cached) {
    verifiedTokenCache.delete(tokenHash);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return null;

    const appMetadata =
      data.user.app_metadata && typeof data.user.app_metadata === 'object'
        ? (data.user.app_metadata as Record<string, unknown>)
        : {};

    const jwtExpMs = readJwtExpMs(token);
    const cacheUntil = jwtExpMs
      ? Math.min(now + TOKEN_CACHE_TTL_MS, jwtExpMs - 1000)
      : now + TOKEN_CACHE_TTL_MS;

    if (cacheUntil > now) {
      if (verifiedTokenCache.size >= TOKEN_CACHE_MAX_ENTRIES) {
        const oldest = verifiedTokenCache.keys().next().value;
        if (oldest) verifiedTokenCache.delete(oldest);
      }
      verifiedTokenCache.set(tokenHash, {
        userId: data.user.id,
        email: data.user.email || '',
        appMetadata,
        expiresAt: cacheUntil,
      });
    }

    return {
      userId: data.user.id,
      email: data.user.email || '',
      accessToken: token,
      appMetadata,
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

export interface FreeUsageLedgerSnapshot {
  freeImagesUsed: number;
  freeApiRequestsUsed: number;
  freeChatUsed: number;
  lastDeletedPlan: 'free' | 'plus';
}

function getFallbackLedgerByEmail(email?: string | null): DeletedAccountLedgerFallback | null {
  const emailHash = hashNormalizedEmail(email);
  if (!emailHash) return null;
  return deletedEmailLedgerFallback.get(emailHash) ?? null;
}

export function recordInMemoryR2PurgeLedger(
  email: string | undefined,
  purgedImages: number,
  hasPlus: boolean,
): void {
  const emailHash = hashNormalizedEmail(email);
  if (!emailHash || hasPlus || purgedImages <= 0) return;
  const current = deletedEmailLedgerFallback.get(emailHash);
  const month = getCurrentMonthKey();
  const day = new Date().toISOString().slice(0, 10);
  if (deletedEmailLedgerFallback.size >= 5000) {
    const oldest = deletedEmailLedgerFallback.keys().next().value;
    if (oldest) deletedEmailLedgerFallback.delete(oldest);
  }
  deletedEmailLedgerFallback.set(emailHash, {
    freeImagesUsed: (current?.freeImagesUsed ?? 0) + Math.max(0, Math.trunc(purgedImages)),
    apiMonth: current?.apiMonth || month,
    apiRequestsUsed: current?.apiRequestsUsed ?? 0,
    chatDay: current?.chatDay || day,
    chatUsed: current?.chatUsed ?? 0,
    lastDeletedPlan: 'free',
  });
}

export function recordInMemoryDeletedAccountLedger(input: {
  email?: string | null;
  hasPlus: boolean;
  activeImages: number;
  apiMonth: string;
  apiRequests: number;
  chatDay: string;
  chatUsed: number;
}): void {
  const emailHash = hashNormalizedEmail(input.email);
  if (!emailHash) return;
  if (input.hasPlus) {
    deletedEmailLedgerFallback.set(emailHash, {
      freeImagesUsed: 0,
      apiMonth: input.apiMonth,
      apiRequestsUsed: 0,
      chatDay: input.chatDay,
      chatUsed: 0,
      lastDeletedPlan: 'plus',
    });
    return;
  }

  const prev = deletedEmailLedgerFallback.get(emailHash);
  const prevApi =
    prev && prev.apiMonth === input.apiMonth ? prev.apiRequestsUsed : 0;
  const prevChat =
    prev && prev.chatDay === input.chatDay ? prev.chatUsed : 0;

  if (deletedEmailLedgerFallback.size >= 5000) {
    const oldest = deletedEmailLedgerFallback.keys().next().value;
    if (oldest) deletedEmailLedgerFallback.delete(oldest);
  }
  deletedEmailLedgerFallback.set(emailHash, {
    freeImagesUsed:
      (prev?.freeImagesUsed ?? 0) + Math.max(0, Math.trunc(input.activeImages)),
    apiMonth: input.apiMonth,
    apiRequestsUsed: prevApi + Math.max(0, Math.trunc(input.apiRequests)),
    chatDay: input.chatDay,
    chatUsed: Math.max(prevChat, Math.max(0, Math.trunc(input.chatUsed))),
    lastDeletedPlan: 'free',
  });
}

export async function fetchUserFreeUsageLedger(
  user: AuthenticatedRequestUser,
): Promise<FreeUsageLedgerSnapshot> {
  const fallback = getFallbackLedgerByEmail(user.email);
  const month = getCurrentMonthKey();
  const day = new Date().toISOString().slice(0, 10);

  const fallbackResult: FreeUsageLedgerSnapshot = {
    freeImagesUsed: fallback?.freeImagesUsed ?? 0,
    freeApiRequestsUsed:
      fallback && fallback.apiMonth === month ? fallback.apiRequestsUsed : 0,
    freeChatUsed:
      fallback && fallback.chatDay === day ? fallback.chatUsed : 0,
    lastDeletedPlan: fallback?.lastDeletedPlan ?? 'free',
  };

  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return fallbackResult;

  try {
    const userClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      },
    });
    const { data, error } = await userClient.rpc('get_my_free_usage_ledger');
    if (error || !data || typeof data !== 'object') {
      return fallbackResult;
    }
    const row = data as Record<string, unknown>;
    const dbImages =
      typeof row.free_images_used === 'number' && Number.isFinite(row.free_images_used)
        ? Math.max(0, Math.trunc(row.free_images_used))
        : 0;
    const dbApi =
      typeof row.free_api_requests_used === 'number' &&
      Number.isFinite(row.free_api_requests_used)
        ? Math.max(0, Math.trunc(row.free_api_requests_used))
        : 0;
    const dbChat =
      typeof row.free_chat_used === 'number' && Number.isFinite(row.free_chat_used)
        ? Math.max(0, Math.trunc(row.free_chat_used))
        : 0;
    const plan = row.last_deleted_plan === 'plus' ? 'plus' : 'free';

    return {
      freeImagesUsed:
        plan === 'plus' && dbImages === 0
          ? dbImages
          : Math.max(dbImages, fallbackResult.freeImagesUsed),
      freeApiRequestsUsed: Math.max(dbApi, fallbackResult.freeApiRequestsUsed),
      freeChatUsed: Math.max(dbChat, fallbackResult.freeChatUsed),
      lastDeletedPlan: plan,
    };
  } catch {
    return fallbackResult;
  }
}

export async function fetchUserActiveDbImageCount(
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

async function fetchUserDbImageCount(
  user: AuthenticatedRequestUser,
): Promise<number> {
  const [activeDbCount, ledger] = await Promise.all([
    fetchUserActiveDbImageCount(user),
    fetchUserFreeUsageLedger(user),
  ]);
  return activeDbCount + ledger.freeImagesUsed;
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

  const now = Date.now();
  let tracker = accountImageMemory.get(user.userId);
  if (!tracker || now - tracker.lastDbSyncAt > QUOTA_DB_CACHE_TTL_MS) {
    const dbCount = await fetchUserDbImageCount(user);
    tracker = {
      baseDbCount: dbCount,
      lastDbSyncAt: now,
      recentKeys: tracker?.recentKeys ?? new Set<string>(),
    };
    accountImageMemory.set(user.userId, tracker);
  }

  const effectiveUsed = Math.max(
    tracker.baseDbCount,
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
    tracker = {
      baseDbCount: 0,
      lastDbSyncAt: 0,
      recentKeys: new Set<string>(),
    };
    accountImageMemory.set(user.userId, tracker);
  }
  tracker.recentKeys.add(uniqueKey);
}

export function unmarkFreeAccountImageConsumed(
  userId: string,
  uniqueKey: string,
): void {
  if (!userId || !uniqueKey) return;
  const tracker = accountImageMemory.get(userId);
  if (!tracker) return;
  tracker.recentKeys.delete(uniqueKey);
}

export function getPlanLimitsForTier(planTier: PlanTier): PlanLimitsSpec {
  return PLAN_LIMITS_BY_TIER[planTier] ?? PLAN_LIMITS_BY_TIER.free;
}

export function resolveUserPlanTier(
  email?: string | null,
  appMetadata?: Record<string, unknown> | null,
): PlanTier {
  const rawPlan =
    typeof appMetadata?.plan === 'string'
      ? appMetadata.plan.trim().toLowerCase()
      : '';
  const rawTier =
    typeof appMetadata?.tier === 'string'
      ? appMetadata.tier.trim().toLowerCase()
      : '';
  const candidate = rawPlan || rawTier;

  if (
    candidate === 'plus_max' ||
    candidate === 'plus+' ||
    candidate === 'plus-max' ||
    candidate === 'plus_mas' ||
    candidate === 'max' ||
    candidate === 'pro'
  ) {
    return 'plus_max';
  }
  if (candidate === 'plus') {
    return 'plus';
  }
  if (candidate === 'free' || candidate === 'gratuito') {
    return 'free';
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail && isAdminTestEmail(cleanEmail)) {
    return 'plus_max';
  }

  const extraPlusEmails = (process.env.PLUS_PLAN_EMAILS || '')
    .trim()
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (cleanEmail && extraPlusEmails.includes(cleanEmail)) {
    return 'plus';
  }

  return 'free';
}

export function registerUserPlanTier(userId: string, planTier: PlanTier): void {
  if (!userId) return;
  if (userPlanTierMemory.size >= 10000) {
    const oldest = userPlanTierMemory.keys().next().value;
    if (oldest) userPlanTierMemory.delete(oldest);
  }
  userPlanTierMemory.set(userId, planTier);
}

export function registerServicePlanTier(
  serviceId: string,
  planTier: PlanTier,
  userId?: string,
): void {
  if (!serviceId) return;
  if (servicePlanTierMemory.size >= 10000) {
    const oldest = servicePlanTierMemory.keys().next().value;
    if (oldest) servicePlanTierMemory.delete(oldest);
  }
  servicePlanTierMemory.set(serviceId, planTier);
  if (userId) {
    if (serviceOwnerUserMemory.size >= 10000) {
      const oldest = serviceOwnerUserMemory.keys().next().value;
      if (oldest) serviceOwnerUserMemory.delete(oldest);
    }
    serviceOwnerUserMemory.set(serviceId, userId);
    registerUserPlanTier(userId, planTier);
  }
}

export function resolveServicePlanTier(scopeId: string): PlanTier {
  const direct = servicePlanTierMemory.get(scopeId);
  if (direct) return direct;
  const ownerId = serviceOwnerUserMemory.get(scopeId);
  if (ownerId) {
    const userTier = userPlanTierMemory.get(ownerId);
    if (userTier) return userTier;
  }
  return 'free';
}

export function normalizeAllowedOriginInput(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function clampRuleLimit(value: number, maxLimit: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const truncated = Math.trunc(value);
  if (truncated < 1) return 1;
  return Math.min(truncated, maxLimit);
}

export function getServiceTrafficLimitRule(
  serviceId: string,
  userId: string,
  planTier: PlanTier,
): ServiceTrafficLimitRule {
  registerServicePlanTier(serviceId, planTier, userId);
  const limits = getPlanLimitsForTier(planTier);
  const existing = serviceTrafficRuleMemory.get(serviceId);
  if (!existing) {
    return {
      serviceId,
      userId,
      planTier,
      perMinuteLimit: limits.maxRequestsPerMinute,
      perHourLimit: limits.maxRequestsPerHour,
      dailyLimit: limits.maxRequestsPerDay,
      allowedOrigins: [],
      updatedAt: '',
    };
  }
  return {
    serviceId,
    userId,
    planTier,
    perMinuteLimit: clampRuleLimit(
      existing.perMinuteLimit,
      limits.maxRequestsPerMinute,
      limits.maxRequestsPerMinute,
    ),
    perHourLimit: clampRuleLimit(
      existing.perHourLimit,
      limits.maxRequestsPerHour,
      limits.maxRequestsPerHour,
    ),
    dailyLimit: clampRuleLimit(
      existing.dailyLimit,
      limits.maxRequestsPerDay,
      limits.maxRequestsPerDay,
    ),
    allowedOrigins: existing.allowedOrigins,
    updatedAt: existing.updatedAt,
  };
}

export function saveServiceTrafficLimitRule(input: {
  serviceId: string;
  userId: string;
  planTier: PlanTier;
  perMinuteLimit: number;
  perHourLimit: number;
  dailyLimit: number;
  allowedOrigins: string[];
}): ServiceTrafficLimitRule {
  registerServicePlanTier(input.serviceId, input.planTier, input.userId);
  const limits = getPlanLimitsForTier(input.planTier);
  const rule: ServiceTrafficLimitRule = {
    serviceId: input.serviceId,
    userId: input.userId,
    planTier: input.planTier,
    perMinuteLimit: clampRuleLimit(
      input.perMinuteLimit,
      limits.maxRequestsPerMinute,
      limits.maxRequestsPerMinute,
    ),
    perHourLimit: clampRuleLimit(
      input.perHourLimit,
      limits.maxRequestsPerHour,
      limits.maxRequestsPerHour,
    ),
    dailyLimit: clampRuleLimit(
      input.dailyLimit,
      limits.maxRequestsPerDay,
      limits.maxRequestsPerDay,
    ),
    allowedOrigins: Array.from(new Set(input.allowedOrigins)),
    updatedAt: new Date().toISOString(),
  };

  if (serviceTrafficRuleMemory.size >= 10000) {
    const oldest = serviceTrafficRuleMemory.keys().next().value;
    if (oldest) serviceTrafficRuleMemory.delete(oldest);
  }
  serviceTrafficRuleMemory.set(input.serviceId, rule);
  return rule;
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getCurrentDayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getCurrentHourKey(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function getCurrentMinuteKey(): string {
  return new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

function pruneWindowCounterMap(map: Map<string, number>, activePrefix: string) {
  if (map.size <= 10000) return;
  for (const key of map.keys()) {
    if (!key.startsWith(`${activePrefix}:`)) {
      map.delete(key);
    }
  }
}

export function isMonthlyApiQuotaExceeded(keyHash: string): boolean {
  const scopeId = keyHashToServiceScope.get(keyHash);
  if (!scopeId) return false;
  const tier = resolveServicePlanTier(scopeId);
  const limit = getPlanLimitsForTier(tier).maxApiRequestsMonthly;
  const month = getCurrentMonthKey();
  const used = monthlyApiCounterMemory.get(`${month}:${scopeId}`) ?? 0;
  return used >= limit;
}

export function checkPreResolutionServiceTraffic(input: {
  keyHash: string;
  requestOrigin?: string | null;
  enforceTrafficRules?: boolean;
}): { allowed: true } | { allowed: false; status: 403 | 429; error: string } {
  const scopeId = keyHashToServiceScope.get(input.keyHash);
  if (!scopeId) return { allowed: true };

  const tier = resolveServicePlanTier(scopeId);
  const tierLimits = getPlanLimitsForTier(tier);
  const rule = serviceTrafficRuleMemory.get(scopeId);

  if (
    input.enforceTrafficRules &&
    rule &&
    rule.allowedOrigins.length > 0
  ) {
    const normalizedReqOrigin = input.requestOrigin
      ? normalizeAllowedOriginInput(input.requestOrigin)
      : null;
    if (!normalizedReqOrigin || !rule.allowedOrigins.includes(normalizedReqOrigin)) {
      return {
        allowed: false,
        status: 403,
        error:
          'Acceso bloqueado por Seguridad rápida: el origen de esta petición no está autorizado.',
      };
    }
  }

  const perMinuteCap = rule
    ? Math.min(rule.perMinuteLimit, tierLimits.maxRequestsPerMinute)
    : tierLimits.maxRequestsPerMinute;
  const perHourCap = rule
    ? Math.min(rule.perHourLimit, tierLimits.maxRequestsPerHour)
    : tierLimits.maxRequestsPerHour;
  const perDayCap = rule
    ? Math.min(rule.dailyLimit, tierLimits.maxRequestsPerDay)
    : tierLimits.maxRequestsPerDay;

  const month = getCurrentMonthKey();
  const day = getCurrentDayKey();
  const hour = getCurrentHourKey();
  const minute = getCurrentMinuteKey();

  if ((monthlyApiCounterMemory.get(`${month}:${scopeId}`) ?? 0) >= tierLimits.maxApiRequestsMonthly) {
    return {
      allowed: false,
      status: 429,
      error: `Límite mensual alcanzado: tu plan incluye hasta ${tierLimits.maxApiRequestsMonthly.toLocaleString('es-ES')} peticiones API por mes.`,
    };
  }
  if ((dayApiCounterMemory.get(`${day}:${scopeId}`) ?? 0) >= perDayCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite diario alcanzado (${perDayCap} peticiones/día).`,
    };
  }
  if ((hourApiCounterMemory.get(`${hour}:${scopeId}`) ?? 0) >= perHourCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite por hora alcanzado (${perHourCap} peticiones/h).`,
    };
  }
  if ((minuteApiCounterMemory.get(`${minute}:${scopeId}`) ?? 0) >= perMinuteCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite por minuto alcanzado (${perMinuteCap} peticiones/min).`,
    };
  }

  return { allowed: true };
}

export function checkAndConsumeServiceTraffic(input: {
  scopeId: string;
  keyHash: string;
  dbMonthlyRequestsHint?: number;
  requestOrigin?: string | null;
  enforceTrafficRules?: boolean;
}):
  | { allowed: true; used: number; limit: number }
  | { allowed: false; status: 403 | 429; error: string; used: number; limit: number } {
  const { scopeId, keyHash } = input;
  if (keyHashToServiceScope.size >= 10000) {
    const oldestKey = keyHashToServiceScope.keys().next().value;
    if (oldestKey) keyHashToServiceScope.delete(oldestKey);
  }
  keyHashToServiceScope.set(keyHash, scopeId);

  const tier = resolveServicePlanTier(scopeId);
  const tierLimits = getPlanLimitsForTier(tier);
  const rule = serviceTrafficRuleMemory.get(scopeId);

  if (
    input.enforceTrafficRules &&
    rule &&
    rule.allowedOrigins.length > 0
  ) {
    const normalizedReqOrigin = input.requestOrigin
      ? normalizeAllowedOriginInput(input.requestOrigin)
      : null;
    if (!normalizedReqOrigin || !rule.allowedOrigins.includes(normalizedReqOrigin)) {
      return {
        allowed: false,
        status: 403,
        error:
          'Acceso bloqueado por Seguridad rápida: el origen de esta petición no está autorizado.',
        used: 0,
        limit: tierLimits.maxApiRequestsMonthly,
      };
    }
  }

  const perMinuteCap = rule
    ? Math.min(rule.perMinuteLimit, tierLimits.maxRequestsPerMinute)
    : tierLimits.maxRequestsPerMinute;
  const perHourCap = rule
    ? Math.min(rule.perHourLimit, tierLimits.maxRequestsPerHour)
    : tierLimits.maxRequestsPerHour;
  const perDayCap = rule
    ? Math.min(rule.dailyLimit, tierLimits.maxRequestsPerDay)
    : tierLimits.maxRequestsPerDay;

  const month = getCurrentMonthKey();
  const day = getCurrentDayKey();
  const hour = getCurrentHourKey();
  const minute = getCurrentMinuteKey();

  const monthKey = `${month}:${scopeId}`;
  const dayKey = `${day}:${scopeId}`;
  const hourKey = `${hour}:${scopeId}`;
  const minuteKey = `${minute}:${scopeId}`;

  const currentMonth = Math.max(
    monthlyApiCounterMemory.get(monthKey) ?? 0,
    Math.max(0, Math.trunc(input.dbMonthlyRequestsHint ?? 0)),
  );
  if (currentMonth >= tierLimits.maxApiRequestsMonthly) {
    monthlyApiCounterMemory.set(monthKey, currentMonth);
    return {
      allowed: false,
      status: 429,
      error: `Límite mensual alcanzado: tu plan incluye hasta ${tierLimits.maxApiRequestsMonthly.toLocaleString('es-ES')} peticiones API por mes.`,
      used: currentMonth,
      limit: tierLimits.maxApiRequestsMonthly,
    };
  }

  const currentDay = dayApiCounterMemory.get(dayKey) ?? 0;
  if (currentDay >= perDayCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite diario alcanzado (${perDayCap} peticiones/día).`,
      used: currentMonth,
      limit: tierLimits.maxApiRequestsMonthly,
    };
  }

  const currentHour = hourApiCounterMemory.get(hourKey) ?? 0;
  if (currentHour >= perHourCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite por hora alcanzado (${perHourCap} peticiones/h).`,
      used: currentMonth,
      limit: tierLimits.maxApiRequestsMonthly,
    };
  }

  const currentMinute = minuteApiCounterMemory.get(minuteKey) ?? 0;
  if (currentMinute >= perMinuteCap) {
    return {
      allowed: false,
      status: 429,
      error: `Límite por minuto alcanzado (${perMinuteCap} peticiones/min).`,
      used: currentMonth,
      limit: tierLimits.maxApiRequestsMonthly,
    };
  }

  const nextMonth = currentMonth + 1;
  monthlyApiCounterMemory.set(monthKey, nextMonth);
  dayApiCounterMemory.set(dayKey, currentDay + 1);
  hourApiCounterMemory.set(hourKey, currentHour + 1);
  minuteApiCounterMemory.set(minuteKey, currentMinute + 1);

  pruneWindowCounterMap(monthlyApiCounterMemory, month);
  pruneWindowCounterMap(dayApiCounterMemory, day);
  pruneWindowCounterMap(hourApiCounterMemory, hour);
  pruneWindowCounterMap(minuteApiCounterMemory, minute);

  return {
    allowed: true,
    used: nextMonth,
    limit: tierLimits.maxApiRequestsMonthly,
  };
}

export function recordAndCheckMonthlyApiQuota(
  scopeId: string,
  keyHash: string,
  dbRequestsHint = 0,
): { allowed: boolean; used: number; limit: number } {
  const res = checkAndConsumeServiceTraffic({
    scopeId,
    keyHash,
    dbMonthlyRequestsHint: dbRequestsHint,
  });
  return {
    allowed: res.allowed,
    used: res.used,
    limit: res.limit,
  };
}

export function getMonthlyApiRequestsForServiceScope(scopeId: string): number {
  const month = getCurrentMonthKey();
  return monthlyApiCounterMemory.get(`${month}:${scopeId}`) ?? 0;
}

function pruneGuestImageBankMemory(now: number) {
  if (guestImageBankMemory.size <= 4000) return;
  for (const [k, rec] of guestImageBankMemory.entries()) {
    if (rec.blockedUntil <= now && now - rec.windowStart >= GUEST_IP_BLOCK_MS) {
      guestImageBankMemory.delete(k);
    }
  }
}

export function inspectGuestImageBankStatus(
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
    guestImageBankMemory.delete(ip);
    return {
      ipBlocked: false,
      attemptsUsed: 0,
      clearCookieHeader: `${GUEST_IMAGE_BANK_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    };
  }

  const now = Date.now();
  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookieRec = verifySignedCookiePayload<{ c?: number; b?: number; w?: number }>(
    cookies[GUEST_IMAGE_BANK_COOKIE_NAME],
  );
  const merged = normalizeGuestRecord(guestImageBankMemory.get(ip), cookieRec, now);

  return {
    ipBlocked: merged.blockedUntil > now,
    attemptsUsed: merged.count,
  };
}

export function checkAndBlockExhaustedGuestImageBank(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
  authenticatedUser: AuthenticatedRequestUser | null,
): {
  allowed: boolean;
  ipBlocked: boolean;
  setCookieHeader?: string;
} {
  const ip = getClientIp(headers, remoteAddress);
  const cookieAttrs = getCookieSecurityAttrs(headers);

  if (authenticatedUser) {
    guestImageBankMemory.delete(ip);
    return {
      allowed: true,
      ipBlocked: false,
      setCookieHeader: `${GUEST_IMAGE_BANK_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    };
  }

  const now = Date.now();
  pruneGuestImageBankMemory(now);

  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookieRec = verifySignedCookiePayload<{ c?: number; b?: number; w?: number }>(
    cookies[GUEST_IMAGE_BANK_COOKIE_NAME],
  );
  const current = normalizeGuestRecord(guestImageBankMemory.get(ip), cookieRec, now);

  if (current.blockedUntil > now || current.count >= GUEST_IMAGE_BANK_MAX_ATTEMPTS) {
    const blockedRecord: GuestExtractRecord = {
      count: Math.max(current.count, GUEST_IMAGE_BANK_MAX_ATTEMPTS),
      blockedUntil: Math.max(current.blockedUntil, now + GUEST_IP_BLOCK_MS),
      windowStart: current.windowStart,
    };
    guestImageBankMemory.set(ip, blockedRecord);

    const signed = signCookiePayload({
      c: blockedRecord.count,
      b: blockedRecord.blockedUntil,
      w: blockedRecord.windowStart,
    });
    const setCookieHeader = `${GUEST_IMAGE_BANK_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=86400`;

    return {
      allowed: false,
      ipBlocked: true,
      setCookieHeader,
    };
  }

  return {
    allowed: true,
    ipBlocked: false,
  };
}

export function consumeGuestImageBankAttempt(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
  authenticatedUser: AuthenticatedRequestUser | null,
): {
  attemptsUsed: number;
  setCookieHeader?: string;
} {
  if (authenticatedUser) {
    return { attemptsUsed: 0 };
  }

  const ip = getClientIp(headers, remoteAddress);
  const cookieAttrs = getCookieSecurityAttrs(headers);
  const now = Date.now();
  pruneGuestImageBankMemory(now);

  const cookies = parseCookies(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
  );
  const cookieRec = verifySignedCookiePayload<{ c?: number; b?: number; w?: number }>(
    cookies[GUEST_IMAGE_BANK_COOKIE_NAME],
  );
  const current = normalizeGuestRecord(guestImageBankMemory.get(ip), cookieRec, now);

  const nextRecord: GuestExtractRecord = {
    count: current.count + 1,
    blockedUntil: 0,
    windowStart: current.windowStart,
  };
  guestImageBankMemory.set(ip, nextRecord);

  const signed = signCookiePayload({
    c: nextRecord.count,
    b: nextRecord.blockedUntil,
    w: nextRecord.windowStart,
  });
  const setCookieHeader = `${GUEST_IMAGE_BANK_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=86400`;

  return {
    attemptsUsed: nextRecord.count,
    setCookieHeader,
  };
}

