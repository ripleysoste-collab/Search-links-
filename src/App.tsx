import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import { Bookmark, Link2, Loader2, PenLine, Upload, X } from 'lucide-react';
import desktopDesertBg from './assets/images/bg_desert_desktop_1794853953945.jpg';
import { AuthDrawer } from './components/AuthDrawer';
import { AutomationExamplesSection } from './components/AutomationExamplesSection';
import {
  DesktopAccountMenu,
  type DesktopMenuView,
} from './components/DesktopAccountMenu';
import { DesktopImageBankPanel } from './components/DesktopImageBankPanel';
import { ImageBankResultsGrid, ImageBankSavedGrid } from './components/ImageBankGrid';
import type {
  OrganizationProfile,
  OrganizationServiceItem,
  OrganizationServiceSnapshot,
} from './components/DesktopOrganizationView';
import {
  DualCatalogShowcase,
  type ServiceCredentialsDisplay,
} from './components/DualCatalogShowcase';
import { MobileAccountMenu } from './components/MobileAccountMenu';
import { LegalDocumentPage, type LegalDocId } from './components/LegalDocumentPage';
import {
  IMAGE_BANK_PATH,
  type AppRoute,
  buildAppRoutePath,
  isAuthCallbackPathname,
  isImageBankPathname,
  isProtectedAppRoute,
  normalizePathname,
  parseAppRoute,
  resolveLegalDocRouteFromPathname,
} from './lib/appRoutes';
import {
  MobileCatalogCarousel,
  type CompressedImageMeta,
  type ImageCompressionStatus,
  type ImageMapStatus,
  type ImageReceiveStatus,
  type ImageUploadStatus,
} from './components/MobileCatalogCarousel';
import { SearchLinkChatDrawer } from './components/SearchLinkChatDrawer';
import { SearchLinkLogo } from './components/SearchLinkLogo';
import { CATALOG_SAMPLE_IMAGES, type CatalogImageItem } from './data/catalogSamples';
import { isBlockedPolicyDomain } from '../lib/blockedDomains';
import { resolveApiUrl } from './lib/apiConfig';
import {
  fetchImageBankAccessStatus,
  generateAiImageFromPrompt,
  ImageBankClientError,
  loadSavedImageBankItems,
  saveImageBankItems,
  searchImageBank,
  type ImageBankImageItem,
} from './lib/imageBankClient';
import { useI18n } from './lib/i18n';
import {
  blobToDataUrl,
  compressImageToWebp,
  renderImageBlobFromUrl,
  type CompressedImageResult,
  type MappedImageMetadata,
} from './lib/imageCompression';
import {
  clearPendingJobTracking,
  fetchActiveMappingJob,
  fetchMappingJobStatus,
  readPendingJobCredentials,
  readUnacknowledgedJobId,
  savePendingJobCredentials,
  startBackgroundMappingJob,
  type MappingQueueJobClient,
  type MappingQueueJobStatus,
} from './lib/mappingQueueClient';
import {
  fetchAccountQuotaSummary,
  requestClearBrowserData,
  requestDeleteAccountPermanently,
  requestDeleteCoreService,
  requestPauseAllApis,
  requestPurgeAllR2Images,
  requestUnfreezeAllApis,
  wipeAccountLocalStorageEntries,
  wipeAllClientBrowsingStorage,
} from './lib/accountActionsClient';
import {
  buildCoreServiceEndpointUrl,
  generateCoreApiKey,
  generateCoreServiceSlug,
  isRawCoreApiKey,
} from './lib/searchLinkCore';
import {
  createCoreServiceInSupabase,
  fetchUserCoreServicesSafe,
  fetchUserOrganizationSafe,
  getSupabaseAccessToken,
  renameCoreServiceInSupabase,
  rotateCoreServiceApiKeyInSupabase,
  supabase,
  toggleCoreServiceActiveInSupabase,
  upsertUserOrganization,
} from './lib/supabaseClient';
import {
  hydrateAgencyConnectionFromCloud,
  triggerAgencyAutoSyncIfMatched,
  triggerAgencyAutoSyncOnBulkToggle,
} from './lib/agencySyncClient';

const MAX_FREE_UPLOAD_IMAGES = 20;
const MAX_GUEST_EXTRACT_IMAGES = 10;
const MAX_ADMIN_EXTRACT_IMAGES = 50;
const ADMIN_EXTRACT_ONLY_EMAIL = 'cristiancuerodiaz@gmail.com';
const COMPRESSION_START_DELAY_MS = 180;
const UPLOAD_START_DELAY_MS = 100;
const COMPRESS_CONCURRENCY = 6;
const JOB_POLL_INTERVAL_MS = 950;

type BatchImageSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

function isSavedCatalogCommand(value: string): boolean {
  return /^\/(?:cat[aá]logo|borrador)\/?$/i.test(value.trim());
}

export default function App() {
  const initialRoute = useMemo<AppRoute>(() => {
    if (typeof window === 'undefined') return { kind: 'home' };
    return parseAppRoute(window.location.pathname);
  }, []);

  const [url, setUrl] = useState('');
  const [catalogImages, setCatalogImages] = useState<CatalogImageItem[]>(
    CATALOG_SAMPLE_IMAGES,
  );
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [activeBgImage, setActiveBgImage] = useState<CatalogImageItem | null>(null);
  const [hasAnimatedFirstBg, setHasAnimatedFirstBg] = useState(false);
  const [shouldAnimateBgEntry, setShouldAnimateBgEntry] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(initialRoute.kind === 'login');
  const [activeDocRoute, setActiveDocRoute] = useState<LegalDocId | null>(
    initialRoute.kind === 'doc' ? initialRoute.docId : null,
  );
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [desktopMenuView, setDesktopMenuView] = useState<DesktopMenuView>('menu');
  const [isImageBankOpen, setIsImageBankOpen] = useState(
    initialRoute.kind === 'image-bank',
  );
  const [imageBankQuery, setImageBankQuery] = useState('');
  const [imageBankResults, setImageBankResults] = useState<ImageBankImageItem[]>([]);
  const [isImageBankSearching, setIsImageBankSearching] = useState(false);
  const [hasSearchedImageBank, setHasSearchedImageBank] = useState(false);
  const [imageBankError, setImageBankError] = useState<string | null>(null);
  const [imageBankGuestIpBlocked, setImageBankGuestIpBlocked] = useState(false);
  const [imageBankCooldownUntilMs, setImageBankCooldownUntilMs] = useState<number>(0);
  const [showImageBankCooldownNotice, setShowImageBankCooldownNotice] = useState(false);
  const [imageBankCooldownRemainingSec, setImageBankCooldownRemainingSec] = useState(0);
  const [hasImageBankPlusAccess, setHasImageBankPlusAccess] = useState(false);
  const [lastSearchedImageQuery, setLastSearchedImageQuery] = useState('');
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [generatedAiImage, setGeneratedAiImage] = useState<ImageBankImageItem | null>(null);
  const [showAiPlusRequiredNotice, setShowAiPlusRequiredNotice] = useState(false);
  const [aiGenerateError, setAiGenerateError] = useState<string | null>(null);
  const [savedImageBankItems, setSavedImageBankItems] = useState<ImageBankImageItem[]>(
    () => loadSavedImageBankItems(),
  );
  const [isImageBankSavedView, setIsImageBankSavedView] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAccountModalOpen, setIsMobileAccountModalOpen] = useState(false);
  const [isMobileLanguageModalOpen, setIsMobileLanguageModalOpen] = useState(false);
  const [isMobileConnectServerOpen, setIsMobileConnectServerOpen] = useState(false);
  const [isMobileAdvancedSettingsOpen, setIsMobileAdvancedSettingsOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [mobilePanelSubView, setMobilePanelSubView] = useState<
    | 'organization'
    | 'store'
    | 'api-key'
    | 'endpoint-test'
    | 'traffic'
    | 'traffic-limit'
  >('organization');
  const [selectedStoreServiceId, setSelectedStoreServiceId] = useState<string | null>(
    null,
  );
  const [selectedSchemaServiceId, setSelectedSchemaServiceId] = useState<string | null>(
    null,
  );
  const [selectedApiKeyServiceId, setSelectedApiKeyServiceId] = useState<string | null>(
    null,
  );
  const [selectedEndpointTestServiceId, setSelectedEndpointTestServiceId] = useState<
    string | null
  >(null);
  const [selectedTrafficServiceId, setSelectedTrafficServiceId] = useState<string | null>(
    null,
  );
  const [selectedTrafficLimitServiceId, setSelectedTrafficLimitServiceId] = useState<
    string | null
  >(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [isFileUploadFlow, setIsFileUploadFlow] = useState(false);
  const [isReadOnlyReplay, setIsReadOnlyReplay] = useState(false);
  const [showCompressionBox, setShowCompressionBox] = useState(false);
  const [compressionStatuses, setCompressionStatuses] = useState<
    Record<string, ImageCompressionStatus>
  >({});
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<
    Record<string, ImageUploadStatus>
  >({});
  const [showReceiveBox, setShowReceiveBox] = useState(false);
  const [receiveStatuses, setReceiveStatuses] = useState<
    Record<string, ImageReceiveStatus>
  >({});
  const [showMapBox, setShowMapBox] = useState(false);
  const [mapStatuses, setMapStatuses] = useState<
    Record<string, ImageMapStatus>
  >({});
  const [mappedResults, setMappedResults] = useState<
    Record<string, MappedImageMetadata>
  >({});
  const [compressionResults, setCompressionResults] = useState<
    Record<string, CompressedImageMeta>
  >({});
  const [activeJobStatus, setActiveJobStatus] =
    useState<MappingQueueJobStatus | null>(null);
  const [jobPlanBRolledBack, setJobPlanBRolledBack] = useState(false);
  const [jobPolicyBlocked, setJobPolicyBlocked] = useState(false);
  const [jobLifecycleNotice, setJobLifecycleNotice] = useState<string | null>(
    null,
  );
  const [pendingDomainBatch, setPendingDomainBatch] = useState<{
    items: CatalogImageItem[];
    originUrl: string;
    overflowNotice: string | null;
    promptKind?: 'domain' | 'savedCatalog';
    legalAccepted?: boolean;
  } | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile>({
    name: 'Sin nombre',
    logoUrl: null,
    logoR2Key: null,
    hasCompletedSetup: false,
  });
  const [orgServices, setOrgServices] = useState<OrganizationServiceItem[]>([]);
  const [carriedFreeImagesUsed, setCarriedFreeImagesUsed] = useState(0);
  const [activeChatServiceId, setActiveChatServiceId] = useState<string | null>(
    null,
  );
  const [activeServiceCredentials, setActiveServiceCredentials] =
    useState<ServiceCredentialsDisplay | null>(null);
  const [guestIpBlocked, setGuestIpBlocked] = useState(false);
  const authUserRef = useRef<User | null>(null);
  const authResolvedRef = useRef<boolean>(!supabase);
  const orgServicesRef = useRef<OrganizationServiceItem[]>([]);
  const isDesktopViewportRef = useRef<boolean>(isDesktopViewport);
  const pendingProtectedRouteRef = useRef<AppRoute | null>(
    isProtectedAppRoute(initialRoute) ? initialRoute : null,
  );
  const pendingServiceSlugRef = useRef<{
    kind:
      | 'store'
      | 'schema'
      | 'api-key'
      | 'endpoint-test'
      | 'traffic'
      | 'traffic-limit'
      | 'search-ia';
    slug?: string;
  } | null>(
    initialRoute.kind === 'store' ||
      initialRoute.kind === 'schema' ||
      initialRoute.kind === 'api-key' ||
      initialRoute.kind === 'endpoint-test' ||
      initialRoute.kind === 'traffic' ||
      initialRoute.kind === 'traffic-limit' ||
      initialRoute.kind === 'search-ia'
      ? { kind: initialRoute.kind, slug: initialRoute.slug }
      : null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const imageBankMobileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageBankAbortRef = useRef<AbortController | null>(null);
  const aiGenerateAbortRef = useRef<AbortController | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);
  const compressionAbortRef = useRef<AbortController | null>(null);
  const compressionTimerRef = useRef<number | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const jobPollTimerRef = useRef<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const docReturnToAuthRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();

  const savedImageBankIds = useMemo(
    () => new Set(savedImageBankItems.map((item) => item.id)),
    [savedImageBankItems],
  );

  const isMobileImageBankActive = isImageBankOpen && !isDesktopViewport;
  const isDesktopImageBankActive = isImageBankOpen && isDesktopViewport;

  useEffect(() => {
    isDesktopViewportRef.current = isDesktopViewport;
  }, [isDesktopViewport]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => {
      const nextDesktop = mq.matches;
      isDesktopViewportRef.current = nextDesktop;
      setIsDesktopViewport(nextDesktop);
      if (authUserRef.current) {
        const currentRoute = parseAppRoute(window.location.pathname);
        if (isProtectedAppRoute(currentRoute) && currentRoute.kind !== 'search-ia') {
          applyRouteToState(currentRoute, { isDesktop: nextDesktop });
        }
      }
    };
    syncViewport();
    mq.addEventListener('change', syncViewport);
    return () => mq.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileImageBankActive) return;
    const focusTimer = window.setTimeout(() => {
      if (!isImageBankSavedView) {
        imageBankMobileInputRef.current?.focus();
      }
    }, 220);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isImageBankSavedView) {
          setIsImageBankSavedView(false);
        } else {
          setIsImageBankOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileImageBankActive, isImageBankSavedView]);

  useEffect(() => {
    if (imageBankCooldownUntilMs <= 0) {
      setImageBankCooldownRemainingSec(0);
      setShowImageBankCooldownNotice(false);
      return;
    }

    const updateRemaining = () => {
      const remainingMs = imageBankCooldownUntilMs - Date.now();
      if (remainingMs <= 0) {
        setImageBankCooldownRemainingSec(0);
        setImageBankCooldownUntilMs(0);
        setShowImageBankCooldownNotice(false);
      } else {
        setImageBankCooldownRemainingSec(Math.ceil(remainingMs / 1000));
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [imageBankCooldownUntilMs]);

  const formatCooldownWaitText = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m`;
    return `${secs}s`;
  };

  useEffect(() => {
    let active = true;
    const isAdminOrMetaPlus = Boolean(
      authUser &&
        (authUser.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL ||
          authUser.app_metadata?.plan === 'plus' ||
          authUser.app_metadata?.plan === 'pro' ||
          authUser.app_metadata?.tier === 'plus' ||
          authUser.app_metadata?.tier === 'pro'),
    );
    if (isAdminOrMetaPlus) {
      setHasImageBankPlusAccess(true);
    } else if (!authUser) {
      setHasImageBankPlusAccess(false);
    }
    if (authUser) {
      setImageBankGuestIpBlocked(false);
    }

    void fetchImageBankAccessStatus()
      .then((status) => {
        if (!active) return;
        setHasImageBankPlusAccess(status.hasPlusAccess || isAdminOrMetaPlus);
        setImageBankGuestIpBlocked(authUser ? false : status.guestIpBlocked);
      })
      .catch(() => {
        if (!active) return;
        setHasImageBankPlusAccess(isAdminOrMetaPlus);
      });
    return () => {
      active = false;
    };
  }, [authUser]);

  const imageBankCooldownMessage =
    showImageBankCooldownNotice && imageBankCooldownRemainingSec > 0
      ? t.imageBank.cooldownNotice(formatCooldownWaitText(imageBankCooldownRemainingSec))
      : null;

  const imageBankPlusNotice = showAiPlusRequiredNotice
    ? t.imageBank.plusRequiredNotice
    : null;

  const imageBankGuestIpBlockedNotice =
    !authUser && imageBankGuestIpBlocked ? t.app.guestIpBlockedError : null;

  const usedFreeImages =
    carriedFreeImagesUsed +
    orgServices.reduce(
      (sum, srv) => sum + (srv.itemCount || srv.products?.length || 0),
      0,
    );
  const getRemainingFreeImages = (user: User | null): number => {
    if (!user) return MAX_GUEST_EXTRACT_IMAGES;
    if (user.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL) {
      return MAX_ADMIN_EXTRACT_IMAGES;
    }
    return Math.max(0, MAX_FREE_UPLOAD_IMAGES - usedFreeImages);
  };

  const cancelOngoingCompression = () => {
    if (compressionTimerRef.current !== null) {
      window.clearTimeout(compressionTimerRef.current);
      compressionTimerRef.current = null;
    }
    if (jobPollTimerRef.current !== null) {
      window.clearTimeout(jobPollTimerRef.current);
      jobPollTimerRef.current = null;
    }
    activeJobIdRef.current = null;
    compressionAbortRef.current?.abort();
    compressionAbortRef.current = null;
  };

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (authUser) {
        setGuestIpBlocked(false);
        setExtractError(null);
        const token = await getSupabaseAccessToken();
        if (token && active) {
          await fetch(resolveApiUrl('/api/extract'), {
            method: 'GET',
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }).catch(() => {});
        }
        return;
      }

      try {
        const res = await fetch(resolveApiUrl('/api/extract'), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as {
          ipBlocked?: boolean;
        };
        if (active && data.ipBlocked) {
          setGuestIpBlocked(true);
        }
      } catch {
        // Ignore initial status check errors
      }
    })();

    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    orgServicesRef.current = orgServices;
  }, [orgServices]);

  useEffect(() => {
    if (!authUser) {
      setOrgProfile({
        name: 'Sin nombre',
        logoUrl: null,
        logoR2Key: null,
        hasCompletedSetup: false,
      });
      setOrgServices([]);
      setCarriedFreeImagesUsed(0);
      return;
    }

    let localOrgProfile: OrganizationProfile | null = null;
    let localServicesList: OrganizationServiceItem[] = [];

    try {
      const savedOrg = window.localStorage.getItem(`searchlink_org_${authUser.id}`);
      if (savedOrg) {
        const parsed = JSON.parse(savedOrg) as Partial<OrganizationProfile>;
        localOrgProfile = {
          name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Sin nombre',
          logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null,
          logoR2Key: typeof parsed.logoR2Key === 'string' ? parsed.logoR2Key : null,
          hasCompletedSetup: Boolean(parsed.hasCompletedSetup),
        };
        setOrgProfile(localOrgProfile);
      } else {
        setOrgProfile({
          name: 'Sin nombre',
          logoUrl: null,
          logoR2Key: null,
          hasCompletedSetup: false,
        });
      }

      const savedServices = window.localStorage.getItem(
        `searchlink_services_${authUser.id}`,
      );
      if (savedServices) {
        const parsedServices = JSON.parse(savedServices) as OrganizationServiceItem[];
        localServicesList = Array.isArray(parsedServices) ? parsedServices : [];
        setOrgServices(localServicesList);
      } else {
        setOrgServices([]);
      }
    } catch {
      setOrgProfile({
        name: 'Sin nombre',
        logoUrl: null,
        logoR2Key: null,
        hasCompletedSetup: false,
      });
      setOrgServices([]);
    }

    let active = true;
    void (async () => {
      const [
        { organization, tableMissing: orgMissing },
        { services: remoteServices, tableMissing: srvMissing },
        quotaSummary,
      ] = await Promise.all([
        fetchUserOrganizationSafe(),
        fetchUserCoreServicesSafe(),
        fetchAccountQuotaSummary(),
        hydrateAgencyConnectionFromCloud(authUser.id),
      ]);

      if (!active) return;

      if (quotaSummary) {
        setCarriedFreeImagesUsed(quotaSummary.carriedFreeImagesUsed);
      }

      if (!orgMissing) {
        if (organization) {
          const remoteProfile: OrganizationProfile = {
            name: organization.nombre?.trim() || 'Sin nombre',
            logoUrl: organization.logo_url ?? null,
            logoR2Key: organization.logo_r2_key ?? null,
            hasCompletedSetup: Boolean(organization.has_completed_setup),
          };
          setOrgProfile(remoteProfile);
          try {
            window.localStorage.setItem(
              `searchlink_org_${authUser.id}`,
              JSON.stringify(remoteProfile),
            );
          } catch {
            // Ignore storage quota errors
          }
        } else if (localOrgProfile?.hasCompletedSetup) {
          // Migrate existing local onboarding record into Supabase public.organizacion
          await upsertUserOrganization(localOrgProfile);
        }
      }

      if (!srvMissing && remoteServices.length > 0) {
        const mergedServices: OrganizationServiceItem[] = remoteServices.map((row) => {
          const activeKeyRow =
            row.servicio_api_keys.find((k) => k.is_active) ??
            row.servicio_api_keys[0] ??
            null;
          const localMatch = localServicesList.find(
            (s) => s.id === row.id || (s.slug && s.slug === row.public_slug),
          );
          const preserveLocalRawKey =
            localMatch &&
            isRawCoreApiKey(localMatch.apiKey) &&
            (!activeKeyRow || localMatch.keyPrefix === activeKeyRow.key_prefix);

          const totalRequests = row.servicio_api_keys.reduce(
            (sum, k) => sum + (k.requests_count || 0),
            0,
          );

          return {
            id: row.id,
            slug: row.public_slug,
            name: row.nombre,
            apiKey: preserveLocalRawKey
              ? localMatch!.apiKey
              : activeKeyRow?.key_prefix || 'sl_core_...',
            keyPrefix: activeKeyRow?.key_prefix,
            endpointUrl: buildCoreServiceEndpointUrl(row.public_slug),
            isActive: row.is_active,
            requestsCount: totalRequests,
            itemCount: row.item_count || row.servicio_productos.length,
            createdAt: row.created_at,
            products: row.servicio_productos.map((prod) => ({
              id: prod.id,
              nombre: prod.nombre,
              categoria: prod.categoria,
              descripcion: prod.descripcion,
              url: prod.image_url,
            })),
            snapshot:
              localMatch?.snapshot ??
              ((row.snapshot_json as OrganizationServiceSnapshot | null) || undefined),
          };
        });

        setOrgServices(mergedServices);
        try {
          window.localStorage.setItem(
            `searchlink_services_${authUser.id}`,
            JSON.stringify(mergedServices),
          );
        } catch {
          // Ignore storage quota errors
        }
      }

      // Auto-resume any background mapping job running or just completed on Render
      if (!activeJobIdRef.current) {
        try {
          const activeJob = await fetchActiveMappingJob();
          if (!active || !activeJob || activeJobIdRef.current) return;

          const pendingTrackedId = readUnacknowledgedJobId(authUser.id);
          const isRunning =
            activeJob.status === 'uploading_r2' ||
            activeJob.status === 'running' ||
            activeJob.status === 'cooling_down';
          const shouldRestoreFinished =
            pendingTrackedId === activeJob.id &&
            (activeJob.status === 'completed' ||
              activeJob.status === 'failed_rolled_back');

          if (isRunning || shouldRestoreFinished) {
            hydrateStateFromQueueJob(activeJob);
            if (isRunning) {
              activeJobIdRef.current = activeJob.id;
              const controller = new AbortController();
              compressionAbortRef.current = controller;
              void monitorBackgroundMappingJob(
                activeJob,
                controller.signal,
                authUser.id,
              );
            } else {
              await finalizeCompletedQueueJob(activeJob, authUser.id);
            }
          }
        } catch {
          // Ignore non-critical resume errors
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [authUser]);

  const applyQueueJobProgress = (job: MappingQueueJobClient) => {
    const nextUploadStatuses: Record<string, ImageUploadStatus> = {};
    const nextReceiveStatuses: Record<string, ImageReceiveStatus> = {};
    const nextMapStatuses: Record<string, ImageMapStatus> = {};
    const nextMappedResults: Record<string, MappedImageMetadata> = {};
    const nextCompressionResults: Record<string, CompressedImageMeta> = {};

    for (const item of job.items) {
      const fallbackUploadDone =
        !item.r2Deleted && Boolean(item.r2Key) && Boolean(item.imageUrl);
      const uStatus: ImageUploadStatus = item.r2Deleted
        ? 'error'
        : item.uploadStatus || (fallbackUploadDone ? 'done' : 'pending');
      const rStatus: ImageReceiveStatus = item.r2Deleted
        ? 'error'
        : item.receiveStatus || (item.imageUrl ? 'received' : 'waiting');

      nextUploadStatuses[item.clientItemId] = uStatus;
      nextReceiveStatuses[item.clientItemId] = rStatus;

      if (item.status === 'mapped' && item.mapped) {
        nextMapStatuses[item.clientItemId] = 'mapped';
        nextMappedResults[item.clientItemId] = item.mapped;
      } else if (item.status === 'failed') {
        nextMapStatuses[item.clientItemId] = 'error';
      } else if (item.status === 'processing') {
        nextMapStatuses[item.clientItemId] = 'mapping';
      } else {
        nextMapStatuses[item.clientItemId] = 'waiting';
      }

      if (!item.r2Deleted && item.imageUrl) {
        nextCompressionResults[item.clientItemId] = {
          url: item.imageUrl,
          cleanUrl: item.imageUrl,
          savedPercent: item.savedPercent,
          compressedBytes: item.compressedBytes,
        };
      }
    }

    setUploadStatuses((prev) => ({ ...prev, ...nextUploadStatuses }));
    setReceiveStatuses((prev) => ({ ...prev, ...nextReceiveStatuses }));
    setMapStatuses(nextMapStatuses);
    setMappedResults(nextMappedResults);
    setCompressionResults((prev) => ({
      ...prev,
      ...nextCompressionResults,
    }));

    setActiveJobStatus(job.status);
    setJobPlanBRolledBack(
      Boolean(job.planBRolledBack || job.status === 'failed_rolled_back'),
    );
    setJobPolicyBlocked(
      Boolean(
        job.policyBlocked ||
          job.items.some((i) => i.errorKind === 'policy'),
      ),
    );
    setJobLifecycleNotice(job.policyReason || job.notice || null);

    if (
      job.status !== 'uploading_r2' ||
      job.planBRolledBack ||
      job.policyBlocked
    ) {
      setShowReceiveBox(true);
      setShowMapBox(true);
    }

    if (job.status === 'cooling_down' && job.cooldownUntil) {
      const secs = Math.max(
        1,
        Math.ceil((job.cooldownUntil - Date.now()) / 1000),
      );
      setBatchNotice(
        `Cola en segundo plano (${job.mappedCount}/${job.totalItems}): pausa de ${secs}s para evitar saturación 503...`,
      );
    } else if (job.notice) {
      setBatchNotice(job.notice);
    } else if (job.status === 'running') {
      setBatchNotice(
        `Mapeando en segundo plano (${job.mappedCount}/${job.totalItems}) · Puedes salir y volver cuando quieras.`,
      );
    }
  };

  const hydrateStateFromQueueJob = (job: MappingQueueJobClient) => {
    const hydratedImages: CatalogImageItem[] = job.items.map((item, idx) => ({
      id: item.clientItemId,
      url: item.imageUrl || item.originalUrl || '',
      cleanUrl: item.imageUrl || item.originalUrl || '',
      sourcePageUrl: item.originalUrl,
      alt: item.mapped?.nombre || t.app.imageFallbackAlt(idx + 1),
    }));

    const compStatuses: Record<string, ImageCompressionStatus> = {};
    for (const item of job.items) {
      compStatuses[item.clientItemId] =
        item.r2Deleted || item.uploadStatus === 'error' ? 'error' : 'done';
    }

    setHasSearched(true);
    setIsReadOnlyReplay(false);
    setIsFileUploadFlow(true);
    setCatalogImages(hydratedImages);
    setCatalogVersion((prev) => prev + 1);
    setShowCompressionBox(true);
    setShowUploadBox(true);
    setShowReceiveBox(job.status !== 'uploading_r2');
    setShowMapBox(
      job.status === 'running' ||
        job.status === 'cooling_down' ||
        job.status === 'completed' ||
        job.status === 'failed_rolled_back' ||
        job.status === 'cancelled',
    );
    setCompressionStatuses(compStatuses);
    applyQueueJobProgress(job);
  };

  const finalizeCompletedQueueJob = async (
    job: MappingQueueJobClient,
    userId: string,
    mintedCredentials?: {
      rawKey: string;
      keyPrefix: string;
      keyHash: string;
      endpointUrl: string;
    },
  ) => {
    activeJobIdRef.current = null;
    applyQueueJobProgress(job);

    if (job.status === 'failed_rolled_back' || job.planBRolledBack) {
      setJobPlanBRolledBack(true);
      setJobPolicyBlocked(
        Boolean(
          job.policyBlocked ||
            job.items.some((i) => i.errorKind === 'policy'),
        ),
      );
      const rollbackReason =
        job.policyReason ||
        job.notice ||
        'Plan B activado: el mapeo falló definitivamente y se eliminaron las imágenes de R2.';
      setJobLifecycleNotice(rollbackReason);
      setBatchNotice(rollbackReason);
      clearPendingJobTracking(userId, job.id);
      return;
    }

    const mappedItems = job.items
      .filter((item) => item.status === 'mapped' && item.mapped)
      .map((item) => ({
        ...item.mapped!,
        r2Key: item.r2Key,
        savedPercent: item.savedPercent,
      }));

    if (mappedItems.length === 0) {
      clearPendingJobTracking(userId, job.id);
      return;
    }

    const cachedCreds = readPendingJobCredentials(userId, job.id);
    const endpointUrl =
      mintedCredentials?.endpointUrl ||
      cachedCreds?.endpointUrl ||
      buildCoreServiceEndpointUrl(job.serviceSlug);
    const displayKey =
      mintedCredentials?.rawKey ||
      cachedCreds?.apiKey ||
      'sl_core_...';
    const keyPrefix =
      mintedCredentials?.keyPrefix || cachedCreds?.keyPrefix || '';

    const firstProductName =
      mappedItems[0]?.nombre?.trim() || t.common.productFallback;
    const defaultServiceName =
      job.serviceName?.trim() ||
      (/^(?:servicio|service|serviço)\s+/i.test(firstProductName)
        ? firstProductName
        : t.app.serviceDefaultPrefix(firstProductName));

    if (isRawCoreApiKey(displayKey)) {
      setActiveServiceCredentials({
        serviceName: defaultServiceName,
        apiKey: displayKey,
        endpointUrl,
        slug: job.serviceSlug,
      });
    }

    const snapshotImages: CatalogImageItem[] = job.items.map((item, idx) => ({
      id: item.clientItemId,
      url: item.imageUrl,
      cleanUrl: item.imageUrl,
      sourcePageUrl: item.originalUrl,
      alt: item.mapped?.nombre || t.app.imageFallbackAlt(idx + 1),
    }));

    const serviceSnapshot: OrganizationServiceSnapshot = {
      images: snapshotImages,
      compressionStatuses: Object.fromEntries(
        job.items.map((i) => [i.clientItemId, i.r2Deleted ? 'error' : 'done']),
      ),
      uploadStatuses: Object.fromEntries(
        job.items.map((i) => [i.clientItemId, i.r2Deleted ? 'error' : 'done']),
      ),
      receiveStatuses: Object.fromEntries(
        job.items.map((i) => [
          i.clientItemId,
          i.r2Deleted ? 'error' : 'received',
        ]),
      ),
      mapStatuses: Object.fromEntries(
        job.items.map((i) => [
          i.clientItemId,
          i.status === 'mapped' ? 'mapped' : 'error',
        ]),
      ),
      mappedResults: Object.fromEntries(
        job.items
          .filter((i) => i.status === 'mapped' && i.mapped)
          .map((i) => [i.clientItemId, i.mapped!]),
      ),
      compressionResults: Object.fromEntries(
        job.items
          .filter((i) => !i.r2Deleted)
          .map((i) => [
            i.clientItemId,
            {
              url: i.imageUrl,
              cleanUrl: itemSafeUrl(i.imageUrl),
              savedPercent: i.savedPercent,
              compressedBytes: i.compressedBytes,
            },
          ]),
      ),
    };

    function itemSafeUrl(u: string) {
      return u;
    }

    let resolvedServiceId = job.serviceId;
    if (!resolvedServiceId && mintedCredentials) {
      const coreSave = await createCoreServiceInSupabase({
        publicSlug: job.serviceSlug,
        nombre: defaultServiceName,
        sourceType: job.sourceType,
        sourceUrl: job.sourceUrl,
        keyPrefix: mintedCredentials.keyPrefix,
        keyHash: mintedCredentials.keyHash,
        snapshotJson: serviceSnapshot,
        items: mappedItems,
      });
      if (coreSave.saved && coreSave.serviceId) {
        resolvedServiceId = coreSave.serviceId;
      }
    }

    const finalServiceId =
      resolvedServiceId || `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newService: OrganizationServiceItem = {
      id: finalServiceId,
      slug: job.serviceSlug,
      name: defaultServiceName,
      apiKey: displayKey,
      keyPrefix: keyPrefix || undefined,
      endpointUrl,
      isActive: true,
      requestsCount: 0,
      itemCount: mappedItems.length,
      createdAt: job.createdAt || new Date().toISOString(),
      products: mappedItems.map((item, idx) => ({
        id: `prod-${Date.now()}-${idx}`,
        nombre: item.nombre,
        categoria: item.categoria,
        descripcion: item.descripcion,
        url: item.url,
      })),
      snapshot: serviceSnapshot,
    };

    const nextServicesList = [
      newService,
      ...orgServicesRef.current.filter(
        (srv) => srv.id !== finalServiceId && srv.slug !== job.serviceSlug,
      ),
    ];
    orgServicesRef.current = nextServicesList;
    setOrgServices(nextServicesList);
    try {
      window.localStorage.setItem(
        `searchlink_services_${userId}`,
        JSON.stringify(nextServicesList),
      );
    } catch {
      // Ignore storage errors
    }

    if (mappedItems.length > 0) {
      void triggerAgencyAutoSyncIfMatched({
        userId,
        eventType: 'service.created',
        serviceId: finalServiceId,
        services: nextServicesList,
      });
    }

    if (!job.notice) {
      setBatchNotice(t.app.coreSavedNotice);
    }
    clearPendingJobTracking(userId, job.id);
  };

  const monitorBackgroundMappingJob = async (
    initialJob: MappingQueueJobClient,
    signal: AbortSignal,
    userId: string,
    mintedCredentials?: {
      rawKey: string;
      keyPrefix: string;
      keyHash: string;
      endpointUrl: string;
    },
  ) => {
    let latestJob = initialJob;
    applyQueueJobProgress(latestJob);

    while (
      !signal.aborted &&
      (latestJob.status === 'uploading_r2' ||
        latestJob.status === 'running' ||
        latestJob.status === 'cooling_down')
    ) {
      await new Promise<void>((resolve) => {
        jobPollTimerRef.current = window.setTimeout(() => {
          jobPollTimerRef.current = null;
          resolve();
        }, JOB_POLL_INTERVAL_MS);
      });

      if (signal.aborted) return;

      try {
        const fetched = await fetchMappingJobStatus(latestJob.id, signal);
        if (!fetched) break;
        latestJob = fetched;
        applyQueueJobProgress(latestJob);
      } catch {
        // Transient network hiccup while polling; keep retrying while Render continues
      }
    }

    if (signal.aborted) return;
    await finalizeCompletedQueueJob(latestJob, userId, mintedCredentials);
  };

  const handleSaveOrgProfile = (next: OrganizationProfile) => {
    setOrgProfile(next);
    const currentUser = authUserRef.current;
    if (currentUser) {
      try {
        window.localStorage.setItem(
          `searchlink_org_${currentUser.id}`,
          JSON.stringify(next),
        );
      } catch {
        // Ignore storage quota errors cleanly
      }
      void upsertUserOrganization(next);
    }
  };

  const notifyServiceEditedForAgencySync = (
    serviceId: string,
    updatedServices: OrganizationServiceItem[],
  ) => {
    const currentUser = authUserRef.current;
    if (!currentUser) return;
    void triggerAgencyAutoSyncIfMatched({
      userId: currentUser.id,
      eventType: 'service.updated',
      serviceId,
      services: updatedServices,
    });
  };

  const handleRenameService = (serviceId: string, nextName: string) => {
    const updated = orgServicesRef.current.map((srv) =>
      srv.id === serviceId ? { ...srv, name: nextName } : srv,
    );
    orgServicesRef.current = updated;
    setOrgServices(updated);
    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage quota errors
      }
    }
    void renameCoreServiceInSupabase(serviceId, nextName).finally(() => {
      notifyServiceEditedForAgencySync(serviceId, updated);
    });
  };

  const handleRotateServiceKey = async (
    serviceId: string,
  ): Promise<string | null> => {
    const minted = await generateCoreApiKey();
    const updated = orgServicesRef.current.map((srv) =>
      srv.id === serviceId
        ? { ...srv, apiKey: minted.rawKey, keyPrefix: minted.keyPrefix }
        : srv,
    );
    orgServicesRef.current = updated;
    setOrgServices(updated);
    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage quota errors
      }
    }
    setActiveServiceCredentials((prev) =>
      prev ? { ...prev, apiKey: minted.rawKey } : prev,
    );
    await rotateCoreServiceApiKeyInSupabase({
      serviceId,
      keyPrefix: minted.keyPrefix,
      keyHash: minted.keyHash,
    });
    return minted.rawKey;
  };

  const handleToggleServiceActive = async (
    serviceId: string,
    nextActive: boolean,
  ): Promise<void> => {
    const updated = orgServicesRef.current.map((srv) =>
      srv.id === serviceId ? { ...srv, isActive: nextActive } : srv,
    );
    orgServicesRef.current = updated;
    setOrgServices(updated);
    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage quota errors
      }
    }
    await toggleCoreServiceActiveInSupabase(serviceId, nextActive);
    notifyServiceEditedForAgencySync(serviceId, updated);
  };

  const handleDeleteService = async (serviceId: string): Promise<void> => {
    const deletedService = orgServicesRef.current.find(
      (srv) => srv.id === serviceId,
    );
    await requestDeleteCoreService(serviceId);

    const updated = orgServicesRef.current.filter((srv) => srv.id !== serviceId);
    orgServicesRef.current = updated;
    setOrgServices(updated);

    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage quota errors
      }
    }

    setSelectedStoreServiceId((prev) => (prev === serviceId ? null : prev));
    setSelectedSchemaServiceId((prev) => (prev === serviceId ? null : prev));
    setSelectedApiKeyServiceId((prev) => (prev === serviceId ? null : prev));
    setSelectedEndpointTestServiceId((prev) => (prev === serviceId ? null : prev));
    setSelectedTrafficServiceId((prev) => (prev === serviceId ? null : prev));
    setSelectedTrafficLimitServiceId((prev) => (prev === serviceId ? null : prev));
    setActiveChatServiceId((prev) => (prev === serviceId ? null : prev));
    if (deletedService) {
      setActiveServiceCredentials((prev) =>
        prev && prev.endpointUrl === deletedService.endpointUrl ? null : prev,
      );
    }

    if (authUserRef.current && updated.length > 0) {
      void triggerAgencyAutoSyncOnBulkToggle({
        userId: authUserRef.current.id,
        services: updated,
      });
    }
  };

  const handleStartNewProduct = () => {
    extractAbortRef.current?.abort();
    cancelOngoingCompression();
    setIsDesktopMenuOpen(false);
    setDesktopMenuView('menu');
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobileConnectServerOpen(false);
    setIsMobileAdvancedSettingsOpen(false);
    setIsMobilePanelOpen(false);
    setMobilePanelSubView('organization');
    setSelectedStoreServiceId(null);
    setSelectedSchemaServiceId(null);
    setSelectedApiKeyServiceId(null);
    setSelectedEndpointTestServiceId(null);
    setSelectedTrafficServiceId(null);
    setSelectedTrafficLimitServiceId(null);
    setActiveChatServiceId(null);
    pushRouteUrl({ kind: 'home' });
    setIsExtracting(false);
    setPendingDomainBatch(null);
    setExtractError(null);
    setBatchNotice(null);
    setUrl('');
    setHasSearched(false);
    setIsFileUploadFlow(false);
    setIsReadOnlyReplay(false);
    setShowCompressionBox(false);
    setShowUploadBox(false);
    setShowReceiveBox(false);
    setShowMapBox(false);
    setCompressionStatuses({});
    setUploadStatuses({});
    setReceiveStatuses({});
    setMapStatuses({});
    setMappedResults({});
    setCompressionResults({});
    setActiveJobStatus(null);
    setJobPlanBRolledBack(false);
    setJobPolicyBlocked(false);
    setJobLifecycleNotice(null);
    setActiveServiceCredentials(null);
    setCatalogImages(CATALOG_SAMPLE_IMAGES);
    setCatalogVersion((prev) => prev + 1);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 180);
  };

  const buildFallbackServiceSnapshot = (
    service: OrganizationServiceItem,
  ): OrganizationServiceSnapshot => {
    const products = service.products ?? [];
    const images: CatalogImageItem[] = products.map((prod, idx) => ({
      id: prod.id || `replay-${service.id}-${idx}`,
      url: prod.url,
      cleanUrl: prod.url,
      alt: prod.nombre || `${t.common.productFallback} ${idx + 1}`,
    }));

    const nextCompressionStatuses: Record<string, ImageCompressionStatus> = {};
    const nextUploadStatuses: Record<string, ImageUploadStatus> = {};
    const nextReceiveStatuses: Record<string, ImageReceiveStatus> = {};
    const nextMapStatuses: Record<string, ImageMapStatus> = {};
    const nextMappedResults: Record<string, MappedImageMetadata> = {};
    const nextCompressionResults: Record<string, CompressedImageMeta> = {};

    products.forEach((prod, idx) => {
      const item = images[idx];
      nextCompressionStatuses[item.id] = 'done';
      nextUploadStatuses[item.id] = 'done';
      nextReceiveStatuses[item.id] = 'received';
      nextMapStatuses[item.id] = 'mapped';
      nextMappedResults[item.id] = {
        nombre: prod.nombre,
        categoria: prod.categoria,
        descripcion: prod.descripcion,
        url: prod.url,
      };
      nextCompressionResults[item.id] = {
        url: prod.url,
        cleanUrl: prod.url,
        savedPercent: 0,
        compressedBytes: 0,
      };
    });

    return {
      images,
      compressionStatuses: nextCompressionStatuses,
      uploadStatuses: nextUploadStatuses,
      receiveStatuses: nextReceiveStatuses,
      mapStatuses: nextMapStatuses,
      mappedResults: nextMappedResults,
      compressionResults: nextCompressionResults,
    };
  };

  const handleViewServiceHistory = (service: OrganizationServiceItem) => {
    extractAbortRef.current?.abort();
    cancelOngoingCompression();

    const snapshot =
      service.snapshot && service.snapshot.images.length > 0
        ? service.snapshot
        : buildFallbackServiceSnapshot(service);

    setIsDesktopMenuOpen(false);
    setDesktopMenuView('menu');
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobileConnectServerOpen(false);
    setIsMobileAdvancedSettingsOpen(false);
    setIsMobilePanelOpen(false);
    setMobilePanelSubView('organization');
    setSelectedStoreServiceId(null);
    setSelectedSchemaServiceId(null);
    setActiveChatServiceId(null);
    pushRouteUrl({ kind: 'home' });
    setIsExtracting(false);
    setPendingDomainBatch(null);
    setExtractError(null);
    setBatchNotice(null);
    setIsReadOnlyReplay(true);
    setHasSearched(true);
    setIsFileUploadFlow(true);
    setShowCompressionBox(true);
    setShowUploadBox(true);
    setShowReceiveBox(true);
    setShowMapBox(true);
    setCompressionStatuses(snapshot.compressionStatuses);
    setUploadStatuses(snapshot.uploadStatuses);
    setReceiveStatuses(snapshot.receiveStatuses);
    setMapStatuses(snapshot.mapStatuses);
    setMappedResults(snapshot.mappedResults);
    setCompressionResults(snapshot.compressionResults);
    setActiveServiceCredentials({
      serviceName: service.name,
      apiKey: isRawCoreApiKey(service.apiKey)
        ? service.apiKey
        : service.keyPrefix || service.apiKey,
      endpointUrl: service.endpointUrl,
      slug: service.slug,
    });
    setCatalogImages(
      snapshot.images.length > 0 ? snapshot.images : CATALOG_SAMPLE_IMAGES,
    );
    setCatalogVersion((prev) => prev + 1);
  };

  const pushRouteUrl = (route: AppRoute, mode: 'push' | 'replace' = 'push') => {
    if (typeof window === 'undefined') return;
    if (isAuthCallbackPathname(window.location.pathname)) return;
    const targetPath = buildAppRoutePath(route);
    if (normalizePathname(window.location.pathname) === normalizePathname(targetPath)) {
      return;
    }
    if (mode === 'replace') {
      window.history.replaceState(null, '', targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
    }
  };

  const resolveServiceBySlug = (
    slug: string | undefined,
    servicesList: OrganizationServiceItem[],
  ): OrganizationServiceItem | null => {
    if (servicesList.length === 0) return null;
    if (slug) {
      const targetSlug = slug.toLowerCase();
      const matched = servicesList.find(
        (srv) =>
          (srv.slug ?? '').toLowerCase() === targetSlug ||
          srv.id.toLowerCase() === targetSlug,
      );
      if (matched) return matched;
    }
    return servicesList[0] ?? null;
  };

  const applyRouteToState = (
    route: AppRoute,
    options?: { isDesktop?: boolean; services?: OrganizationServiceItem[] },
  ) => {
    const isDesktop = options?.isDesktop ?? isDesktopViewportRef.current;
    const servicesList = options?.services ?? orgServicesRef.current;

    if (route.kind === 'doc') {
      setIsDesktopMenuOpen(false);
      setIsMobileMenuOpen(false);
      setIsImageBankOpen(false);
      setIsImageBankSavedView(false);
      setActiveChatServiceId(null);
      setActiveDocRoute(route.docId);
      return;
    }

    setActiveDocRoute(null);

    if (route.kind === 'image-bank') {
      setIsAuthOpen(false);
      setActiveChatServiceId(null);
      setIsDesktopMenuOpen(false);
      setDesktopMenuView('menu');
      setIsMobileMenuOpen(false);
      setIsMobileAccountModalOpen(false);
      setIsMobileLanguageModalOpen(false);
      setIsMobileConnectServerOpen(false);
      setIsMobileAdvancedSettingsOpen(false);
      setIsMobilePanelOpen(false);
      setIsImageBankOpen(true);
      return;
    }

    setIsImageBankOpen(false);
    setIsImageBankSavedView(false);

    if (route.kind === 'login') {
      setActiveChatServiceId(null);
      if (!authUserRef.current) {
        setIsAuthOpen(true);
      } else {
        setIsAuthOpen(false);
      }
      return;
    }

    if (route.kind === 'home') {
      setIsAuthOpen(false);
      setActiveChatServiceId(null);
      setIsDesktopMenuOpen(false);
      setDesktopMenuView('menu');
      setIsMobileMenuOpen(false);
      setIsMobileAccountModalOpen(false);
      setIsMobileLanguageModalOpen(false);
      setIsMobileConnectServerOpen(false);
      setIsMobileAdvancedSettingsOpen(false);
      setIsMobilePanelOpen(false);
      setMobilePanelSubView('organization');
      setSelectedStoreServiceId(null);
      setSelectedSchemaServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedEndpointTestServiceId(null);
      return;
    }

    // Protected application routes
    setIsAuthOpen(false);
    setIsMobileMenuOpen(false);

    if (route.kind === 'search-ia') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setActiveChatServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'search-ia', slug: route.slug };
      }
      return;
    }

    setActiveChatServiceId(null);

    if (route.kind === 'store') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedStoreServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'store', slug: route.slug };
        setSelectedStoreServiceId(null);
      }
      setSelectedSchemaServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedEndpointTestServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('store');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('store');
      }
      return;
    }

    if (route.kind === 'schema') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedSchemaServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'schema', slug: route.slug };
        setSelectedSchemaServiceId(null);
      }
      setSelectedStoreServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedEndpointTestServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('schema');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('organization');
      }
      return;
    }

    if (route.kind === 'api-key') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedApiKeyServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'api-key', slug: route.slug };
        setSelectedApiKeyServiceId(null);
      }
      setSelectedStoreServiceId(null);
      setSelectedSchemaServiceId(null);
      setSelectedEndpointTestServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('api-key');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('api-key');
      }
      return;
    }

    if (route.kind === 'endpoint-test') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedEndpointTestServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'endpoint-test', slug: route.slug };
        setSelectedEndpointTestServiceId(null);
      }
      setSelectedStoreServiceId(null);
      setSelectedSchemaServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedTrafficServiceId(null);
      setSelectedTrafficLimitServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('endpoint-test');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('endpoint-test');
      }
      return;
    }

    if (route.kind === 'traffic') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedTrafficServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'traffic', slug: route.slug };
        setSelectedTrafficServiceId(null);
      }
      setSelectedStoreServiceId(null);
      setSelectedSchemaServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedEndpointTestServiceId(null);
      setSelectedTrafficLimitServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('traffic');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('traffic');
      }
      return;
    }

    if (route.kind === 'traffic-limit') {
      const matched = resolveServiceBySlug(route.slug, servicesList);
      if (matched) {
        pendingServiceSlugRef.current = null;
        setSelectedTrafficLimitServiceId(matched.id);
      } else {
        pendingServiceSlugRef.current = { kind: 'traffic-limit', slug: route.slug };
        setSelectedTrafficLimitServiceId(null);
      }
      setSelectedStoreServiceId(null);
      setSelectedSchemaServiceId(null);
      setSelectedApiKeyServiceId(null);
      setSelectedEndpointTestServiceId(null);
      setSelectedTrafficServiceId(null);
      if (isDesktop) {
        setIsDesktopMenuOpen(true);
        setDesktopMenuView('traffic-limit');
      } else {
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(true);
        setMobilePanelSubView('traffic-limit');
      }
      return;
    }

    // google-account | advanced-settings | organization | connect-server | language
    setSelectedStoreServiceId(null);
    setSelectedSchemaServiceId(null);
    setSelectedApiKeyServiceId(null);
    setSelectedEndpointTestServiceId(null);
    setSelectedTrafficServiceId(null);
    setSelectedTrafficLimitServiceId(null);
    setMobilePanelSubView('organization');

    if (isDesktop) {
      setIsDesktopMenuOpen(true);
      setDesktopMenuView(route.kind);
      return;
    }

    setIsMobileAccountModalOpen(route.kind === 'google-account');
    setIsMobileAdvancedSettingsOpen(route.kind === 'advanced-settings');
    setIsMobilePanelOpen(route.kind === 'organization');
    setIsMobileConnectServerOpen(route.kind === 'connect-server');
    setIsMobileLanguageModalOpen(route.kind === 'language');
  };

  const navigateToAppRoute = (
    route: AppRoute,
    mode: 'push' | 'replace' = 'push',
  ) => {
    applyRouteToState(route);
    pushRouteUrl(route, mode);
  };

  const getUnderlyingRouteWithoutChat = (): AppRoute => {
    if (isDesktopViewportRef.current) {
      if (!isDesktopMenuOpen || desktopMenuView === 'menu') return { kind: 'home' };
      if (desktopMenuView === 'store') {
        const srv = orgServicesRef.current.find((s) => s.id === selectedStoreServiceId);
        return { kind: 'store', slug: srv?.slug };
      }
      if (desktopMenuView === 'schema') {
        const srv = orgServicesRef.current.find((s) => s.id === selectedSchemaServiceId);
        return { kind: 'schema', slug: srv?.slug };
      }
      if (desktopMenuView === 'api-key') {
        const srv = orgServicesRef.current.find((s) => s.id === selectedApiKeyServiceId);
        return { kind: 'api-key', slug: srv?.slug };
      }
      if (desktopMenuView === 'endpoint-test') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedEndpointTestServiceId,
        );
        return { kind: 'endpoint-test', slug: srv?.slug };
      }
      if (desktopMenuView === 'traffic') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedTrafficServiceId,
        );
        return { kind: 'traffic', slug: srv?.slug };
      }
      if (desktopMenuView === 'traffic-limit') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedTrafficLimitServiceId,
        );
        return { kind: 'traffic-limit', slug: srv?.slug };
      }
      return { kind: desktopMenuView };
    }
    if (isMobilePanelOpen) {
      if (selectedSchemaServiceId) {
        const srv = orgServicesRef.current.find((s) => s.id === selectedSchemaServiceId);
        return { kind: 'schema', slug: srv?.slug };
      }
      if (mobilePanelSubView === 'store') {
        const srv = orgServicesRef.current.find((s) => s.id === selectedStoreServiceId);
        return { kind: 'store', slug: srv?.slug };
      }
      if (mobilePanelSubView === 'api-key') {
        const srv = orgServicesRef.current.find((s) => s.id === selectedApiKeyServiceId);
        return { kind: 'api-key', slug: srv?.slug };
      }
      if (mobilePanelSubView === 'endpoint-test') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedEndpointTestServiceId,
        );
        return { kind: 'endpoint-test', slug: srv?.slug };
      }
      if (mobilePanelSubView === 'traffic') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedTrafficServiceId,
        );
        return { kind: 'traffic', slug: srv?.slug };
      }
      if (mobilePanelSubView === 'traffic-limit') {
        const srv = orgServicesRef.current.find(
          (s) => s.id === selectedTrafficLimitServiceId,
        );
        return { kind: 'traffic-limit', slug: srv?.slug };
      }
      return { kind: 'organization' };
    }
    if (isMobileConnectServerOpen) return { kind: 'connect-server' };
    if (isMobileAdvancedSettingsOpen) return { kind: 'advanced-settings' };
    if (isMobileAccountModalOpen) return { kind: 'google-account' };
    if (isMobileLanguageModalOpen) return { kind: 'language' };
    return { kind: 'home' };
  };

  const handleOpenServiceChat = (service: OrganizationServiceItem) => {
    pendingServiceSlugRef.current = null;
    setActiveChatServiceId(service.id);
    pushRouteUrl({ kind: 'search-ia', slug: service.slug }, 'push');
  };

  const handleCloseServiceChat = () => {
    setActiveChatServiceId(null);
    pushRouteUrl(getUnderlyingRouteWithoutChat(), 'push');
  };

  const openAuthFlow = () => {
    if (authUserRef.current) return;
    setIsImageBankOpen(false);
    setIsImageBankSavedView(false);
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024 && normalizePathname(window.location.pathname) !== '/login') {
        window.history.pushState({ authRoute: true }, '', '/login');
      } else if (isImageBankPathname(window.location.pathname)) {
        window.history.replaceState(null, '', '/');
      }
    }
    setIsAuthOpen(true);
  };

  const closeImageBank = () => {
    imageBankAbortRef.current?.abort();
    aiGenerateAbortRef.current?.abort();
    setIsGeneratingAiImage(false);
    setIsImageBankOpen(false);
    setIsImageBankSavedView(false);
    if (typeof window !== 'undefined' && isImageBankPathname(window.location.pathname)) {
      window.history.pushState(null, '', '/');
    }
  };

  const handleImageBankQueryChange = (next: string) => {
    setImageBankQuery(next);
    if (showAiPlusRequiredNotice) setShowAiPlusRequiredNotice(false);
    if (aiGenerateError) setAiGenerateError(null);
    if (!next.trim() && generatedAiImage) {
      setGeneratedAiImage(null);
    }
  };

  const handleImageBankSearch = async () => {
    const clean = imageBankQuery.trim();
    if (!clean) return;

    if (!authUserRef.current && imageBankGuestIpBlocked) {
      return;
    }

    const remainingMs = imageBankCooldownUntilMs - Date.now();
    if (remainingMs > 0) {
      setImageBankCooldownRemainingSec(Math.ceil(remainingMs / 1000));
      setShowImageBankCooldownNotice(true);
      return;
    }

    imageBankAbortRef.current?.abort();
    aiGenerateAbortRef.current?.abort();
    const controller = new AbortController();
    imageBankAbortRef.current = controller;

    setIsImageBankSearching(true);
    setImageBankError(null);
    setShowImageBankCooldownNotice(false);
    setIsGeneratingAiImage(false);
    setGeneratedAiImage(null);
    setShowAiPlusRequiredNotice(false);
    setAiGenerateError(null);

    try {
      const result = await searchImageBank(clean, controller.signal);
      if (controller.signal.aborted) return;
      setImageBankResults(result.items);
      setHasSearchedImageBank(true);
      setLastSearchedImageQuery(result.query || clean);
      const cooldownSec = result.cooldownSeconds ?? 180;
      setImageBankCooldownUntilMs(Date.now() + cooldownSec * 1000);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ImageBankClientError && err.ipBlocked) {
        setImageBankGuestIpBlocked(true);
        setShowImageBankCooldownNotice(false);
        return;
      }
      if (err instanceof ImageBankClientError && err.rateLimited) {
        const retrySec = err.retryAfterSeconds ?? 180;
        setImageBankCooldownUntilMs(Date.now() + retrySec * 1000);
        setImageBankCooldownRemainingSec(retrySec);
        setShowImageBankCooldownNotice(true);
        return;
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : t.imageBank.searchErrorFallback;
      setImageBankError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsImageBankSearching(false);
      }
    }
  };

  const handleGenerateAiImage = async () => {
    const promptToUse = (lastSearchedImageQuery || imageBankQuery).trim();
    if (!promptToUse || isGeneratingAiImage) return;

    if (!hasImageBankPlusAccess) {
      setAiGenerateError(null);
      setShowAiPlusRequiredNotice(true);
      return;
    }

    aiGenerateAbortRef.current?.abort();
    const controller = new AbortController();
    aiGenerateAbortRef.current = controller;

    setShowAiPlusRequiredNotice(false);
    setAiGenerateError(null);
    setIsGeneratingAiImage(true);

    try {
      const item = await generateAiImageFromPrompt(promptToUse, controller.signal);
      if (controller.signal.aborted) return;
      setGeneratedAiImage(item);
      setSavedImageBankItems((prev) => {
        const next = [item, ...prev.filter((entry) => entry.id !== item.id)];
        saveImageBankItems(next);
        return next;
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ImageBankClientError && err.plusRequired) {
        setHasImageBankPlusAccess(false);
        setShowAiPlusRequiredNotice(true);
        return;
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : t.imageBank.searchErrorFallback;
      setAiGenerateError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsGeneratingAiImage(false);
      }
    }
  };

  const handleToggleSaveImageBankItem = (item: ImageBankImageItem) => {
    setSavedImageBankItems((prev) => {
      const exists = prev.some((entry) => entry.id === item.id);
      const next = exists
        ? prev.filter((entry) => entry.id !== item.id)
        : [item, ...prev];
      saveImageBankItems(next);
      return next;
    });
  };

  const handleRemoveSavedImageBankItem = (id: string) => {
    setSavedImageBankItems((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      saveImageBankItems(next);
      return next;
    });
  };

  const handleToggleImageBank = () => {
    setIsImageBankOpen((prev) => {
      const next = !prev;
      if (!next) {
        imageBankAbortRef.current?.abort();
        aiGenerateAbortRef.current?.abort();
        setIsGeneratingAiImage(false);
        setIsImageBankSavedView(false);
        if (typeof window !== 'undefined' && isImageBankPathname(window.location.pathname)) {
          window.history.pushState(null, '', '/');
        }
      } else {
        if (isDesktopViewport) {
          setIsDesktopMenuOpen(false);
          setDesktopMenuView('menu');
          setIsAuthOpen(false);
        }
        if (typeof window !== 'undefined' && !isImageBankPathname(window.location.pathname)) {
          window.history.pushState({ imageBankRoute: true }, '', IMAGE_BANK_PATH);
        }
      }
      return next;
    });
  };

  const closeAuthFlow = () => {
    setIsAuthOpen(false);
    if (typeof window !== 'undefined' && normalizePathname(window.location.pathname) === '/login') {
      window.history.replaceState(null, '', '/');
    }
  };

  const openDocumentationRoute = (docId: LegalDocId, fromAuth = false) => {
    setIsDesktopMenuOpen(false);
    setDesktopMenuView('menu');
    setIsMobileMenuOpen(false);
    docReturnToAuthRef.current = fromAuth;
    if (!fromAuth) {
      setIsAuthOpen(false);
    }
    const targetPath = buildAppRoutePath({ kind: 'doc', docId });
    if (
      typeof window !== 'undefined' &&
      resolveLegalDocRouteFromPathname(window.location.pathname) !== docId
    ) {
      window.history.pushState({ docRoute: docId, fromAuth }, '', targetPath);
    }
    setActiveDocRoute(docId);
  };

  const closeDocumentationRoute = () => {
    const returnToAuth = docReturnToAuthRef.current && !authUserRef.current;
    docReturnToAuthRef.current = false;
    setActiveDocRoute(null);
    if (typeof window !== 'undefined' && resolveLegalDocRouteFromPathname(window.location.pathname)) {
      if (returnToAuth && window.innerWidth < 1024) {
        window.history.pushState({ authRoute: true }, '', '/login');
      } else {
        window.history.pushState(null, '', '/');
      }
    }
    if (returnToAuth) {
      setIsAuthOpen(true);
    }
  };

  useEffect(() => {
    if (authUser && pendingServiceSlugRef.current && orgServices.length > 0) {
      const pending = pendingServiceSlugRef.current;
      pendingServiceSlugRef.current = null;
      const matched = resolveServiceBySlug(pending.slug, orgServices);
      if (matched) {
        if (pending.kind === 'store') {
          setSelectedStoreServiceId(matched.id);
        } else if (pending.kind === 'schema') {
          setSelectedSchemaServiceId(matched.id);
        } else if (pending.kind === 'api-key') {
          setSelectedApiKeyServiceId(matched.id);
        } else if (pending.kind === 'endpoint-test') {
          setSelectedEndpointTestServiceId(matched.id);
        } else if (pending.kind === 'traffic') {
          setSelectedTrafficServiceId(matched.id);
        } else if (pending.kind === 'traffic-limit') {
          setSelectedTrafficLimitServiceId(matched.id);
        } else if (pending.kind === 'search-ia') {
          setActiveChatServiceId(matched.id);
        }
      }
    }
  }, [authUser, orgServices]);

  useEffect(() => {
    if (!supabase) {
      authResolvedRef.current = true;
      if (pendingProtectedRouteRef.current) {
        pendingProtectedRouteRef.current = null;
        if (typeof window !== 'undefined') {
          const isMobile = window.innerWidth < 1024;
          window.history.replaceState(null, '', isMobile ? '/login' : '/');
        }
        setIsAuthOpen(true);
      }
      return;
    }
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      authResolvedRef.current = true;
      const sessionUser = data.session?.user ?? null;
      authUserRef.current = sessionUser;
      setAuthUser(sessionUser);
      if (sessionUser) {
        setIsAuthOpen(false);
        const pendingRoute = pendingProtectedRouteRef.current;
        pendingProtectedRouteRef.current = null;
        if (pendingRoute) {
          applyRouteToState(pendingRoute);
        } else if (
          normalizePathname(window.location.pathname) === '/login' ||
          isAuthCallbackPathname(window.location.pathname)
        ) {
          window.history.replaceState(null, '', '/');
        }
      } else if (pendingProtectedRouteRef.current) {
        pendingProtectedRouteRef.current = null;
        const isMobile = window.innerWidth < 1024;
        window.history.replaceState(null, '', isMobile ? '/login' : '/');
        setIsAuthOpen(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      authUserRef.current = nextUser;
      setAuthUser(nextUser);
      if (nextUser) {
        setIsAuthOpen(false);
        const pendingRoute = pendingProtectedRouteRef.current;
        if (pendingRoute) {
          pendingProtectedRouteRef.current = null;
          applyRouteToState(pendingRoute);
        } else {
          const currentRoute = parseAppRoute(window.location.pathname);
          if (isProtectedAppRoute(currentRoute)) {
            applyRouteToState(currentRoute);
          } else if (
            normalizePathname(window.location.pathname) === '/login' ||
            isAuthCallbackPathname(window.location.pathname)
          ) {
            window.history.replaceState(null, '', '/');
          }
        }
      } else {
        setIsDesktopMenuOpen(false);
        setDesktopMenuView('menu');
        setIsMobileMenuOpen(false);
        setIsMobileAccountModalOpen(false);
        setIsMobileLanguageModalOpen(false);
        setIsMobileConnectServerOpen(false);
        setIsMobileAdvancedSettingsOpen(false);
        setIsMobilePanelOpen(false);
        setMobilePanelSubView('organization');
        setSelectedStoreServiceId(null);
        setSelectedSchemaServiceId(null);
        setActiveChatServiceId(null);
        if (authResolvedRef.current && isProtectedAppRoute(parseAppRoute(window.location.pathname))) {
          window.history.replaceState(null, '', '/');
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = parseAppRoute(window.location.pathname);

      if (nextRoute.kind === 'doc') {
        applyRouteToState(nextRoute);
        return;
      }

      if (nextRoute.kind === 'image-bank') {
        applyRouteToState(nextRoute);
        return;
      }

      if (nextRoute.kind === 'login') {
        if (!authUserRef.current) {
          applyRouteToState(nextRoute);
        } else {
          window.history.replaceState(null, '', '/');
          applyRouteToState({ kind: 'home' });
        }
        return;
      }

      if (isProtectedAppRoute(nextRoute)) {
        if (authUserRef.current) {
          applyRouteToState(nextRoute);
        } else if (authResolvedRef.current) {
          window.history.replaceState(
            null,
            '',
            window.innerWidth < 1024 ? '/login' : '/',
          );
          setActiveDocRoute(null);
          setIsImageBankOpen(false);
          setIsAuthOpen(true);
        } else {
          pendingProtectedRouteRef.current = nextRoute;
        }
        return;
      }

      // Home route
      if (docReturnToAuthRef.current && !authUserRef.current) {
        docReturnToAuthRef.current = false;
        setActiveDocRoute(null);
        setIsAuthOpen(true);
        return;
      }

      applyRouteToState({ kind: 'home' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    return () => {
      extractAbortRef.current?.abort();
      cancelOngoingCompression();
      objectUrlsRef.current.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    };
  }, []);

  const resetSignedOutWorkspace = () => {
    setAuthUser(null);
    setCarriedFreeImagesUsed(0);
    setActiveChatServiceId(null);
    setIsDesktopMenuOpen(false);
    setDesktopMenuView('menu');
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobileConnectServerOpen(false);
    setIsMobileAdvancedSettingsOpen(false);
    setIsMobilePanelOpen(false);
    setMobilePanelSubView('organization');
    setSelectedStoreServiceId(null);
    setSelectedSchemaServiceId(null);
    pushRouteUrl({ kind: 'home' }, 'replace');
  };

  const handleSignOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    resetSignedOutWorkspace();
  };

  const handlePurgeAllR2 = async (): Promise<{ deletedR2Count: number }> => {
    const res = await requestPurgeAllR2Images();
    const currentUserId = authUserRef.current?.id;

    orgServicesRef.current = [];
    setOrgServices([]);
    setCarriedFreeImagesUsed(res.quota.carriedFreeImagesUsed);
    setActiveChatServiceId(null);
    setActiveServiceCredentials(null);

    if (res.clearedLogo) {
      setOrgProfile((prev) => {
        const next: OrganizationProfile = {
          ...prev,
          logoUrl: null,
          logoR2Key: null,
        };
        if (currentUserId) {
          try {
            window.localStorage.setItem(
              `searchlink_org_${currentUserId}`,
              JSON.stringify(next),
            );
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });
    }

    if (currentUserId) {
      try {
        window.localStorage.removeItem(`searchlink_services_${currentUserId}`);
      } catch {
        // Ignore storage errors
      }
    }

    return { deletedR2Count: res.deletedR2Count };
  };

  const handlePauseAllApis = async (): Promise<{ pausedServicesCount: number }> => {
    const res = await requestPauseAllApis();
    const updated = orgServicesRef.current.map((srv) => ({
      ...srv,
      isActive: false,
    }));
    orgServicesRef.current = updated;
    setOrgServices(updated);
    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage errors
      }
      void triggerAgencyAutoSyncOnBulkToggle({
        userId: authUserRef.current.id,
        services: updated,
      });
    }
    return { pausedServicesCount: res.pausedServicesCount };
  };

  const handleUnfreezeAllApis = async (): Promise<{ unfrozenServicesCount: number }> => {
    const res = await requestUnfreezeAllApis();
    const updated = orgServicesRef.current.map((srv) => ({
      ...srv,
      isActive: true,
    }));
    orgServicesRef.current = updated;
    setOrgServices(updated);
    if (authUserRef.current) {
      try {
        window.localStorage.setItem(
          `searchlink_services_${authUserRef.current.id}`,
          JSON.stringify(updated),
        );
      } catch {
        // Ignore storage errors
      }
      void triggerAgencyAutoSyncOnBulkToggle({
        userId: authUserRef.current.id,
        services: updated,
      });
    }
    return { unfrozenServicesCount: res.unfrozenServicesCount };
  };

  const hasR2Images =
    Boolean(orgProfile.logoR2Key?.trim()) ||
    (typeof orgProfile.logoUrl === 'string' &&
      (orgProfile.logoUrl.includes('.r2.dev/') ||
        orgProfile.logoUrl.includes('/api/media?'))) ||
    orgServices.some((srv) => srv.itemCount > 0 || (srv.products?.length ?? 0) > 0);

  const hasActiveApis = orgServices.some((srv) => srv.isActive);
  const hasPausedApis = orgServices.some((srv) => !srv.isActive);

  const handleClearBrowserData = async (): Promise<void> => {
    await requestClearBrowserData();
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    wipeAllClientBrowsingStorage();
    setSavedImageBankItems([]);
    setActiveServiceCredentials(null);
    setPendingDomainBatch(null);
    setHasSearched(false);
    setUrl('');
    resetSignedOutWorkspace();
  };

  const handleDeleteAccountPermanently = async (): Promise<void> => {
    const currentUserId = authUserRef.current?.id;
    await requestDeleteAccountPermanently();
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    if (currentUserId) {
      wipeAccountLocalStorageEntries(currentUserId);
    }
    setSavedImageBankItems([]);
    setActiveServiceCredentials(null);
    setPendingDomainBatch(null);
    setHasSearched(false);
    setUrl('');
    resetSignedOutWorkspace();
  };

  useEffect(() => {
    if (
      !isAuthOpen &&
      !isDesktopMenuOpen &&
      !isMobileMenuOpen &&
      !isMobileAccountModalOpen &&
      !isMobileLanguageModalOpen &&
      !isMobileConnectServerOpen &&
      !isMobileAdvancedSettingsOpen &&
      !isMobilePanelOpen &&
      !activeChatServiceId
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (activeChatServiceId) {
          handleCloseServiceChat();
          return;
        }
        if (isDesktopMenuOpen && desktopMenuView === 'traffic-limit') {
          const srv = orgServices.find((s) => s.id === selectedTrafficLimitServiceId);
          navigateToAppRoute({ kind: 'traffic', slug: srv?.slug });
          return;
        }
        if (isMobilePanelOpen && mobilePanelSubView === 'traffic-limit') {
          const srv = orgServices.find((s) => s.id === selectedTrafficLimitServiceId);
          navigateToAppRoute({ kind: 'traffic', slug: srv?.slug });
          return;
        }
        if (
          isDesktopMenuOpen &&
          (desktopMenuView === 'schema' ||
            desktopMenuView === 'api-key' ||
            desktopMenuView === 'endpoint-test' ||
            desktopMenuView === 'traffic')
        ) {
          navigateToAppRoute({ kind: 'organization' });
          return;
        }
        if (
          isMobilePanelOpen &&
          (selectedSchemaServiceId ||
            mobilePanelSubView === 'api-key' ||
            mobilePanelSubView === 'endpoint-test' ||
            mobilePanelSubView === 'traffic')
        ) {
          navigateToAppRoute({ kind: 'organization' });
          return;
        }
        if (isAuthOpen) closeAuthFlow();
        if (
          isDesktopMenuOpen ||
          isMobileAccountModalOpen ||
          isMobileLanguageModalOpen ||
          isMobileConnectServerOpen ||
          isMobileAdvancedSettingsOpen ||
          isMobilePanelOpen
        ) {
          navigateToAppRoute({ kind: 'home' });
          return;
        }
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        return;
      }

      if (
        isAuthOpen &&
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key.toLowerCase() === 'x'
      ) {
        event.preventDefault();
        closeAuthFlow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAuthOpen,
    isDesktopMenuOpen,
    desktopMenuView,
    isMobileMenuOpen,
    isMobileAccountModalOpen,
    isMobileLanguageModalOpen,
    isMobileConnectServerOpen,
    isMobileAdvancedSettingsOpen,
    isMobilePanelOpen,
    mobilePanelSubView,
    selectedSchemaServiceId,
    activeChatServiceId,
  ]);

  const rejectIfBlockedDomain = (candidate: string): boolean => {
    if (!candidate.trim()) return false;
    if (!isBlockedPolicyDomain(candidate).blocked) return false;
    setUrl('');
    setPendingDomainBatch(null);
    setBatchNotice(null);
    setExtractError(t.app.blockedDomainPolicyError);
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isExtracting) return;

    if (isSavedCatalogCommand(trimmed)) {
      setExtractError(null);
      setBatchNotice(null);
      setPendingDomainBatch(null);

      const savedCatalog =
        savedImageBankItems.length > 0
          ? savedImageBankItems
          : loadSavedImageBankItems();

      if (savedCatalog.length === 0) {
        setExtractError(t.app.noSavedCatalogImagesError);
        return;
      }

      const currentUser = authUserRef.current;
      const isAdminAccount =
        currentUser?.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL;
      const remainingQuota = currentUser
        ? getRemainingFreeImages(currentUser)
        : savedCatalog.length;

      if (currentUser && !isAdminAccount && remainingQuota <= 0) {
        setExtractError(t.app.freeImageQuotaExceededError);
        return;
      }

      const activeLimit = !currentUser
        ? savedCatalog.length
        : isAdminAccount
          ? MAX_ADMIN_EXTRACT_IMAGES
          : Math.min(MAX_FREE_UPLOAD_IMAGES, remainingQuota);
      const selectedSaved = savedCatalog.slice(0, activeLimit);
      const overflowNotice =
        savedCatalog.length > activeLimit
          ? usedFreeImages > 0
            ? t.app.freeRemainingNotice(activeLimit, MAX_FREE_UPLOAD_IMAGES)
            : t.app.freePlanLimitNotice(activeLimit)
          : null;

      const preparedImages: CatalogImageItem[] = selectedSaved.map((item, idx) => {
        const targetUrl = item.fullUrl || item.previewUrl;
        return {
          id: `saved-cat-${Date.now()}-${idx}-${item.id}`,
          url: targetUrl,
          cleanUrl: targetUrl,
          sourcePageUrl: item.sourcePageUrl || undefined,
          alt: item.alt || t.app.imageFallbackAlt(idx + 1),
        };
      });

      if (isImageBankOpen) {
        closeImageBank();
      }
      cancelOngoingCompression();
      setIsFileUploadFlow(false);
      setIsReadOnlyReplay(false);
      setShowCompressionBox(false);
      setCompressionStatuses({});
      setShowUploadBox(false);
      setUploadStatuses({});
      setShowReceiveBox(false);
      setReceiveStatuses({});
      setShowMapBox(false);
      setMapStatuses({});
      setMappedResults({});
      setCompressionResults({});
      setActiveJobStatus(null);
      setJobPlanBRolledBack(false);
      setJobPolicyBlocked(false);
      setJobLifecycleNotice(null);
      setActiveServiceCredentials(null);
      setBatchNotice(overflowNotice);
      setHasSearched(true);
      setCatalogImages(preparedImages);
      setCatalogVersion((prev) => prev + 1);
      setPendingDomainBatch({
        items: preparedImages,
        originUrl: trimmed.toLowerCase(),
        overflowNotice,
        promptKind: 'savedCatalog',
        legalAccepted: true,
      });
      inputRef.current?.blur();
      return;
    }

    if (rejectIfBlockedDomain(trimmed)) {
      return;
    }

    const currentUser = authUserRef.current;
    if (!currentUser && guestIpBlocked) {
      setExtractError(t.app.guestIpBlockedError);
      return;
    }

    const isAdminExtractAccount =
      currentUser?.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL;
    const remainingQuota = getRemainingFreeImages(currentUser);

    if (currentUser && !isAdminExtractAccount && remainingQuota <= 0) {
      setExtractError(t.app.freeImageQuotaExceededError);
      return;
    }

    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setPendingDomainBatch(null);
    cancelOngoingCompression();
    setBatchNotice(null);
    setIsFileUploadFlow(false);
    setIsReadOnlyReplay(false);
    setShowCompressionBox(false);
    setCompressionStatuses({});
    setShowUploadBox(false);
    setUploadStatuses({});
    setShowReceiveBox(false);
    setReceiveStatuses({});
    setShowMapBox(false);
    setMapStatuses({});
    setMappedResults({});
    setCompressionResults({});
    setActiveJobStatus(null);
    setJobPlanBRolledBack(false);
    setJobPolicyBlocked(false);
    setJobLifecycleNotice(null);
    setActiveServiceCredentials(null);
    setUrl(normalized);
    setHasSearched(true);
    setExtractError(null);
    setIsExtracting(true);

    extractAbortRef.current?.abort();
    const controller = new AbortController();
    extractAbortRef.current = controller;

    const activeLimit = !currentUser
      ? MAX_GUEST_EXTRACT_IMAGES
      : isAdminExtractAccount
        ? MAX_ADMIN_EXTRACT_IMAGES
        : Math.min(MAX_FREE_UPLOAD_IMAGES, remainingQuota);

    try {
      const accessToken = currentUser ? await getSupabaseAccessToken() : null;
      const response = await fetch(resolveApiUrl('/api/extract'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalized,
          maxResults: activeLimit,
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as {
        images?: CatalogImageItem[];
        ipBlocked?: boolean;
        policyBlocked?: boolean;
        error?: string;
      };

      if (response.status === 403 && data.policyBlocked) {
        setUrl('');
        setExtractError(t.app.blockedDomainPolicyError);
        return;
      }

      if (response.status === 429 && (data.ipBlocked || !currentUser)) {
        setGuestIpBlocked(true);
        setExtractError(t.app.guestIpBlockedError);
        return;
      }

      if (!response.ok || !Array.isArray(data.images) || data.images.length === 0) {
        setExtractError(data.error || t.app.extractEmptyError);
        return;
      }

      const extractedImages = data.images.slice(0, activeLimit).map((item) => ({
        ...item,
        url: resolveApiUrl(item.url),
        ...(item.cleanUrl ? { cleanUrl: resolveApiUrl(item.cleanUrl) } : {}),
      }));
      inputRef.current?.blur();

      // Guest (not signed in): extract max 10 images only, stop immediately without compression/upload/AI mapping
      if (!currentUser) {
        setIsFileUploadFlow(false);
        setIsReadOnlyReplay(false);
        setShowCompressionBox(false);
        setShowUploadBox(false);
        setShowReceiveBox(false);
        setShowMapBox(false);
        setBatchNotice(t.app.guestExtractOnlyNotice);
        setHasSearched(true);
        setCatalogImages(extractedImages);
        setCatalogVersion((prev) => prev + 1);
        return;
      }

      // Admin test account: stop right after domain extraction (skip compression, R2 upload, and Gemini mapping)
      if (isAdminExtractAccount) {
        setIsFileUploadFlow(false);
        setIsReadOnlyReplay(false);
        setShowCompressionBox(false);
        setShowUploadBox(false);
        setShowReceiveBox(false);
        setShowMapBox(false);
        setBatchNotice(t.app.adminExtractOnlyNotice(extractedImages.length));
        setHasSearched(true);
        setCatalogImages(extractedImages);
        setCatalogVersion((prev) => prev + 1);
        return;
      }

      const overflowNotice =
        data.images.length > activeLimit
          ? usedFreeImages > 0
            ? t.app.freeRemainingNotice(activeLimit, MAX_FREE_UPLOAD_IMAGES)
            : t.app.freePlanLimitNotice(activeLimit)
          : null;

      // Pause after domain extraction: show extracted images and wait for Continuar / Cancelar
      setIsFileUploadFlow(false);
      setIsReadOnlyReplay(false);
      setShowCompressionBox(false);
      setShowUploadBox(false);
      setShowReceiveBox(false);
      setShowMapBox(false);
      setBatchNotice(overflowNotice);
      setHasSearched(true);
      setCatalogImages(extractedImages);
      setCatalogVersion((prev) => prev + 1);
      setPendingDomainBatch({
        items: extractedImages,
        originUrl: normalized,
        overflowNotice,
        promptKind: 'domain',
        legalAccepted: false,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setExtractError(t.app.extractNetworkError);
    } finally {
      if (extractAbortRef.current === controller) {
        setIsExtracting(false);
      }
    }
  };

  const handleAcceptDomainRights = () => {
    setPendingDomainBatch((prev) =>
      prev ? { ...prev, legalAccepted: true } : prev,
    );
  };

  const handleConfirmDomainContinue = () => {
    if (!pendingDomainBatch) return;
    if (
      pendingDomainBatch.promptKind !== 'savedCatalog' &&
      !pendingDomainBatch.legalAccepted
    ) {
      handleAcceptDomainRights();
      return;
    }
    const currentUser = authUserRef.current;
    if (!currentUser) {
      const wasSavedCatalog = pendingDomainBatch.promptKind === 'savedCatalog';
      setPendingDomainBatch(null);
      if (wasSavedCatalog) {
        setExtractError(t.app.savedCatalogAuthRequiredError);
      } else {
        setBatchNotice(t.app.guestExtractOnlyNotice);
      }
      return;
    }
    const isAdmin =
      currentUser.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL;
    if (!isAdmin && getRemainingFreeImages(currentUser) <= 0) {
      setPendingDomainBatch(null);
      setExtractError(t.app.freeImageQuotaExceededError);
      return;
    }
    const batch = pendingDomainBatch;
    setPendingDomainBatch(null);
    startAutomatedBatchPipeline(
      batch.items,
      batch.items.map((img) => ({ kind: 'url', url: img.url })),
      batch.overflowNotice,
      batch.originUrl,
    );
  };

  const handleCancelDomainBatch = () => {
    setPendingDomainBatch(null);
    cancelOngoingCompression();
    setBatchNotice(null);
    setExtractError(null);
    setIsFileUploadFlow(false);
    setIsReadOnlyReplay(false);
    setHasSearched(false);
    setCatalogImages(CATALOG_SAMPLE_IMAGES);
    setCatalogVersion(0);
    setUrl('');
  };

  const startAutomatedBatchPipeline = (
    items: CatalogImageItem[],
    sources: BatchImageSource[],
    initialNotice: string | null = null,
    originPageUrl: string | null = null,
  ) => {
    const initialCompressionStatuses: Record<string, ImageCompressionStatus> = {};
    const initialUploadStatuses: Record<string, ImageUploadStatus> = {};
    const initialReceiveStatuses: Record<string, ImageReceiveStatus> = {};
    const initialMapStatuses: Record<string, ImageMapStatus> = {};

    items.forEach((item) => {
      initialCompressionStatuses[item.id] = 'pending';
      initialUploadStatuses[item.id] = 'pending';
      initialReceiveStatuses[item.id] = 'waiting';
      initialMapStatuses[item.id] = 'waiting';
    });

    setBatchNotice(initialNotice);
    setIsFileUploadFlow(true);
    setIsReadOnlyReplay(false);
    setShowCompressionBox(false);
    setShowUploadBox(false);
    setShowReceiveBox(false);
    setShowMapBox(false);
    setCompressionStatuses(initialCompressionStatuses);
    setUploadStatuses(initialUploadStatuses);
    setReceiveStatuses(initialReceiveStatuses);
    setMapStatuses(initialMapStatuses);
    setMappedResults({});
    setCompressionResults({});
    setActiveJobStatus(null);
    setJobPlanBRolledBack(false);
    setJobPolicyBlocked(false);
    setJobLifecycleNotice(null);
    setActiveServiceCredentials(null);
    setHasSearched(true);
    setCatalogImages(items);
    setCatalogVersion((prev) => prev + 1);

    const controller = new AbortController();
    compressionAbortRef.current = controller;

    // Start Stage 2 quickly: parallel render + WebP compression, then launch Render background job at R2 start
    compressionTimerRef.current = window.setTimeout(() => {
      compressionTimerRef.current = null;
      if (controller.signal.aborted) return;

      setShowCompressionBox(true);

      void (async () => {
        const compressedPayloads: Array<CompressedImageResult | null> = new Array(
          items.length,
        ).fill(null);

        let workerCursor = 0;
        const workerCount = Math.min(COMPRESS_CONCURRENCY, sources.length);
        const workers = Array.from({ length: workerCount }, async () => {
          while (workerCursor < sources.length && !controller.signal.aborted) {
            const index = workerCursor++;
            const item = items[index];
            const source = sources[index];
            if (!item || !source) continue;

            try {
              let sourceBlob: Blob;
              if (source.kind === 'url') {
                setCompressionStatuses((prev) => ({
                  ...prev,
                  [item.id]: 'rendering',
                }));
                sourceBlob = await renderImageBlobFromUrl(
                  source.url,
                  controller.signal,
                );
              } else {
                sourceBlob = source.file;
              }

              if (controller.signal.aborted) return;

              setCompressionStatuses((prev) => ({
                ...prev,
                [item.id]: 'compressing',
              }));

              const compressed = await compressImageToWebp(sourceBlob);
              if (controller.signal.aborted) return;

              compressedPayloads[index] = compressed;
              setCompressionStatuses((prev) => ({
                ...prev,
                [item.id]: 'done',
              }));
            } catch {
              if (!controller.signal.aborted) {
                setCompressionStatuses((prev) => ({
                  ...prev,
                  [item.id]: 'error',
                }));
              }
            }
          }
        });

        await Promise.all(workers);
        if (controller.signal.aborted) return;

        await new Promise<void>((resolve) => {
          compressionTimerRef.current = window.setTimeout(() => {
            compressionTimerRef.current = null;
            resolve();
          }, UPLOAD_START_DELAY_MS);
        });

        if (controller.signal.aborted) return;

        // Stage 3 (R2): Launch Render background worker right when R2 begins
        setShowUploadBox(true);

        const queueItems = (
          await Promise.all(
            items.map(async (item, idx) => {
              const compressed = compressedPayloads[idx];
              const source = sources[idx];

              if (compressed) {
                const dataBase64 = await blobToDataUrl(compressed.blob);
                return {
                  clientItemId: item.id,
                  dataBase64,
                  originalUrl: item.sourcePageUrl,
                  savedPercent: compressed.savedPercent,
                  compressedBytes: compressed.compressedBytes,
                };
              }

              if (source?.kind === 'url') {
                return {
                  clientItemId: item.id,
                  sourceImageUrl: source.url,
                  originalUrl: item.sourcePageUrl,
                  savedPercent: 0,
                  compressedBytes: 0,
                };
              }

              return null;
            }),
          )
        ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        if (queueItems.length === 0) {
          setUploadStatuses(
            Object.fromEntries(items.map((item) => [item.id, 'error' as const])),
          );
          setBatchNotice(t.app.uploadImageError);
          return;
        }

        const initialQueuedUploadStatuses: Record<string, ImageUploadStatus> = {};
        for (const item of items) {
          const isIncluded = queueItems.some((q) => q.clientItemId === item.id);
          initialQueuedUploadStatuses[item.id] = isIncluded ? 'uploading' : 'error';
        }
        setUploadStatuses(initialQueuedUploadStatuses);

        const currentUserId = authUserRef.current?.id;
        if (!currentUserId) return;

        const serviceSlug = generateCoreServiceSlug();
        const mintedKey = await generateCoreApiKey();
        const endpointUrl = buildCoreServiceEndpointUrl(serviceSlug);

        try {
          const startedJob = await startBackgroundMappingJob(
            {
              sourceType: originPageUrl ? 'url' : 'files',
              sourceUrl: originPageUrl,
              serviceSlug,
              keyPrefix: mintedKey.keyPrefix,
              keyHash: mintedKey.keyHash,
              items: queueItems,
            },
            controller.signal,
          );

          activeJobIdRef.current = startedJob.id;
          savePendingJobCredentials(currentUserId, {
            jobId: startedJob.id,
            slug: serviceSlug,
            apiKey: mintedKey.rawKey,
            keyPrefix: mintedKey.keyPrefix,
            endpointUrl,
          });

          await monitorBackgroundMappingJob(
            startedJob,
            controller.signal,
            currentUserId,
            {
              rawKey: mintedKey.rawKey,
              keyPrefix: mintedKey.keyPrefix,
              keyHash: mintedKey.keyHash,
              endpointUrl,
            },
          );
        } catch (err) {
          if (
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === 'AbortError')
          ) {
            return;
          }
          const msg = err instanceof Error ? err.message : t.app.uploadImageError;
          setBatchNotice(msg);
          setUploadStatuses((prev) => {
            const next = { ...prev };
            for (const qItem of queueItems) {
              next[qItem.clientItemId] = 'error';
            }
            return next;
          });
        }
      })();
    }, COMPRESSION_START_DELAY_MS);
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!authUserRef.current) {
      event.target.value = '';
      return;
    }
    if (!fileList || fileList.length === 0) return;

    const allValidFiles = Array.from(fileList).filter(
      (file) =>
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(file.name),
    );

    event.target.value = '';

    if (allValidFiles.length === 0) {
      setExtractError(t.app.invalidImageFilesError);
      return;
    }

    const currentUser = authUserRef.current;
    const isAdminExtractAccount =
      currentUser?.email?.trim().toLowerCase() === ADMIN_EXTRACT_ONLY_EMAIL;
    const remainingQuota = getRemainingFreeImages(currentUser);

    if (!isAdminExtractAccount && remainingQuota <= 0) {
      setExtractError(t.app.freeImageQuotaExceededError);
      return;
    }

    const activeLimit = isAdminExtractAccount
      ? MAX_ADMIN_EXTRACT_IMAGES
      : remainingQuota;

    const validFiles = allValidFiles.slice(0, activeLimit);
    const overflowNotice =
      allValidFiles.length > activeLimit
        ? usedFreeImages > 0
          ? t.app.freeRemainingNotice(activeLimit, MAX_FREE_UPLOAD_IMAGES)
          : t.app.freePlanLimitNotice(activeLimit)
        : null;

    setPendingDomainBatch(null);
    extractAbortRef.current?.abort();
    cancelOngoingCompression();
    setIsExtracting(false);
    setExtractError(null);

    const activeBgUrl = activeBgImage?.url ?? null;
    objectUrlsRef.current.forEach((oldUrl) => {
      if (oldUrl !== activeBgUrl) {
        URL.revokeObjectURL(oldUrl);
      }
    });

    const newBlobUrls: string[] = [];
    const batchStamp = Date.now();
    const uploadedItems: CatalogImageItem[] = validFiles.map((file, idx) => {
      const objectUrl = URL.createObjectURL(file);
      newBlobUrls.push(objectUrl);

      const cleanTitle =
        file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .trim() || t.app.imageFallbackAlt(idx + 1);

      return {
        id: `local-${batchStamp}-${idx}-${file.lastModified}`,
        url: objectUrl,
        cleanUrl: `archivo/${file.name}`,
        alt: cleanTitle,
        originalBytes: file.size,
      };
    });

    objectUrlsRef.current =
      activeBgUrl && activeBgUrl.startsWith('blob:')
        ? [activeBgUrl, ...newBlobUrls]
        : newBlobUrls;

    startAutomatedBatchPipeline(
      uploadedItems,
      validFiles.map((file) => ({ kind: 'file', file })),
      overflowNotice,
    );
  };

  const handleSelectBackground = (item: CatalogImageItem) => {
    if (!hasAnimatedFirstBg) {
      setShouldAnimateBgEntry(true);
      setHasAnimatedFirstBg(true);
    } else {
      setShouldAnimateBgEntry(false);
    }
    setActiveBgImage(item);
  };

  const isDesktopSplitActive = isFileUploadFlow && showMapBox;

  if (activeDocRoute) {
    return (
      <LegalDocumentPage
        docId={activeDocRoute}
        onClose={closeDocumentationRoute}
        onNavigateDoc={(nextDocId) =>
          openDocumentationRoute(nextDocId, docReturnToAuthRef.current)
        }
      />
    );
  }

  return (
    <main
      className={`bg-white lg:bg-[#0e1013] relative min-h-dvh w-full overflow-x-hidden flex flex-row items-stretch ${
        isDesktopSplitActive ? 'lg:h-dvh lg:overflow-hidden' : ''
      }`}
    >
      {/* Mobile-only lightweight ambient backdrop (zero continuous blur GPU repaints) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 overflow-hidden lg:hidden"
        style={{
          background:
            'radial-gradient(circle at 12% 8%, rgba(59,130,246,0.16) 0%, transparent 42%), radial-gradient(circle at 88% 12%, rgba(245,158,11,0.12) 0%, transparent 40%), radial-gradient(circle at 18% 54%, rgba(59,130,246,0.10) 0%, transparent 44%), radial-gradient(circle at 85% 92%, rgba(16,185,129,0.16) 0%, transparent 46%), linear-gradient(160deg, #eef6ff 0%, #f8fbff 42%, #ffffff 70%, #f2fbf6 100%)',
        }}
      />

      {/* Desktop-only AI-generated daytime desert background */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 hidden lg:block overflow-hidden bg-[#0e1013]"
      >
        <img
          src={desktopDesertBg}
          alt=""
          decoding="sync"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/40" />
      </div>

      {/* Desktop URL-selected background override activated via eye icon */}
      {activeBgImage && (
        <motion.div
          key={shouldAnimateBgEntry ? 'first-bg-reveal' : 'instant-bg-swap'}
          aria-hidden="true"
          initial={
            shouldAnimateBgEntry && !shouldReduceMotion
              ? {
                  clipPath: 'inset(3% 1.25% 3% 85% round 22px)',
                  opacity: 0,
                }
              : false
          }
          animate={
            shouldAnimateBgEntry && !shouldReduceMotion
              ? {
                  clipPath: [
                    'inset(3% 1.25% 3% 85% round 22px)',
                    'inset(3% 1.25% 3% 85% round 22px)',
                    'inset(0% 0% 0% 0% round 0px)',
                  ],
                  opacity: [0, 1, 1],
                }
              : {
                  clipPath: 'inset(0% 0% 0% 0% round 0px)',
                  opacity: 1,
                }
          }
          transition={
            shouldAnimateBgEntry && !shouldReduceMotion
              ? {
                  duration: 1.25,
                  times: [0, 0.24, 1],
                  ease: [0.22, 1, 0.36, 1],
                }
              : { duration: 0 }
          }
          className="pointer-events-none select-none fixed inset-0 z-[2] hidden lg:block overflow-hidden"
        >
          <img
            src={activeBgImage.url}
            alt=""
            referrerPolicy="no-referrer"
            decoding="sync"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/20" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/35" />
        </motion.div>
      )}

      {/* Desktop-only left-to-right 50% Image Bank panel with matching background */}
      <DesktopImageBankPanel
        open={isDesktopImageBankActive}
        query={imageBankQuery}
        onChangeQuery={handleImageBankQueryChange}
        onSearchSubmit={() => void handleImageBankSearch()}
        results={imageBankResults}
        isSearching={isImageBankSearching}
        hasSearched={hasSearchedImageBank}
        searchError={imageBankError}
        cooldownMessage={imageBankCooldownMessage}
        plusNotice={imageBankPlusNotice}
        guestIpBlockedNotice={imageBankGuestIpBlockedNotice}
        aiGenerateError={aiGenerateError}
        onGenerateAi={() => void handleGenerateAiImage()}
        isGeneratingAi={isGeneratingAiImage}
        generatedAiImage={generatedAiImage}
        savedImages={savedImageBankItems}
        savedIds={savedImageBankIds}
        onToggleSaveImage={handleToggleSaveImageBankItem}
        onRemoveSavedImage={handleRemoveSavedImageBankItem}
        showSaved={isImageBankSavedView}
        onToggleSaved={() => setIsImageBankSavedView((prev) => !prev)}
        onCloseSaved={() => setIsImageBankSavedView(false)}
        backgroundUrl={activeBgImage?.url || desktopDesertBg}
        onClose={closeImageBank}
      />

      {/* Primary workspace column: shifts smoothly left/right when either 50% desktop panel opens */}
      <div
        className={`relative z-10 flex-1 min-w-0 flex flex-col items-center px-4 sm:px-5 lg:px-6 pt-3.5 sm:pt-4 lg:pt-5 pb-6 lg:pb-8 ${
          isDesktopSplitActive ? 'lg:h-dvh lg:overflow-hidden' : 'min-h-dvh'
        }`}
      >
        {/* Top header: corners hug edges; URL bar shifts compactly left when split Stage 5 is active on desktop */}
        <header
          className={`relative z-30 w-full shrink-0 flex flex-col gap-2.5 lg:items-center lg:gap-4 transition-all duration-500 ${
            isDesktopSplitActive
              ? 'lg:grid lg:grid-cols-[auto_minmax(0,360px)_1fr]'
              : 'lg:grid lg:grid-cols-[1fr_minmax(0,768px)_1fr] lg:gap-6'
          }`}
        >
        {/* Top row on mobile (Logo left + Guest icon right); split into outer grid tracks on desktop */}
        <div className="flex items-center justify-between lg:contents">
          <div className="flex items-center justify-start lg:justify-self-start shrink-0">
            <SearchLinkLogo onDarkBackground="desktop" />
          </div>

          {/* Mobile top-right guest sketch or interactive authenticated avatar */}
          <div className="flex items-center justify-end lg:hidden">
            <GuestAvatarSketch
              variant="light"
              expanded={authUser ? isMobileMenuOpen : isAuthOpen}
              user={authUser}
              onClick={() => {
                if (authUser) {
                  setIsMobileMenuOpen((prev) => !prev);
                } else {
                  openAuthFlow();
                }
              }}
            />
          </div>
        </div>

        <motion.div
          layout
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={`w-full flex flex-col ${
            isDesktopSplitActive
              ? 'max-w-3xl mx-auto lg:max-w-[360px] lg:mx-0'
              : 'max-w-3xl mx-auto'
          }`}
        >
          <div className="flex items-center w-full">
            <motion.button
              type="button"
              onClick={() => {
                if (!authUser || isMobileImageBankActive) return;
                fileInputRef.current?.click();
              }}
              disabled={isExtracting || isMobileImageBankActive}
              aria-disabled={!authUser || isMobileImageBankActive}
              aria-hidden={isMobileImageBankActive}
              tabIndex={isMobileImageBankActive ? -1 : undefined}
              aria-label={t.app.uploadImagesAria}
              title={authUser ? t.app.uploadImagesTitle : undefined}
              initial={false}
              animate={{
                width: isMobileImageBankActive
                  ? 0
                  : isDesktopSplitActive && isDesktopViewport
                    ? 44
                    : 48,
                marginRight: isMobileImageBankActive
                  ? 0
                  : isDesktopViewport
                    ? 12
                    : 10,
                opacity: isMobileImageBankActive ? 0 : 1,
                scale: isMobileImageBankActive ? 0.65 : 1,
                borderWidth: isMobileImageBankActive ? 0 : 1,
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
              }
              className={`${
                isDesktopSplitActive ? 'h-12 lg:h-11' : 'h-12'
              } ${
                isMobileImageBankActive
                  ? 'overflow-hidden pointer-events-none'
                  : 'ring-1 ring-inset ring-white/85 lg:ring-0'
              } shrink-0 rounded-full flex items-center justify-center bg-white/40 lg:bg-white/95 backdrop-blur-xl lg:backdrop-blur-md border border-slate-900/12 lg:border-white/85 text-blue-600/85 lg:text-slate-600 shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 lg:focus-visible:ring-white disabled:opacity-60 disabled:cursor-not-allowed ${
                authUser
                  ? 'hover:bg-white/75 lg:hover:bg-white hover:text-blue-700 lg:hover:text-slate-900 active:scale-95 cursor-pointer'
                  : 'opacity-45 lg:opacity-55 cursor-default'
              }`}
            >
              <Upload className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </motion.button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={!authUser}
              onChange={handleFilesSelected}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />

            <form
              onSubmit={
                isMobileImageBankActive
                  ? (e) => {
                      e.preventDefault();
                      void handleImageBankSearch();
                    }
                  : handleSubmit
              }
              role="search"
              aria-label={
                isMobileImageBankActive
                  ? t.imageBank.panelAria
                  : t.app.pasteUrlFormAria
              }
              className="flex-1 min-w-0"
            >
              <div
                className={`group flex items-center ${
                  isDesktopSplitActive ? 'h-12 lg:h-11' : 'h-12'
                } w-full rounded-full px-4 lg:px-4.5 bg-white/40 lg:bg-white/95 backdrop-blur-xl lg:backdrop-blur-md border border-slate-900/12 lg:border-white/85 ring-1 ring-inset ring-white/85 lg:ring-0 shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-all duration-150 focus-within:bg-white/75 lg:focus-within:bg-white focus-within:border-blue-500/45 lg:focus-within:border-white focus-within:shadow-[0_10px_34px_-6px_rgba(37,99,235,0.2)] lg:focus-within:shadow-[0_14px_42px_-6px_rgba(0,0,0,0.48)]`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isMobileImageBankActive ? (
                    <motion.div
                      key="mobile-image-bank-bar"
                      initial={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
                      }
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                      className="flex items-center gap-2.5 w-full min-w-0"
                    >
                      <PenLine
                        className="w-4 h-4 text-blue-600/85 shrink-0"
                        aria-hidden="true"
                      />
                      <input
                        ref={imageBankMobileInputRef}
                        type="text"
                        enterKeyHint="search"
                        value={imageBankQuery}
                        onChange={(e) => handleImageBankQueryChange(e.target.value)}
                        placeholder={t.imageBank.placeholder}
                        aria-label={t.imageBank.inputAria}
                        spellCheck={false}
                        className="flex-1 min-w-0 bg-transparent text-[14px] sm:text-[15px] font-normal text-slate-900 placeholder:text-slate-500 focus:outline-none"
                      />
                      {isImageBankSearching && (
                        <Loader2
                          className="w-4 h-4 text-blue-600 animate-spin shrink-0"
                          aria-label={t.imageBank.searchingAria}
                        />
                      )}
                      <button
                        type="button"
                        onClick={closeImageBank}
                        aria-label={t.imageBank.closeAria}
                        className="flex items-center justify-center w-7 h-7 -mr-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="url-input-bar"
                      initial={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }
                      }
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                      className="flex items-center gap-2.5 lg:gap-3 w-full min-w-0"
                    >
                      <Link2
                        className="w-4 h-4 text-blue-600/75 lg:text-slate-400 shrink-0 transition-colors duration-150 group-focus-within:text-blue-600 lg:group-focus-within:text-slate-700"
                        aria-hidden="true"
                      />
                      <input
                        ref={inputRef}
                        type="text"
                        inputMode="url"
                        value={url}
                        onPaste={(e) => {
                          const pasted = e.clipboardData?.getData('text') ?? '';
                          if (pasted && rejectIfBlockedDomain(pasted)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          if (rejectIfBlockedDomain(nextVal)) return;
                          setUrl(nextVal);
                          if (extractError) setExtractError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder={t.app.urlPlaceholder}
                        aria-label={t.app.urlInputAria}
                        autoComplete="url"
                        spellCheck={false}
                        className="flex-1 min-w-0 bg-transparent text-[14px] sm:text-[15px] font-normal text-slate-900 placeholder:text-slate-500 lg:placeholder:text-slate-400 focus:outline-none"
                      />
                      {isExtracting ? (
                        <Loader2
                          className="w-4 h-4 text-blue-600 lg:text-slate-700 animate-spin shrink-0"
                          aria-label={t.app.extractingAria}
                        />
                      ) : (
                        url.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUrl('');
                              setExtractError(null);
                            }}
                            aria-label={t.app.clearUrlAria}
                            className="flex items-center justify-center w-7 h-7 -mr-1.5 rounded-full text-slate-500 lg:text-slate-400 hover:text-slate-800 hover:bg-white/60 lg:hover:bg-slate-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:focus-visible:ring-slate-400 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </form>

            {/* Symmetric right-side icon button for Pexels Image Bank */}
            <motion.button
              type="button"
              onClick={handleToggleImageBank}
              disabled={isMobileImageBankActive}
              aria-hidden={isMobileImageBankActive}
              tabIndex={isMobileImageBankActive ? -1 : undefined}
              aria-expanded={isImageBankOpen}
              aria-label={t.imageBank.openAria}
              title={t.imageBank.openTitle}
              initial={false}
              animate={{
                width: isMobileImageBankActive
                  ? 0
                  : isDesktopSplitActive && isDesktopViewport
                    ? 44
                    : 48,
                marginLeft: isMobileImageBankActive
                  ? 0
                  : isDesktopViewport
                    ? 12
                    : 10,
                opacity: isMobileImageBankActive ? 0 : 1,
                scale: isMobileImageBankActive ? 0.65 : 1,
                borderWidth: isMobileImageBankActive ? 0 : 1,
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
              }
              className={`${
                isDesktopSplitActive ? 'h-12 lg:h-11' : 'h-12'
              } ${
                isMobileImageBankActive
                  ? 'overflow-hidden pointer-events-none'
                  : 'ring-1 ring-inset ring-white/85 lg:ring-0'
              } shrink-0 rounded-full flex items-center justify-center backdrop-blur-xl lg:backdrop-blur-md border shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 lg:focus-visible:ring-white cursor-pointer hover:bg-white/75 lg:hover:bg-white hover:text-blue-700 lg:hover:text-slate-900 active:scale-95 ${
                isDesktopImageBankActive
                  ? 'bg-white/75 lg:bg-white border-blue-500/40 lg:border-white text-blue-700 lg:text-slate-950'
                  : 'bg-white/40 lg:bg-white/95 border-slate-900/12 lg:border-white/85 text-blue-600/85 lg:text-slate-600'
              }`}
            >
              <PenLine className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
            </motion.button>

            {/* Mobile-only Saved Images icon button right next to the Pexels input */}
            <motion.button
              type="button"
              onClick={() => {
                if (!isMobileImageBankActive) return;
                setIsImageBankSavedView((prev) => !prev);
              }}
              disabled={!isMobileImageBankActive}
              aria-hidden={!isMobileImageBankActive}
              aria-pressed={isImageBankSavedView}
              tabIndex={isMobileImageBankActive ? undefined : -1}
              aria-label={t.imageBank.savedAria}
              title={t.imageBank.savedTitle}
              initial={false}
              animate={{
                width: isMobileImageBankActive ? 48 : 0,
                marginLeft: isMobileImageBankActive ? 10 : 0,
                opacity: isMobileImageBankActive ? 1 : 0,
                scale: isMobileImageBankActive ? 1 : 0.65,
                borderWidth: isMobileImageBankActive ? 1 : 0,
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
              }
              className={`relative lg:hidden h-12 ${
                isMobileImageBankActive
                  ? 'ring-1 ring-inset ring-white/85'
                  : 'overflow-hidden pointer-events-none'
              } shrink-0 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 cursor-pointer active:scale-95 ${
                isImageBankSavedView
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white/40 border-slate-900/12 text-blue-600/85 hover:bg-white/75 hover:text-blue-700'
              }`}
            >
              <Bookmark
                className={`w-4.5 h-4.5 shrink-0 ${isImageBankSavedView ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              {isMobileImageBankActive && savedImageBankItems.length > 0 && !isImageBankSavedView && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums shadow"
                >
                  {savedImageBankItems.length}
                </span>
              )}
            </motion.button>
          </div>

          {isMobileImageBankActive ? (
            <div className="mt-2.5 px-3 text-center">
              {imageBankGuestIpBlockedNotice ? (
                <p
                  role="alert"
                  className="mb-2 px-2 text-[11px] sm:text-xs font-medium leading-snug text-red-600 text-center"
                >
                  {imageBankGuestIpBlockedNotice}
                </p>
              ) : imageBankPlusNotice ? (
                <p
                  role="status"
                  className="mb-2 px-2 text-[11px] sm:text-xs font-medium leading-snug text-red-600 text-center"
                >
                  {imageBankPlusNotice}
                </p>
              ) : aiGenerateError ? (
                <p
                  role="alert"
                  className="mb-2 px-2 text-[11px] sm:text-xs font-medium leading-snug text-red-600 text-center"
                >
                  {aiGenerateError}
                </p>
              ) : (
                imageBankCooldownMessage && (
                  <p
                    role="status"
                    className="mb-2 px-2 text-[11px] sm:text-xs font-medium leading-snug text-red-600 text-center tabular-nums"
                  >
                    {imageBankCooldownMessage}
                  </p>
                )
              )}
              <p className="text-xs font-semibold tracking-tight text-black">
                {t.imageBank.brandTitle}
              </p>
              <p className="mt-0.5 text-[11px] sm:text-xs font-normal leading-snug text-black">
                {t.imageBank.publicBankNotice}{' '}
                <a
                  href="https://www.pexels.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  {t.imageBank.publicBankLinkLabel}
                </a>
                {' · '}
                <a
                  href="https://pixabay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  {t.imageBank.publicBankSecondLinkLabel}
                </a>
              </p>
            </div>
          ) : (
            <>
              {!authUser && guestIpBlocked ? (
                <p
                  role="alert"
                  className="mt-2 px-3 text-[11px] sm:text-xs font-medium leading-snug text-rose-600 lg:text-rose-200 lg:drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] text-center"
                >
                  {t.app.guestIpBlockedError}
                </p>
              ) : extractError ? (
                <p
                  role="alert"
                  className="mt-2 px-4 text-xs font-medium text-rose-600 lg:text-rose-200 lg:drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] text-center"
                >
                  {extractError}
                </p>
              ) : pendingDomainBatch ? (
                pendingDomainBatch.promptKind !== 'savedCatalog' &&
                !pendingDomainBatch.legalAccepted ? (
                  <p
                    role="status"
                    className="mt-2 px-3 text-[11px] sm:text-xs font-normal leading-snug text-black lg:text-white lg:drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] text-center"
                  >
                    <span>{t.app.domainRightsPromptQuestion}</span>{' '}
                    <span className="inline-flex items-center gap-3.5 ml-1.5">
                      <button
                        type="button"
                        onClick={handleCancelDomainBatch}
                        className="bg-transparent border-0 p-0 text-[11px] sm:text-xs font-semibold text-red-600 lg:text-red-400 hover:underline focus-visible:outline-none focus-visible:underline cursor-pointer"
                      >
                        {t.app.domainPromptCancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleAcceptDomainRights}
                        className="bg-transparent border-0 p-0 text-[11px] sm:text-xs font-semibold text-blue-600 lg:text-sky-400 hover:underline focus-visible:outline-none focus-visible:underline cursor-pointer"
                      >
                        {t.app.domainRightsPromptAccept}
                      </button>
                    </span>
                  </p>
                ) : (
                  <p
                    role="status"
                    className="mt-2 px-3 text-[11px] sm:text-xs font-normal leading-snug text-black lg:text-white lg:drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] text-center"
                  >
                    <span>
                      {pendingDomainBatch.promptKind === 'savedCatalog'
                        ? t.app.savedCatalogPromptQuestion
                        : t.app.domainPromptQuestion}
                    </span>{' '}
                    <span className="inline-flex items-center gap-3.5 ml-1.5">
                      <button
                        type="button"
                        onClick={handleCancelDomainBatch}
                        className="bg-transparent border-0 p-0 text-[11px] sm:text-xs font-semibold text-red-600 lg:text-red-400 hover:underline focus-visible:outline-none focus-visible:underline cursor-pointer"
                      >
                        {t.app.domainPromptCancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDomainContinue}
                        className="bg-transparent border-0 p-0 text-[11px] sm:text-xs font-semibold text-blue-600 lg:text-sky-400 hover:underline focus-visible:outline-none focus-visible:underline cursor-pointer"
                      >
                        {pendingDomainBatch.promptKind === 'savedCatalog'
                          ? t.app.savedCatalogPromptAccept
                          : t.app.domainPromptContinue}
                      </button>
                    </span>
                  </p>
                )
              ) : (
                batchNotice && (
                  <p
                    role="status"
                    className="mt-2 px-3 text-[11px] sm:text-xs font-normal leading-snug text-black lg:text-white lg:drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] text-center"
                  >
                    {batchNotice}
                  </p>
                )
              )}
            </>
          )}
        </motion.div>

        {/* Desktop top-right guest sketch or interactive Google avatar */}
        <div className="hidden lg:flex lg:justify-self-end items-center justify-end">
          <GuestAvatarSketch
            variant="dark"
            expanded={authUser ? isDesktopMenuOpen : isAuthOpen}
            user={authUser}
            onClick={() => {
              closeImageBank();
              if (authUser) {
                if (isDesktopMenuOpen) {
                  navigateToAppRoute({ kind: 'home' });
                } else {
                  setDesktopMenuView('menu');
                  setIsDesktopMenuOpen(true);
                }
              } else {
                openAuthFlow();
              }
            }}
          />
        </div>
      </header>

      {/* Desktop-only dual showcase boxes with cross-gap animations & Stage 5 split workspace */}
      <DualCatalogShowcase
        key={`desktop-catalog-${catalogVersion}`}
        images={catalogImages}
        activeBackgroundId={activeBgImage?.id ?? null}
        onSelectBackground={handleSelectBackground}
        suspendShortcuts={
          (isAuthOpen && !authUser) ||
          (isDesktopMenuOpen && Boolean(authUser)) ||
          isImageBankOpen
        }
        isFileUploadFlow={isFileUploadFlow}
        showCompressionBox={showCompressionBox}
        compressionStatuses={compressionStatuses}
        showUploadBox={showUploadBox}
        uploadStatuses={uploadStatuses}
        showReceiveBox={showReceiveBox}
        receiveStatuses={receiveStatuses}
        showMapBox={showMapBox}
        mapStatuses={mapStatuses}
        mappedResults={mappedResults}
        compressionResults={compressionResults}
        isReadOnlyReplay={isReadOnlyReplay}
        serviceCredentials={activeServiceCredentials}
        organizationName={orgProfile.name}
        jobStatus={activeJobStatus}
        planBRolledBack={jobPlanBRolledBack}
        policyBlocked={jobPolicyBlocked}
        jobNotice={jobLifecycleNotice}
      />

      {/* Desktop-only animated automation examples below the home showcase; fades out once an automation flow starts */}
      <AutomationExamplesSection
        visible={!hasSearched && !isFileUploadFlow && !isExtracting}
      />

      {/* Mobile-only: either empty open gallery canvas when unified Image Bank is active, or swipeable catalog carousel */}
      <AnimatePresence mode="wait" initial={false}>
        {isMobileImageBankActive ? (
          <motion.section
            key="mobile-image-bank-empty-canvas"
            aria-label={t.imageBank.panelAria}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            className="lg:hidden relative z-10 w-full flex-1 min-h-0 pt-5 pb-6"
          >
            <ImageBankResultsGrid
              items={imageBankResults}
              savedIds={savedImageBankIds}
              isSearching={isImageBankSearching}
              hasSearched={hasSearchedImageBank}
              error={imageBankError}
              onToggleSave={handleToggleSaveImageBankItem}
              onGenerateAi={() => void handleGenerateAiImage()}
              isGeneratingAi={isGeneratingAiImage}
              generatedAiImage={generatedAiImage}
              variant="mobile"
            />
          </motion.section>
        ) : (
          <motion.div
            key="mobile-catalog-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="lg:hidden w-full"
          >
            <MobileCatalogCarousel
              key={isReadOnlyReplay ? `mobile-replay-${catalogVersion}` : 'mobile-live'}
              images={catalogImages}
              isUnified={hasSearched}
              isExtracting={isExtracting}
              extractError={extractError}
              hasExtractedResults={catalogVersion > 0}
              showCompressionBox={showCompressionBox}
              compressionStatuses={compressionStatuses}
              showUploadBox={showUploadBox}
              uploadStatuses={uploadStatuses}
              showReceiveBox={showReceiveBox}
              receiveStatuses={receiveStatuses}
              showMapBox={showMapBox}
              mapStatuses={mapStatuses}
              mappedResults={mappedResults}
              compressionResults={compressionResults}
              isReadOnlyReplay={isReadOnlyReplay}
              serviceCredentials={activeServiceCredentials}
              organizationName={orgProfile.name}
              jobStatus={activeJobStatus}
              planBRolledBack={jobPlanBRolledBack}
              policyBlocked={jobPolicyBlocked}
              jobNotice={jobLifecycleNotice}
              onOpenOrganization={() => {
                if (authUser) {
                  navigateToAppRoute({ kind: 'organization' });
                } else {
                  openAuthFlow();
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Desktop-only push-docked right menu (expands 25% -> 50% rounded on account / organization views) */}
      {authUser && (
        <DesktopAccountMenu
          open={isDesktopMenuOpen}
          view={desktopMenuView}
          selectedStoreServiceId={selectedStoreServiceId}
          selectedSchemaServiceId={selectedSchemaServiceId}
          selectedApiKeyServiceId={selectedApiKeyServiceId}
          selectedEndpointTestServiceId={selectedEndpointTestServiceId}
          selectedTrafficServiceId={selectedTrafficServiceId}
          selectedTrafficLimitServiceId={selectedTrafficLimitServiceId}
          onViewChange={(nextView, service) => {
            if (nextView === 'menu') {
              setDesktopMenuView('menu');
              setSelectedStoreServiceId(null);
              setSelectedSchemaServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              pushRouteUrl({ kind: 'home' });
              return;
            }
            if (nextView === 'store') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedStoreServiceId) ??
                orgServices[0];
              setSelectedStoreServiceId(target?.id ?? null);
              setSelectedSchemaServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              setDesktopMenuView('store');
              pushRouteUrl({ kind: 'store', slug: target?.slug });
              return;
            }
            if (nextView === 'schema') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedSchemaServiceId) ??
                orgServices[0];
              setSelectedSchemaServiceId(target?.id ?? null);
              setSelectedStoreServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              setDesktopMenuView('schema');
              pushRouteUrl({ kind: 'schema', slug: target?.slug });
              return;
            }
            if (nextView === 'api-key') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedApiKeyServiceId) ??
                orgServices[0];
              setSelectedApiKeyServiceId(target?.id ?? null);
              setSelectedStoreServiceId(null);
              setSelectedSchemaServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              setDesktopMenuView('api-key');
              pushRouteUrl({ kind: 'api-key', slug: target?.slug });
              return;
            }
            if (nextView === 'endpoint-test') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedEndpointTestServiceId) ??
                orgServices[0];
              setSelectedEndpointTestServiceId(target?.id ?? null);
              setSelectedStoreServiceId(null);
              setSelectedSchemaServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedTrafficServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              setDesktopMenuView('endpoint-test');
              pushRouteUrl({ kind: 'endpoint-test', slug: target?.slug });
              return;
            }
            if (nextView === 'traffic') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedTrafficServiceId) ??
                orgServices[0];
              setSelectedTrafficServiceId(target?.id ?? null);
              setSelectedStoreServiceId(null);
              setSelectedSchemaServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficLimitServiceId(null);
              setDesktopMenuView('traffic');
              pushRouteUrl({ kind: 'traffic', slug: target?.slug });
              return;
            }
            if (nextView === 'traffic-limit') {
              const target =
                service ??
                orgServices.find((srv) => srv.id === selectedTrafficLimitServiceId) ??
                orgServices[0];
              setSelectedTrafficLimitServiceId(target?.id ?? null);
              setSelectedStoreServiceId(null);
              setSelectedSchemaServiceId(null);
              setSelectedApiKeyServiceId(null);
              setSelectedEndpointTestServiceId(null);
              setSelectedTrafficServiceId(null);
              setDesktopMenuView('traffic-limit');
              pushRouteUrl({ kind: 'traffic-limit', slug: target?.slug });
              return;
            }
            setSelectedStoreServiceId(null);
            setSelectedSchemaServiceId(null);
            setSelectedApiKeyServiceId(null);
            setSelectedEndpointTestServiceId(null);
            setSelectedTrafficServiceId(null);
            setSelectedTrafficLimitServiceId(null);
            setDesktopMenuView(nextView);
            pushRouteUrl({ kind: nextView });
          }}
          user={authUser}
          orgProfile={orgProfile}
          services={orgServices}
          onSaveOrgProfile={handleSaveOrgProfile}
          onRenameService={handleRenameService}
          onNewProduct={handleStartNewProduct}
          onViewServiceHistory={handleViewServiceHistory}
          onOpenServiceChat={handleOpenServiceChat}
          onRotateServiceKey={handleRotateServiceKey}
          onToggleServiceActive={handleToggleServiceActive}
          onDeleteService={handleDeleteService}
          onOpenDocumentation={openDocumentationRoute}
          onClose={() => navigateToAppRoute({ kind: 'home' })}
          onSignOut={handleSignOut}
          onPurgeAllR2={handlePurgeAllR2}
          onClearBrowserData={handleClearBrowserData}
          onDeleteAccount={handleDeleteAccountPermanently}
          onPauseAllApis={handlePauseAllApis}
          onUnfreezeAllApis={handleUnfreezeAllApis}
          hasR2Images={hasR2Images}
          hasActiveApis={hasActiveApis}
          hasPausedApis={hasPausedApis}
        />
      )}

      {/* Mobile-only slim right menu + centered Google account modal + full-screen Organización & Mi tienda */}
      {authUser && (
        <MobileAccountMenu
          menuOpen={isMobileMenuOpen}
          accountModalOpen={isMobileAccountModalOpen}
          languageModalOpen={isMobileLanguageModalOpen}
          connectServerModalOpen={isMobileConnectServerOpen}
          advancedSettingsModalOpen={isMobileAdvancedSettingsOpen}
          panelOpen={isMobilePanelOpen}
          panelSubView={mobilePanelSubView}
          selectedStoreServiceId={selectedStoreServiceId}
          selectedSchemaServiceId={selectedSchemaServiceId}
          selectedApiKeyServiceId={selectedApiKeyServiceId}
          selectedEndpointTestServiceId={selectedEndpointTestServiceId}
          selectedTrafficServiceId={selectedTrafficServiceId}
          selectedTrafficLimitServiceId={selectedTrafficLimitServiceId}
          user={authUser}
          orgProfile={orgProfile}
          services={orgServices}
          onSaveOrgProfile={handleSaveOrgProfile}
          onRenameService={handleRenameService}
          onNewProduct={handleStartNewProduct}
          onViewServiceHistory={handleViewServiceHistory}
          onOpenServiceChat={handleOpenServiceChat}
          onRotateServiceKey={handleRotateServiceKey}
          onToggleServiceActive={handleToggleServiceActive}
          onDeleteService={handleDeleteService}
          onCloseMenu={() => setIsMobileMenuOpen(false)}
          onOpenAccountModal={() => navigateToAppRoute({ kind: 'google-account' })}
          onCloseAccountModal={() => navigateToAppRoute({ kind: 'home' })}
          onOpenLanguageModal={() => navigateToAppRoute({ kind: 'language' })}
          onCloseLanguageModal={() => navigateToAppRoute({ kind: 'home' })}
          onOpenConnectServerModal={() => navigateToAppRoute({ kind: 'connect-server' })}
          onCloseConnectServerModal={() => navigateToAppRoute({ kind: 'home' })}
          onOpenAdvancedSettingsModal={() =>
            navigateToAppRoute({ kind: 'advanced-settings' })
          }
          onCloseAdvancedSettingsModal={() => navigateToAppRoute({ kind: 'home' })}
          onBackToAccountFromAdvancedSettings={() =>
            navigateToAppRoute({ kind: 'google-account' })
          }
          onOpenPanel={() => navigateToAppRoute({ kind: 'organization' })}
          onClosePanel={() => navigateToAppRoute({ kind: 'home' })}
          onOpenStore={(service) =>
            navigateToAppRoute({ kind: 'store', slug: service.slug })
          }
          onOpenApiKey={(service) =>
            navigateToAppRoute({ kind: 'api-key', slug: service.slug })
          }
          onOpenEndpointTest={(service) =>
            navigateToAppRoute({ kind: 'endpoint-test', slug: service.slug })
          }
          onOpenTraffic={(service) =>
            navigateToAppRoute({ kind: 'traffic', slug: service.slug })
          }
          onOpenTrafficLimit={(service) =>
            navigateToAppRoute({ kind: 'traffic-limit', slug: service.slug })
          }
          onBackToOrganization={() => navigateToAppRoute({ kind: 'organization' })}
          onOpenSchema={(service) =>
            navigateToAppRoute({ kind: 'schema', slug: service.slug })
          }
          onCloseSchema={() => navigateToAppRoute({ kind: 'organization' })}
          onOpenDocumentation={openDocumentationRoute}
          onSignOut={handleSignOut}
          onPurgeAllR2={handlePurgeAllR2}
          onClearBrowserData={handleClearBrowserData}
          onDeleteAccount={handleDeleteAccountPermanently}
          onPauseAllApis={handlePauseAllApis}
          onUnfreezeAllApis={handleUnfreezeAllApis}
          hasR2Images={hasR2Images}
          hasActiveApis={hasActiveApis}
          hasPausedApis={hasPausedApis}
        />
      )}

      {/* Search Link IA public chatbot simulator pre-configured with Search Link Core API & Endpoint */}
      <SearchLinkChatDrawer
        service={
          activeChatServiceId
            ? orgServices.find((srv) => srv.id === activeChatServiceId) ?? null
            : null
        }
        organizationName={orgProfile.name}
        userId={authUser?.id}
        onClose={handleCloseServiceChat}
      />

      {/* Auth view: independent /login full-screen on mobile, right half drawer on desktop */}
      <AuthDrawer
        open={isAuthOpen && !authUser}
        onClose={closeAuthFlow}
        onOpenLegalDoc={(docId) => openDocumentationRoute(docId, true)}
      />

      {/* Mobile-only full-screen white Guardado interface opened from the saved icon */}
      <AnimatePresence>
        {isMobileImageBankActive && isImageBankSavedView && (
          <motion.div
            key="mobile-image-bank-saved-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label={t.imageBank.savedFullTitle}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 lg:hidden bg-white flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-200/75 bg-white shrink-0">
              <h2 className="text-base font-semibold tracking-tight text-slate-950">
                {t.imageBank.savedFullTitle}
              </h2>
              <button
                type="button"
                onClick={() => setIsImageBankSavedView(false)}
                aria-label={t.imageBank.closeSavedAria}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <ImageBankSavedGrid
                items={savedImageBankItems}
                onRemove={handleRemoveSavedImageBankItem}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

interface GuestAvatarSketchProps {
  variant: 'light' | 'dark';
  expanded: boolean;
  user: User | null;
  onClick: () => void;
}

function GuestAvatarSketch({
  variant,
  expanded,
  user,
  onClick,
}: GuestAvatarSketchProps) {
  const { t } = useI18n();
  const [imgFailed, setImgFailed] = useState(false);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const provider =
    typeof appMeta.provider === 'string' ? appMeta.provider : 'email';

  const rawGooglePhoto =
    typeof meta.avatar_url === 'string' && meta.avatar_url.trim()
      ? meta.avatar_url.trim()
      : typeof meta.picture === 'string' && meta.picture.trim()
        ? meta.picture.trim()
        : null;

  useEffect(() => {
    setImgFailed(false);
  }, [rawGooglePhoto]);

  const showGooglePhoto = Boolean(
    user && (provider === 'google' || rawGooglePhoto) && rawGooglePhoto && !imgFailed,
  );

  if (user) {
    const rawName =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.name === 'string' && meta.name.trim()) ||
      user.email?.split('@')[0] ||
      'U';
    const initialLetter = rawName.trim().charAt(0).toUpperCase() || 'U';
    const ringClass =
      variant === 'light'
        ? 'border-slate-300/90 shadow-[0_2px_10px_rgba(15,23,42,0.12)]'
        : 'border-white/75 shadow-[0_2px_12px_rgba(0,0,0,0.35)]';
    const letterBgClass =
      variant === 'light'
        ? 'bg-slate-900 text-white'
        : 'bg-white text-slate-950';

    const avatarContent =
      showGooglePhoto && rawGooglePhoto ? (
        <img
          src={rawGooglePhoto}
          alt={rawName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs sm:text-sm font-semibold leading-none tracking-tight">
          {initialLetter}
        </span>
      );

    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        aria-label={t.app.openAccountMenuAria(rawName)}
        title={rawName}
        className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border overflow-hidden flex items-center justify-center select-none cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 shrink-0 ${ringClass} ${
          showGooglePhoto ? 'bg-slate-100' : letterBgClass
        }`}
      >
        {avatarContent}
      </button>
    );
  }

  const toneClass =
    variant === 'light'
      ? 'border-slate-300/90 bg-white/85 text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.08)] hover:border-slate-400 hover:bg-white focus-visible:ring-slate-400'
      : 'border-white/50 bg-black/25 text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.28)] hover:border-white/85 hover:bg-black/35 focus-visible:ring-white/80';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={t.app.openAuthAria}
      title={t.app.openAuthTitle}
      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border backdrop-blur-sm flex items-center justify-center cursor-pointer select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 shrink-0 ${toneClass}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4.5 h-4.5 sm:w-5 sm:h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8.5" r="3.25" />
        <path d="M5.75 19.25a6.5 6.5 0 0 1 12.5 0" />
      </svg>
    </button>
  );
}
