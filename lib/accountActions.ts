import type { IncomingHttpHeaders } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { hasImageBankPlusAccess } from './imageBank.ts';
import {
  clearUserVerificationCacheByUserId,
  fetchUserActiveDbImageCount,
  fetchUserFreeUsageLedger,
  FREE_PLAN_MAX_IMAGES,
  getCurrentMonthKey,
  getMonthlyApiRequestsForServiceScope,
  GUEST_EXTRACT_COOKIE_NAME,
  GUEST_IMAGE_BANK_COOKIE_NAME,
  invalidateUserImageQuotaCache,
  isAdminTestEmail,
  recordInMemoryDeletedAccountLedger,
  recordInMemoryR2PurgeLedger,
  type AuthenticatedRequestUser,
} from './planLimits.ts';
import { deleteImagesFromR2, isValidMediaKey } from './r2Storage.ts';
import {
  checkDailyLimit,
  getTodayUtcDateString,
  SEARCH_LINK_IA_COOKIE_NAME,
} from './searchLinkChat.ts';
import {
  getSupabaseAdminClient,
  getSupabaseServerConfig,
  invalidateCoreCatalogCache,
  markExternalServerActiveForKeyHashes,
} from './supabaseServer.ts';

function createAuthenticatedUserClient(accessToken: string) {
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function extractSafeMediaKey(
  rawKey: unknown,
  rawUrl: unknown,
): string | null {
  if (typeof rawKey === 'string') {
    const cleaned = rawKey.trim();
    if (cleaned && isValidMediaKey(cleaned)) {
      return cleaned;
    }
  }
  if (typeof rawUrl === 'string' && rawUrl.trim()) {
    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const queryKey = parsed.searchParams.get('k')?.trim() || '';
      if (queryKey && isValidMediaKey(queryKey)) {
        return queryKey;
      }
      const pathKey = parsed.pathname.replace(/^\/+/, '').trim();
      if (pathKey && isValidMediaKey(pathKey)) {
        return pathKey;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export interface UserQuotaSummary {
  ok: true;
  isAdmin: boolean;
  hasPlusAccess: boolean;
  activeImagesCount: number;
  carriedFreeImagesUsed: number;
  totalFreeImagesUsed: number;
  freeLimit: number;
  remainingFreeImages: number;
}

export async function getUserQuotaSummary(
  authUser: AuthenticatedRequestUser,
): Promise<UserQuotaSummary> {
  const isAdmin = isAdminTestEmail(authUser.email);
  const hasPlusAccess = hasImageBankPlusAccess(
    authUser.email,
    authUser.appMetadata,
  );
  const [activeImagesCount, ledger] = await Promise.all([
    fetchUserActiveDbImageCount(authUser),
    fetchUserFreeUsageLedger(authUser),
  ]);
  const carriedFreeImagesUsed = isAdmin ? 0 : ledger.freeImagesUsed;
  const totalFreeImagesUsed = isAdmin
    ? activeImagesCount
    : activeImagesCount + carriedFreeImagesUsed;
  const freeLimit = isAdmin ? 50 : FREE_PLAN_MAX_IMAGES;
  const remainingFreeImages = Math.max(0, freeLimit - totalFreeImagesUsed);

  return {
    ok: true,
    isAdmin,
    hasPlusAccess,
    activeImagesCount,
    carriedFreeImagesUsed,
    totalFreeImagesUsed,
    freeLimit,
    remainingFreeImages,
  };
}

export async function purgeAllUserR2Images(
  authUser: AuthenticatedRequestUser,
): Promise<
  | {
      ok: true;
      deletedR2Count: number;
      clearedServicesCount: number;
      clearedLogo: boolean;
      quota: UserQuotaSummary;
    }
  | { ok: false; status: number; error: string }
> {
  const userClient = createAuthenticatedUserClient(authUser.accessToken);
  if (!userClient) {
    return {
      ok: false,
      status: 500,
      error: 'Configuración de Supabase no disponible en el servidor.',
    };
  }

  const [{ data: orgRow }, { data: serviceRows }, { data: productRows }] =
    await Promise.all([
      userClient
        .from('organizacion')
        .select('id, logo_url, logo_r2_key')
        .eq('user_id', authUser.userId)
        .maybeSingle(),
      userClient
        .from('servicios')
        .select('id, public_slug, item_count')
        .eq('user_id', authUser.userId),
      userClient
        .from('servicio_productos')
        .select('id, servicio_id, r2_key, image_url')
        .eq('user_id', authUser.userId),
    ]);

  const r2Keys: string[] = [];
  const logoKey = extractSafeMediaKey(orgRow?.logo_r2_key, orgRow?.logo_url);
  if (logoKey) {
    r2Keys.push(logoKey);
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];
  const productsList = Array.isArray(productRows) ? productRows : [];

  let catalogKeysCount = 0;
  for (const prod of productsList) {
    const key = extractSafeMediaKey(prod?.r2_key, prod?.image_url);
    if (key) {
      r2Keys.push(key);
      catalogKeysCount++;
    }
  }

  const serviceItemsSum = servicesList.reduce((sum, srv) => {
    const c =
      typeof srv?.item_count === 'number' && Number.isFinite(srv.item_count)
        ? Math.max(0, Math.trunc(srv.item_count))
        : 0;
    return sum + c;
  }, 0);

  const purgedCatalogImages = Math.max(
    serviceItemsSum,
    productsList.length,
    catalogKeysCount,
  );

  const deletedR2Count = await deleteImagesFromR2(r2Keys);

  const hasPlus =
    hasImageBankPlusAccess(authUser.email, authUser.appMetadata) ||
    isAdminTestEmail(authUser.email);

  if (!hasPlus && purgedCatalogImages > 0) {
    recordInMemoryR2PurgeLedger(authUser.email, purgedCatalogImages, false);
    await userClient
      .rpc('record_my_r2_purge_usage', {
        p_purged_images: purgedCatalogImages,
        p_has_plus: false,
      })
      .then(() => undefined, () => undefined);
  }

  if (servicesList.length > 0 || productsList.length > 0) {
    await userClient
      .from('servicio_api_keys')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('servicio_productos')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('servicios')
      .delete()
      .eq('user_id', authUser.userId);
  }

  let clearedLogo = false;
  if (orgRow?.id && logoKey) {
    const { error: orgUpdateErr } = await userClient
      .from('organizacion')
      .update({
        logo_url: null,
        logo_r2_key: null,
      })
      .eq('id', orgRow.id)
      .eq('user_id', authUser.userId);
    if (!orgUpdateErr) {
      clearedLogo = true;
    }
  }

  invalidateCoreCatalogCache();
  invalidateUserImageQuotaCache(authUser.userId);

  const quota = await getUserQuotaSummary(authUser);

  return {
    ok: true,
    deletedR2Count,
    clearedServicesCount: servicesList.length,
    clearedLogo,
    quota,
  };
}

export async function pauseAllUserApis(
  authUser: AuthenticatedRequestUser,
): Promise<
  | { ok: true; pausedServicesCount: number }
  | { ok: false; status: number; error: string }
> {
  const userClient = createAuthenticatedUserClient(authUser.accessToken);
  if (!userClient) {
    return {
      ok: false,
      status: 500,
      error: 'Configuración de Supabase no disponible en el servidor.',
    };
  }

  const { data: serviceRows, error: servicesFetchErr } = await userClient
    .from('servicios')
    .select('id, public_slug')
    .eq('user_id', authUser.userId);

  if (servicesFetchErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron consultar los servicios para pausar sus APIs.',
    };
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];

  const [keysRes, srvRes] = await Promise.all([
    userClient
      .from('servicio_api_keys')
      .update({ is_active: false })
      .eq('user_id', authUser.userId),
    userClient
      .from('servicios')
      .update({ is_active: false })
      .eq('user_id', authUser.userId),
  ]);

  if (keysRes.error && srvRes.error) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron pausar las API Keys activas en Supabase.',
    };
  }

  invalidateCoreCatalogCache();

  return {
    ok: true,
    pausedServicesCount: servicesList.length,
  };
}

export function buildClearQuotaCookiesHeaders(
  headers: IncomingHttpHeaders,
): string[] {
  const proto =
    typeof headers['x-forwarded-proto'] === 'string'
      ? headers['x-forwarded-proto']
      : '';
  const origin =
    typeof headers.origin === 'string' ? headers.origin : '';
  const isHttps =
    proto.toLowerCase().includes('https') ||
    origin.toLowerCase().startsWith('https://');
  const cookieAttrs = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';

  return [
    `${GUEST_EXTRACT_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    `${GUEST_IMAGE_BANK_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    `${SEARCH_LINK_IA_COOKIE_NAME}=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
  ];
}

export async function permanentlyDeleteUserAccount(
  authUser: AuthenticatedRequestUser,
  headers: IncomingHttpHeaders,
  remoteAddress?: string,
): Promise<
  | {
      ok: true;
      deletedR2Count: number;
      authDeleted: boolean;
      carriedPlan: 'free' | 'plus';
    }
  | { ok: false; status: number; error: string }
> {
  const userClient = createAuthenticatedUserClient(authUser.accessToken);
  if (!userClient) {
    return {
      ok: false,
      status: 500,
      error: 'Configuración de Supabase no disponible en el servidor.',
    };
  }

  const [{ data: orgRow }, { data: serviceRows }, { data: productRows }, { data: keyRows }] =
    await Promise.all([
      userClient
        .from('organizacion')
        .select('id, logo_url, logo_r2_key')
        .eq('user_id', authUser.userId)
        .maybeSingle(),
      userClient
        .from('servicios')
        .select('id, item_count')
        .eq('user_id', authUser.userId),
      userClient
        .from('servicio_productos')
        .select('id, r2_key, image_url')
        .eq('user_id', authUser.userId),
      userClient
        .from('servicio_api_keys')
        .select('id, servicio_id, requests_count, key_hash')
        .eq('user_id', authUser.userId),
    ]);

  const r2Keys: string[] = [];
  const logoKey = extractSafeMediaKey(orgRow?.logo_r2_key, orgRow?.logo_url);
  if (logoKey) r2Keys.push(logoKey);

  const productsList = Array.isArray(productRows) ? productRows : [];
  for (const prod of productsList) {
    const key = extractSafeMediaKey(prod?.r2_key, prod?.image_url);
    if (key) r2Keys.push(key);
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];
  const keysList = Array.isArray(keyRows) ? keyRows : [];

  const serviceItemsSum = servicesList.reduce((sum, srv) => {
    const c =
      typeof srv?.item_count === 'number' && Number.isFinite(srv.item_count)
        ? Math.max(0, Math.trunc(srv.item_count))
        : 0;
    return sum + c;
  }, 0);
  const activeImagesCount = Math.max(serviceItemsSum, productsList.length);

  let dbApiRequestsSum = 0;
  const keyHashes: string[] = [];
  for (const k of keysList) {
    if (
      typeof k?.requests_count === 'number' &&
      Number.isFinite(k.requests_count)
    ) {
      dbApiRequestsSum += Math.max(0, Math.trunc(k.requests_count));
    }
    if (typeof k?.key_hash === 'string' && k.key_hash.trim()) {
      keyHashes.push(k.key_hash.trim());
    }
  }

  let memApiRequestsSum = 0;
  for (const srv of servicesList) {
    if (typeof srv?.id === 'string' && srv.id) {
      memApiRequestsSum += getMonthlyApiRequestsForServiceScope(srv.id);
    }
  }

  const totalApiRequests = Math.max(dbApiRequestsSum, memApiRequestsSum);
  const apiMonth = getCurrentMonthKey();
  const chatDay = getTodayUtcDateString();
  const chatLimitStatus = checkDailyLimit(
    headers,
    authUser.userId,
    remoteAddress,
  );
  const hasPlus =
    hasImageBankPlusAccess(authUser.email, authUser.appMetadata) ||
    isAdminTestEmail(authUser.email);

  // 1. Delete all R2 media owned by this user
  const deletedR2Count = await deleteImagesFromR2(r2Keys);

  // 2. Record fallback ledger in RAM (mirrors SQL ledger logic)
  recordInMemoryDeletedAccountLedger({
    email: authUser.email,
    hasPlus,
    activeImages: activeImagesCount,
    apiMonth,
    apiRequests: totalApiRequests,
    chatDay,
    chatUsed: chatLimitStatus.used,
  });

  // 3. Execute atomic SQL archival & complete account deletion RPC
  let authDeleted = false;
  let rpcAvailable = true;

  const { data: rpcData, error: rpcError } = await userClient.rpc(
    'delete_my_account_permanently',
    {
      p_has_plus: hasPlus,
      p_api_month: apiMonth,
      p_api_requests: totalApiRequests,
      p_chat_day: chatDay,
      p_chat_used: chatLimitStatus.used,
    },
  );

  if (rpcError) {
    const missingRpc =
      rpcError.code === 'PGRST202' ||
      rpcError.message.includes('delete_my_account_permanently');
    if (!missingRpc) {
      return {
        ok: false,
        status: 500,
        error: `No se pudo completar el borrado definitivo de la cuenta: ${rpcError.message}`,
      };
    }
    rpcAvailable = false;
  } else if (rpcData && typeof rpcData === 'object') {
    authDeleted = Boolean((rpcData as Record<string, unknown>).auth_deleted);
  }

  // Fallback row cleanup if the SQL migration hasn't been executed yet
  if (!rpcAvailable) {
    await userClient
      .from('servicio_api_keys')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('servicio_productos')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('servicios')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('organizacion')
      .delete()
      .eq('user_id', authUser.userId);
    await userClient
      .from('servidores_externos')
      .delete()
      .eq('user_id', authUser.userId)
      .then(() => undefined, () => undefined);
    await userClient
      .from('mapping_jobs')
      .delete()
      .eq('user_id', authUser.userId)
      .then(() => undefined, () => undefined);
  }

  // Optional Service Role deletion guarantee if SQL didn't delete auth.users directly
  if (!authDeleted) {
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { error: adminErr } = await adminClient.auth.admin.deleteUser(
        authUser.userId,
      );
      if (!adminErr) {
        authDeleted = true;
      }
    }
  }

  // 4. Clear active API caches, external server status caches & verified JWT cache
  if (keyHashes.length > 0) {
    markExternalServerActiveForKeyHashes(keyHashes, false);
  }
  invalidateCoreCatalogCache();
  clearUserVerificationCacheByUserId(authUser.userId);

  return {
    ok: true,
    deletedR2Count,
    authDeleted,
    carriedPlan: hasPlus ? 'plus' : 'free',
  };
}
