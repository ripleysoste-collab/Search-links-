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
  getPlanLimitsForTier,
  getServiceTrafficLimitRule,
  GUEST_EXTRACT_COOKIE_NAME,
  GUEST_IMAGE_BANK_COOKIE_NAME,
  hydrateServiceTrafficLimitRuleFromDb,
  invalidateServiceLimitHydrationCache,
  invalidateServiceTrafficLimitRuleMemory,
  invalidateUserImageQuotaCache,
  isAdminTestEmail,
  normalizeAllowedOriginInput,
  type PlanLimitsSpec,
  type PlanTier,
  recordInMemoryDeletedAccountLedger,
  recordInMemoryR2PurgeLedger,
  registerUserPlanTier,
  resolveUserPlanTier,
  saveServiceTrafficLimitRule,
  type ServiceTrafficLimitRule,
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
  planTier: PlanTier;
  planLimits: PlanLimitsSpec;
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
  const planTier = resolveUserPlanTier(authUser.email, authUser.appMetadata);
  const planLimits = getPlanLimitsForTier(planTier);
  registerUserPlanTier(authUser.userId, planTier);
  const hasPlusAccess =
    planTier !== 'free' ||
    hasImageBankPlusAccess(authUser.email, authUser.appMetadata);
  const [activeImagesCount, ledger] = await Promise.all([
    fetchUserActiveDbImageCount(authUser),
    fetchUserFreeUsageLedger(authUser),
  ]);
  const carriedFreeImagesUsed = isAdmin ? 0 : ledger.freeImagesUsed;
  const totalFreeImagesUsed = isAdmin
    ? activeImagesCount
    : activeImagesCount + carriedFreeImagesUsed;
  const freeLimit = isAdmin ? planLimits.maxImages : FREE_PLAN_MAX_IMAGES;
  const remainingFreeImages = Math.max(0, freeLimit - totalFreeImagesUsed);

  return {
    ok: true,
    isAdmin,
    hasPlusAccess,
    planTier,
    planLimits,
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

  const [
    { data: orgRow },
    { data: serviceRows },
    { data: productRows },
    { data: keyRows },
  ] = await Promise.all([
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
    userClient
      .from('servicio_api_keys')
      .select('key_hash')
      .eq('user_id', authUser.userId),
  ]);

  const r2Keys: string[] = [];
  const logoKey = extractSafeMediaKey(orgRow?.logo_r2_key, orgRow?.logo_url);
  if (logoKey) {
    r2Keys.push(logoKey);
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];
  const productsList = Array.isArray(productRows) ? productRows : [];
  const keyHashes = (Array.isArray(keyRows) ? keyRows : [])
    .map((k) => (typeof k?.key_hash === 'string' ? k.key_hash.trim() : ''))
    .filter(Boolean);

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

  if (servicesList.length > 0 || productsList.length > 0) {
    const { error: keysDelErr } = await userClient
      .from('servicio_api_keys')
      .delete()
      .eq('user_id', authUser.userId);
    if (keysDelErr) {
      return {
        ok: false,
        status: 500,
        error: 'No se pudieron limpiar las API Keys asociadas.',
      };
    }

    const { error: prodDelErr } = await userClient
      .from('servicio_productos')
      .delete()
      .eq('user_id', authUser.userId);
    if (prodDelErr) {
      return {
        ok: false,
        status: 500,
        error: 'No se pudieron limpiar los productos publicados.',
      };
    }

    const { error: srvDelErr } = await userClient
      .from('servicios')
      .delete()
      .eq('user_id', authUser.userId);
    if (srvDelErr) {
      return {
        ok: false,
        status: 500,
        error: 'No se pudieron eliminar los servicios publicados.',
      };
    }
  }

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

  if (keyHashes.length > 0) {
    markExternalServerActiveForKeyHashes(keyHashes, false);
  }
  for (const srv of servicesList) {
    if (typeof srv?.id === 'string' && srv.id) {
      invalidateServiceTrafficLimitRuleMemory(srv.id);
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteUserCoreService(
  authUser: AuthenticatedRequestUser,
  serviceId: string,
): Promise<
  | { ok: true; deletedR2Count: number }
  | { ok: false; status: number; error: string }
> {
  const cleanServiceId = serviceId.trim();
  if (!cleanServiceId) {
    return {
      ok: false,
      status: 400,
      error: 'Identificador de servicio inválido.',
    };
  }

  // Local-only fallback services do not have a UUID in Supabase
  if (!UUID_REGEX.test(cleanServiceId)) {
    return { ok: true, deletedR2Count: 0 };
  }

  const userClient = createAuthenticatedUserClient(authUser.accessToken);
  if (!userClient) {
    return {
      ok: false,
      status: 500,
      error: 'Configuración de Supabase no disponible en el servidor.',
    };
  }

  const [
    { data: serviceRow, error: serviceFetchErr },
    { data: productRows },
    { data: keyRows },
  ] = await Promise.all([
    userClient
      .from('servicios')
      .select('id, public_slug, item_count')
      .eq('id', cleanServiceId)
      .eq('user_id', authUser.userId)
      .maybeSingle(),
    userClient
      .from('servicio_productos')
      .select('id, r2_key, image_url')
      .eq('servicio_id', cleanServiceId)
      .eq('user_id', authUser.userId),
    userClient
      .from('servicio_api_keys')
      .select('key_hash')
      .eq('servicio_id', cleanServiceId)
      .eq('user_id', authUser.userId),
  ]);

  if (serviceFetchErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudo verificar el servicio en Supabase.',
    };
  }

  if (!serviceRow) {
    return { ok: true, deletedR2Count: 0 };
  }

  const productsList = Array.isArray(productRows) ? productRows : [];
  const keyHashes = (Array.isArray(keyRows) ? keyRows : [])
    .map((k) => (typeof k?.key_hash === 'string' ? k.key_hash.trim() : ''))
    .filter(Boolean);

  const r2Keys: string[] = [];
  for (const prod of productsList) {
    const key = extractSafeMediaKey(prod?.r2_key, prod?.image_url);
    if (key) {
      r2Keys.push(key);
    }
  }

  const serviceItemCount =
    typeof serviceRow.item_count === 'number' &&
    Number.isFinite(serviceRow.item_count)
      ? Math.max(0, Math.trunc(serviceRow.item_count))
      : 0;
  const purgedCatalogImages = Math.max(
    serviceItemCount,
    productsList.length,
    r2Keys.length,
  );

  const deletedR2Count = await deleteImagesFromR2(r2Keys);

  const { error: keysDelErr } = await userClient
    .from('servicio_api_keys')
    .delete()
    .eq('servicio_id', cleanServiceId)
    .eq('user_id', authUser.userId);
  if (keysDelErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron eliminar las API Keys del servicio.',
    };
  }

  const { error: prodDelErr } = await userClient
    .from('servicio_productos')
    .delete()
    .eq('servicio_id', cleanServiceId)
    .eq('user_id', authUser.userId);
  if (prodDelErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron eliminar los productos del servicio.',
    };
  }

  const { error: srvDelErr } = await userClient
    .from('servicios')
    .delete()
    .eq('id', cleanServiceId)
    .eq('user_id', authUser.userId);
  if (srvDelErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudo eliminar el servicio.',
    };
  }

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

  if (keyHashes.length > 0) {
    markExternalServerActiveForKeyHashes(keyHashes, false);
  }
  invalidateServiceTrafficLimitRuleMemory(cleanServiceId);
  invalidateCoreCatalogCache(
    typeof serviceRow.public_slug === 'string'
      ? { slug: serviceRow.public_slug }
      : undefined,
  );
  invalidateUserImageQuotaCache(authUser.userId);

  return {
    ok: true,
    deletedR2Count,
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
    .select('id, public_slug, is_active')
    .eq('user_id', authUser.userId);

  if (servicesFetchErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron consultar los servicios para pausar sus APIs.',
    };
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];
  const activeCount = servicesList.filter((s) => s?.is_active !== false).length;

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

  if (keysRes.error || srvRes.error) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron pausar las API Keys activas en Supabase.',
    };
  }

  invalidateCoreCatalogCache();

  return {
    ok: true,
    pausedServicesCount: activeCount,
  };
}

export async function unfreezeAllUserApis(
  authUser: AuthenticatedRequestUser,
): Promise<
  | { ok: true; unfrozenServicesCount: number }
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

  const [{ data: serviceRows, error: servicesFetchErr }, { data: keyRows, error: keysFetchErr }] =
    await Promise.all([
      userClient
        .from('servicios')
        .select('id, is_active')
        .eq('user_id', authUser.userId),
      userClient
        .from('servicio_api_keys')
        .select('id, servicio_id, is_active, created_at')
        .eq('user_id', authUser.userId)
        .order('created_at', { ascending: false }),
    ]);

  if (servicesFetchErr || keysFetchErr) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron consultar los servicios para descongelar sus APIs.',
    };
  }

  const servicesList = Array.isArray(serviceRows) ? serviceRows : [];
  const pausedCount = servicesList.filter((s) => s?.is_active === false).length;

  // Never resurrect previously rotated/revoked API keys:
  // only activate the single most recent key for services that currently have zero active keys.
  const serviceKeyState = new Map<
    string,
    { hasActive: boolean; newestKeyId: string }
  >();
  for (const row of Array.isArray(keyRows) ? keyRows : []) {
    const keyId = typeof row?.id === 'string' ? row.id : '';
    const srvId = typeof row?.servicio_id === 'string' ? row.servicio_id : '';
    if (!keyId || !srvId) continue;

    const existing = serviceKeyState.get(srvId);
    if (!existing) {
      serviceKeyState.set(srvId, {
        hasActive: row.is_active === true,
        newestKeyId: keyId,
      });
    } else if (row.is_active === true) {
      existing.hasActive = true;
    }
  }

  const keyIdsToActivate: string[] = [];
  for (const entry of serviceKeyState.values()) {
    if (!entry.hasActive && entry.newestKeyId) {
      keyIdsToActivate.push(entry.newestKeyId);
    }
  }

  const keysUpdatePromise =
    keyIdsToActivate.length > 0
      ? userClient
          .from('servicio_api_keys')
          .update({ is_active: true })
          .eq('user_id', authUser.userId)
          .in('id', keyIdsToActivate)
      : Promise.resolve({ error: null });

  const [keysRes, srvRes] = await Promise.all([
    keysUpdatePromise,
    userClient
      .from('servicios')
      .update({ is_active: true })
      .eq('user_id', authUser.userId),
  ]);

  if (keysRes.error || srvRes.error) {
    return {
      ok: false,
      status: 500,
      error: 'No se pudieron reactivar las API Keys en Supabase.',
    };
  }

  invalidateCoreCatalogCache();

  return {
    ok: true,
    unfrozenServicesCount: pausedCount,
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

  // 2. Execute atomic SQL archival & complete account deletion RPC
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

  // 3. Record fallback ledger in RAM after deletion succeeded (mirrors SQL ledger logic)
  recordInMemoryDeletedAccountLedger({
    email: authUser.email,
    hasPlus,
    activeImages: activeImagesCount,
    apiMonth,
    apiRequests: totalApiRequests,
    chatDay,
    chatUsed: chatLimitStatus.used,
  });

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
  for (const srv of servicesList) {
    if (typeof srv?.id === 'string' && srv.id) {
      invalidateServiceTrafficLimitRuleMemory(srv.id);
    }
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

async function verifyOwnedServiceId(
  authUser: AuthenticatedRequestUser,
  serviceId: string,
): Promise<boolean> {
  const cleanId = serviceId.trim();
  if (!cleanId) return false;
  const userClient = createAuthenticatedUserClient(authUser.accessToken);
  if (!userClient) return true;
  try {
    const { data, error } = await userClient
      .from('servicios')
      .select('id')
      .eq('id', cleanId)
      .eq('user_id', authUser.userId)
      .maybeSingle();
    if (error) {
      // Allow local/transient fallback if table is not yet synced
      return error.code === 'PGRST205' || error.message.includes('servicios');
    }
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

function isMissingServicioLimitesError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('servicio_limites') && msg.includes('does not exist');
}

export async function getServiceTrafficLimitsForUser(
  authUser: AuthenticatedRequestUser,
  serviceId: string,
): Promise<
  | {
      ok: true;
      planTier: PlanTier;
      planLimits: PlanLimitsSpec;
      rule: ServiceTrafficLimitRule;
    }
  | { ok: false; status: number; error: string }
> {
  const cleanId = serviceId.trim();
  if (!cleanId) {
    return { ok: false, status: 400, error: 'Falta el identificador del servicio.' };
  }
  const owned = await verifyOwnedServiceId(authUser, cleanId);
  if (!owned) {
    return { ok: false, status: 404, error: 'Servicio no encontrado.' };
  }
  const planTier = resolveUserPlanTier(authUser.email, authUser.appMetadata);
  const planLimits = getPlanLimitsForTier(planTier);

  if (UUID_REGEX.test(cleanId)) {
    const userClient = createAuthenticatedUserClient(authUser.accessToken);
    if (userClient) {
      try {
        const { data, error } = await userClient
          .from('servicio_limites')
          .select(
            'per_minute_limit, per_hour_limit, daily_limit, allowed_origins, updated_at',
          )
          .eq('servicio_id', cleanId)
          .eq('user_id', authUser.userId)
          .maybeSingle();

        if (error) {
          if (!isMissingServicioLimitesError(error)) {
            return {
              ok: false,
              status: 500,
              error: 'No se pudieron consultar los límites de tráfico en Supabase.',
            };
          }
        } else if (data) {
          const rule = hydrateServiceTrafficLimitRuleFromDb({
            serviceId: cleanId,
            userId: authUser.userId,
            planTier,
            perMinuteLimit: Number(data.per_minute_limit),
            perHourLimit: Number(data.per_hour_limit),
            dailyLimit: Number(data.daily_limit),
            allowedOrigins: Array.isArray(data.allowed_origins)
              ? data.allowed_origins.filter(
                  (entry): entry is string => typeof entry === 'string',
                )
              : [],
            updatedAt:
              typeof data.updated_at === 'string' ? data.updated_at : '',
          });
          return {
            ok: true,
            planTier,
            planLimits,
            rule,
          };
        }
      } catch {
        // Fall through to in-memory/default rule if transient failure
      }
    }
  }

  const rule = getServiceTrafficLimitRule(cleanId, authUser.userId, planTier);
  return {
    ok: true,
    planTier,
    planLimits,
    rule,
  };
}

export async function saveServiceTrafficLimitsForUser(
  authUser: AuthenticatedRequestUser,
  input: {
    serviceId: string;
    perMinuteLimit: number;
    perHourLimit: number;
    dailyLimit: number;
    allowedOrigins: string[];
  },
): Promise<
  | {
      ok: true;
      planTier: PlanTier;
      planLimits: PlanLimitsSpec;
      rule: ServiceTrafficLimitRule;
    }
  | { ok: false; status: number; error: string }
> {
  const cleanId = input.serviceId.trim();
  if (!cleanId) {
    return { ok: false, status: 400, error: 'Falta el identificador del servicio.' };
  }
  const owned = await verifyOwnedServiceId(authUser, cleanId);
  if (!owned) {
    return { ok: false, status: 404, error: 'Servicio no encontrado.' };
  }

  const normalizedOrigins: string[] = [];
  for (const rawEntry of input.allowedOrigins) {
    const trimmed = typeof rawEntry === 'string' ? rawEntry.trim() : '';
    if (!trimmed) continue;
    const normalized = normalizeAllowedOriginInput(trimmed);
    if (!normalized) {
      return {
        ok: false,
        status: 400,
        error:
          'Ingresa URLs válidas con http:// o https:// en Seguridad rápida.',
      };
    }
    if (!normalizedOrigins.includes(normalized)) {
      normalizedOrigins.push(normalized);
    }
  }

  const planTier = resolveUserPlanTier(authUser.email, authUser.appMetadata);
  const planLimits = getPlanLimitsForTier(planTier);

  const clampedMinute = Math.max(
    1,
    Math.min(
      planLimits.maxRequestsPerMinute,
      Number.isFinite(input.perMinuteLimit)
        ? Math.trunc(input.perMinuteLimit)
        : planLimits.maxRequestsPerMinute,
    ),
  );
  const clampedHour = Math.max(
    1,
    Math.min(
      planLimits.maxRequestsPerHour,
      Number.isFinite(input.perHourLimit)
        ? Math.trunc(input.perHourLimit)
        : planLimits.maxRequestsPerHour,
    ),
  );
  const clampedDay = Math.max(
    1,
    Math.min(
      planLimits.maxRequestsPerDay,
      Number.isFinite(input.dailyLimit)
        ? Math.trunc(input.dailyLimit)
        : planLimits.maxRequestsPerDay,
    ),
  );

  let persistedUpdatedAt: string | undefined;

  if (UUID_REGEX.test(cleanId)) {
    const userClient = createAuthenticatedUserClient(authUser.accessToken);
    if (!userClient) {
      return {
        ok: false,
        status: 500,
        error: 'Configuración de Supabase no disponible en el servidor.',
      };
    }

    const { data: upsertedRow, error: upsertErr } = await userClient
      .from('servicio_limites')
      .upsert(
        {
          servicio_id: cleanId,
          user_id: authUser.userId,
          per_minute_limit: clampedMinute,
          per_hour_limit: clampedHour,
          daily_limit: clampedDay,
          allowed_origins: normalizedOrigins,
        },
        { onConflict: 'servicio_id' },
      )
      .select(
        'per_minute_limit, per_hour_limit, daily_limit, allowed_origins, updated_at',
      )
      .maybeSingle();

    if (upsertErr) {
      if (!isMissingServicioLimitesError(upsertErr)) {
        return {
          ok: false,
          status: 500,
          error: `No se pudieron guardar los límites en Supabase: ${upsertErr.message}`,
        };
      }
      // Graceful fallback to RAM if servicio_limites.sql hasn't been executed yet
    } else if (upsertedRow && typeof upsertedRow.updated_at === 'string') {
      persistedUpdatedAt = upsertedRow.updated_at;
    }
  }

  const rule = persistedUpdatedAt
    ? hydrateServiceTrafficLimitRuleFromDb({
        serviceId: cleanId,
        userId: authUser.userId,
        planTier,
        perMinuteLimit: clampedMinute,
        perHourLimit: clampedHour,
        dailyLimit: clampedDay,
        allowedOrigins: normalizedOrigins,
        updatedAt: persistedUpdatedAt,
      })
    : saveServiceTrafficLimitRule({
        serviceId: cleanId,
        userId: authUser.userId,
        planTier,
        perMinuteLimit: clampedMinute,
        perHourLimit: clampedHour,
        dailyLimit: clampedDay,
        allowedOrigins: normalizedOrigins,
      });

  invalidateServiceLimitHydrationCache(cleanId);
  invalidateCoreCatalogCache();

  return {
    ok: true,
    planTier,
    planLimits,
    rule,
  };
}
