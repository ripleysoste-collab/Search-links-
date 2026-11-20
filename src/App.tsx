import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import { Link2, Loader2, Upload, X } from 'lucide-react';
import desktopDesertBg from './assets/images/bg_desert_desktop_1794853953945.jpg';
import { AuthDrawer } from './components/AuthDrawer';
import { AutomationExamplesSection } from './components/AutomationExamplesSection';
import { DesktopAccountMenu } from './components/DesktopAccountMenu';
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
import { resolveApiUrl } from './lib/apiConfig';
import { useI18n } from './lib/i18n';
import {
  compressImageToWebp,
  mapUploadedImageWithAi,
  renderImageBlobFromUrl,
  uploadCompressedImage,
  type CompressedImageResult,
  type MappedImageMetadata,
  type UploadedCompressedImage,
} from './lib/imageCompression';
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

const MAX_FREE_UPLOAD_IMAGES = 20;
const MAX_GUEST_EXTRACT_IMAGES = 10;
const MAX_ADMIN_EXTRACT_IMAGES = 50;
const ADMIN_EXTRACT_ONLY_EMAIL = 'cristiancuerodiaz@gmail.com';
const COMPRESSION_START_DELAY_MS = 2000;
const UPLOAD_START_DELAY_MS = 1000;
const RECEIVE_START_DELAY_MS = 1000;
const MAP_START_DELAY_MS = 1800;
const UPLOAD_CONCURRENCY = 3;
const MAP_CONCURRENCY = 2;
const MIN_RENDER_STEP_MS = 230;
const MIN_TILE_STEP_MS = 260;
const MIN_RECEIVE_STEP_MS = 230;
const MIN_MAP_STEP_MS = 230;

type BatchImageSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

export default function App() {
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
  const [isAuthOpen, setIsAuthOpen] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/login',
  );
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAccountModalOpen, setIsMobileAccountModalOpen] = useState(false);
  const [isMobileLanguageModalOpen, setIsMobileLanguageModalOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
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
  const [pendingDomainBatch, setPendingDomainBatch] = useState<{
    items: CatalogImageItem[];
    originUrl: string;
    overflowNotice: string | null;
  } | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile>({
    name: 'Sin nombre',
    logoUrl: null,
    logoR2Key: null,
    hasCompletedSetup: false,
  });
  const [orgServices, setOrgServices] = useState<OrganizationServiceItem[]>([]);
  const [activeChatServiceId, setActiveChatServiceId] = useState<string | null>(
    null,
  );
  const [activeServiceCredentials, setActiveServiceCredentials] =
    useState<ServiceCredentialsDisplay | null>(null);
  const [guestIpBlocked, setGuestIpBlocked] = useState(false);
  const authUserRef = useRef<User | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractAbortRef = useRef<AbortController | null>(null);
  const compressionAbortRef = useRef<AbortController | null>(null);
  const compressionTimerRef = useRef<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();

  const usedFreeImages = orgServices.reduce(
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
    if (!authUser) {
      setOrgProfile({
        name: 'Sin nombre',
        logoUrl: null,
        logoR2Key: null,
        hasCompletedSetup: false,
      });
      setOrgServices([]);
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
      const [{ organization, tableMissing: orgMissing }, { services: remoteServices, tableMissing: srvMissing }] =
        await Promise.all([
          fetchUserOrganizationSafe(),
          fetchUserCoreServicesSafe(),
        ]);

      if (!active) return;

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
    })();

    return () => {
      active = false;
    };
  }, [authUser]);

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

  const handleRenameService = (serviceId: string, nextName: string) => {
    setOrgServices((prev) => {
      const updated = prev.map((srv) =>
        srv.id === serviceId ? { ...srv, name: nextName } : srv,
      );
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
      return updated;
    });
    void renameCoreServiceInSupabase(serviceId, nextName);
  };

  const handleRotateServiceKey = async (
    serviceId: string,
  ): Promise<string | null> => {
    const minted = await generateCoreApiKey();
    setOrgServices((prev) => {
      const updated = prev.map((srv) =>
        srv.id === serviceId
          ? { ...srv, apiKey: minted.rawKey, keyPrefix: minted.keyPrefix }
          : srv,
      );
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
      return updated;
    });
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
    setOrgServices((prev) => {
      const updated = prev.map((srv) =>
        srv.id === serviceId ? { ...srv, isActive: nextActive } : srv,
      );
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
      return updated;
    });
    await toggleCoreServiceActiveInSupabase(serviceId, nextActive);
  };

  const handleStartNewProduct = () => {
    extractAbortRef.current?.abort();
    cancelOngoingCompression();
    setIsDesktopMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobilePanelOpen(false);
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
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobilePanelOpen(false);
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

  const openAuthFlow = () => {
    if (authUserRef.current) return;
    if (
      typeof window !== 'undefined' &&
      window.innerWidth < 1024 &&
      window.location.pathname !== '/login'
    ) {
      window.history.pushState({ authRoute: true }, '', '/login');
    }
    setIsAuthOpen(true);
  };

  const closeAuthFlow = () => {
    setIsAuthOpen(false);
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      window.history.replaceState(null, '', '/');
    }
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const sessionUser = data.session?.user ?? null;
        setAuthUser(sessionUser);
        if (sessionUser) {
          setIsAuthOpen(false);
          if (window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        const nextUser = session?.user ?? null;
        setAuthUser(nextUser);
        if (nextUser) {
          setIsAuthOpen(false);
          if (window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        } else {
          setIsDesktopMenuOpen(false);
          setIsMobileMenuOpen(false);
          setIsMobileAccountModalOpen(false);
          setIsMobileLanguageModalOpen(false);
          setIsMobilePanelOpen(false);
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
      if (window.location.pathname === '/login' && !authUserRef.current) {
        setIsAuthOpen(true);
      } else {
        setIsAuthOpen(false);
      }
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

  const handleSignOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setAuthUser(null);
    setActiveChatServiceId(null);
    setIsDesktopMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsMobileAccountModalOpen(false);
    setIsMobileLanguageModalOpen(false);
    setIsMobilePanelOpen(false);
  };

  useEffect(() => {
    if (
      !isAuthOpen &&
      !isDesktopMenuOpen &&
      !isMobileMenuOpen &&
      !isMobileAccountModalOpen &&
      !isMobileLanguageModalOpen &&
      !isMobilePanelOpen &&
      !activeChatServiceId
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (activeChatServiceId) {
          setActiveChatServiceId(null);
          return;
        }
        if (isAuthOpen) closeAuthFlow();
        if (isDesktopMenuOpen) setIsDesktopMenuOpen(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (isMobileAccountModalOpen) setIsMobileAccountModalOpen(false);
        if (isMobileLanguageModalOpen) setIsMobileLanguageModalOpen(false);
        if (isMobilePanelOpen) setIsMobilePanelOpen(false);
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
    isMobileMenuOpen,
    isMobileAccountModalOpen,
    isMobileLanguageModalOpen,
    isMobilePanelOpen,
    activeChatServiceId,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isExtracting) return;

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
        error?: string;
      };

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

  const handleConfirmDomainContinue = () => {
    if (!pendingDomainBatch) return;
    const currentUser = authUserRef.current;
    if (!currentUser) {
      setPendingDomainBatch(null);
      setBatchNotice(t.app.guestExtractOnlyNotice);
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
    setActiveServiceCredentials(null);
    setHasSearched(true);
    setCatalogImages(items);
    setCatalogVersion((prev) => prev + 1);

    const controller = new AbortController();
    compressionAbortRef.current = controller;

    // Wait 2 seconds after images settle, then run Stage 2 (render URL if needed -> WebP compress), Stage 3 (R2 upload), Stage 4 (receive URLs)
    compressionTimerRef.current = window.setTimeout(() => {
      compressionTimerRef.current = null;
      if (controller.signal.aborted) return;

      setShowCompressionBox(true);

      type RenderTaskResult =
        | { ok: true; blob: Blob }
        | { ok: false };

      type CompressTaskResult =
        | { ok: true; data: CompressedImageResult }
        | { ok: false };

      const renderResolvers: Array<(res: RenderTaskResult) => void> = [];
      const renderPromises: Array<Promise<RenderTaskResult>> = sources.map(
        (_, idx) =>
          new Promise<RenderTaskResult>((resolve) => {
            renderResolvers[idx] = resolve;
          }),
      );

      const compressResolvers: Array<(res: CompressTaskResult) => void> = [];
      const compressPromises: Array<Promise<CompressTaskResult>> = sources.map(
        (_, idx) =>
          new Promise<CompressTaskResult>((resolve) => {
            compressResolvers[idx] = resolve;
          }),
      );

      // Workers render URLs (if remote) and compress to WebP in parallel
      let workerCursor = 0;
      const workerCount = Math.min(UPLOAD_CONCURRENCY, sources.length);
      for (let w = 0; w < workerCount; w++) {
        void (async () => {
          while (workerCursor < sources.length && !controller.signal.aborted) {
            const index = workerCursor++;
            const source = sources[index];

            try {
              let sourceBlob: Blob;
              if (source.kind === 'url') {
                sourceBlob = await renderImageBlobFromUrl(
                  source.url,
                  controller.signal,
                );
                renderResolvers[index]({ ok: true, blob: sourceBlob });
              } else {
                sourceBlob = source.file;
                renderResolvers[index]({ ok: true, blob: sourceBlob });
              }

              const compressed = await compressImageToWebp(sourceBlob);
              compressResolvers[index]({ ok: true, data: compressed });
            } catch {
              renderResolvers[index]({ ok: false });
              compressResolvers[index]({ ok: false });
            }
          }
        })();
      }

      void (async () => {
        const compressedPayloads: Array<CompressedImageResult | null> = new Array(
          items.length,
        ).fill(null);

        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) return;
          const item = items[i];
          const source = sources[i];

          if (source.kind === 'url') {
            setCompressionStatuses((prev) => ({
              ...prev,
              [item.id]: 'rendering',
            }));

            const renderBeat = new Promise<void>((resolve) =>
              window.setTimeout(resolve, MIN_RENDER_STEP_MS),
            );
            const [renderResult] = await Promise.all([renderPromises[i], renderBeat]);
            if (controller.signal.aborted) return;

            if (!renderResult.ok) {
              setCompressionStatuses((prev) => ({
                ...prev,
                [item.id]: 'error',
              }));
              continue;
            }
          }

          setCompressionStatuses((prev) => ({
            ...prev,
            [item.id]: 'compressing',
          }));

          const stepBeat = new Promise<void>((resolve) =>
            window.setTimeout(
              resolve,
              source.kind === 'file' ? 320 : MIN_TILE_STEP_MS,
            ),
          );

          const [result] = await Promise.all([compressPromises[i], stepBeat]);
          if (controller.signal.aborted) return;

          if (result.ok) {
            compressedPayloads[i] = result.data;
            setCompressionStatuses((prev) => ({
              ...prev,
              [item.id]: 'done',
            }));
          } else {
            setCompressionStatuses((prev) => ({
              ...prev,
              [item.id]: 'error',
            }));
          }
        }

        // Wait 1 second after all images finish compressing before moving to Stage 3
        await new Promise<void>((resolve) => {
          compressionTimerRef.current = window.setTimeout(() => {
            compressionTimerRef.current = null;
            resolve();
          }, UPLOAD_START_DELAY_MS);
        });

        if (controller.signal.aborted) return;

        setShowUploadBox(true);

        type UploadTaskResult =
          | { ok: true; data: UploadedCompressedImage }
          | { ok: false; aborted: boolean; errorMessage?: string };

        const uploadResolvers: Array<(res: UploadTaskResult) => void> = [];
        const uploadPromises: Array<Promise<UploadTaskResult>> = compressedPayloads.map(
          (payload, idx) => {
            if (!payload) {
              return Promise.resolve({ ok: false, aborted: false });
            }
            return new Promise<UploadTaskResult>((resolve) => {
              uploadResolvers[idx] = resolve;
            });
          },
        );

        let uploadCursor = 0;
        const uploadWorkerCount = Math.min(UPLOAD_CONCURRENCY, compressedPayloads.length);
        for (let w = 0; w < uploadWorkerCount; w++) {
          void (async () => {
            while (
              uploadCursor < compressedPayloads.length &&
              !controller.signal.aborted
            ) {
              const index = uploadCursor++;
              const payload = compressedPayloads[index];
              if (!payload) continue;

              try {
                const data = await uploadCompressedImage(payload, controller.signal);
                uploadResolvers[index]({ ok: true, data });
              } catch (err) {
                const aborted =
                  controller.signal.aborted ||
                  (err instanceof DOMException && err.name === 'AbortError');
                const errorMessage =
                  err instanceof Error ? err.message : t.app.uploadImageError;
                uploadResolvers[index]({ ok: false, aborted, errorMessage });
              }
            }
          })();
        }

        const uploadedPayloads: Array<UploadedCompressedImage | null> = new Array(
          items.length,
        ).fill(null);
        let firstUploadError: string | null = null;

        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) return;
          const item = items[i];

          setUploadStatuses((prev) => ({
            ...prev,
            [item.id]: 'uploading',
          }));

          const stepBeat = new Promise<void>((resolve) =>
            window.setTimeout(resolve, MIN_TILE_STEP_MS),
          );

          const [result] = await Promise.all([uploadPromises[i], stepBeat]);
          if (controller.signal.aborted) return;

          if (result.ok) {
            uploadedPayloads[i] = result.data;
            setUploadStatuses((prev) => ({
              ...prev,
              [item.id]: 'done',
            }));
          } else if (!result.aborted) {
            if (!firstUploadError && result.errorMessage) {
              firstUploadError = result.errorMessage;
              setBatchNotice(result.errorMessage);
            }
            setUploadStatuses((prev) => ({
              ...prev,
              [item.id]: 'error',
            }));
          }
        }

        // Wait 1 second after all uploads finish before moving to Stage 4 ("Recibiendo")
        await new Promise<void>((resolve) => {
          compressionTimerRef.current = window.setTimeout(() => {
            compressionTimerRef.current = null;
            resolve();
          }, RECEIVE_START_DELAY_MS);
        });

        if (controller.signal.aborted) return;

        setShowReceiveBox(true);

        // Brief spin beat so the user sees all green circles rotating rapidly before URLs settle
        await new Promise<void>((resolve) => {
          compressionTimerRef.current = window.setTimeout(() => {
            compressionTimerRef.current = null;
            resolve();
          }, 360);
        });

        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) return;
          const item = items[i];
          const uploaded = uploadedPayloads[i];

          if (uploaded) {
            setCompressionResults((prev) => ({
              ...prev,
              [item.id]: {
                url: uploaded.url,
                cleanUrl: uploaded.url,
                savedPercent: uploaded.savedPercent,
                compressedBytes: uploaded.compressedBytes,
              },
            }));
            setReceiveStatuses((prev) => ({
              ...prev,
              [item.id]: 'received',
            }));
          } else {
            setReceiveStatuses((prev) => ({
              ...prev,
              [item.id]: 'error',
            }));
          }

          if (i < items.length - 1) {
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, MIN_RECEIVE_STEP_MS),
            );
          }
        }

        // Wait 1 second after all URLs are received before moving to Stage 5 ("Renderizar y mapear")
        await new Promise<void>((resolve) => {
          compressionTimerRef.current = window.setTimeout(() => {
            compressionTimerRef.current = null;
            resolve();
          }, MAP_START_DELAY_MS);
        });

        if (controller.signal.aborted) return;

        setShowMapBox(true);

        type MapTaskResult =
          | { ok: true; data: MappedImageMetadata }
          | { ok: false; aborted: boolean; errorMessage?: string };

        const mapResolvers: Array<(res: MapTaskResult) => void> = [];
        const mapPromises: Array<Promise<MapTaskResult>> = uploadedPayloads.map(
          (uploaded, idx) => {
            if (!uploaded) {
              return Promise.resolve({ ok: false, aborted: false });
            }
            return new Promise<MapTaskResult>((resolve) => {
              mapResolvers[idx] = resolve;
            });
          },
        );

        let mapCursor = 0;
        const mapWorkerCount = Math.min(MAP_CONCURRENCY, uploadedPayloads.length);
        for (let w = 0; w < mapWorkerCount; w++) {
          void (async () => {
            if (w > 0) {
              await new Promise<void>((resolve) =>
                window.setTimeout(resolve, w * 180),
              );
            }
            while (
              mapCursor < uploadedPayloads.length &&
              !controller.signal.aborted
            ) {
              const index = mapCursor++;
              const uploaded = uploadedPayloads[index];
              if (!uploaded) continue;

              try {
                const data = await mapUploadedImageWithAi(
                  { key: uploaded.key, imageUrl: uploaded.url },
                  controller.signal,
                );
                mapResolvers[index]({ ok: true, data });
              } catch (err) {
                const aborted =
                  controller.signal.aborted ||
                  (err instanceof DOMException && err.name === 'AbortError');
                const errorMessage =
                  err instanceof Error ? err.message : t.app.mapImageError;
                mapResolvers[index]({ ok: false, aborted, errorMessage });
              }
            }
          })();
        }

        let firstMapError: string | null = null;
        const collectedMappedItems: Array<
          MappedImageMetadata & { r2Key?: string; savedPercent?: number }
        > = [];
        const mappedPayloads: Array<MappedImageMetadata | null> = new Array(
          items.length,
        ).fill(null);

        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) return;
          const item = items[i];

          setMapStatuses((prev) => ({
            ...prev,
            [item.id]: 'mapping',
          }));

          const stepBeat = new Promise<void>((resolve) =>
            window.setTimeout(resolve, MIN_MAP_STEP_MS),
          );

          const [mapResult] = await Promise.all([mapPromises[i], stepBeat]);
          if (controller.signal.aborted) return;

          if (mapResult.ok) {
            mappedPayloads[i] = mapResult.data;
            collectedMappedItems.push({
              ...mapResult.data,
              r2Key: uploadedPayloads[i]?.key,
              savedPercent: uploadedPayloads[i]?.savedPercent ?? 0,
            });
            setMappedResults((prev) => ({
              ...prev,
              [item.id]: mapResult.data,
            }));
            setMapStatuses((prev) => ({
              ...prev,
              [item.id]: 'mapped',
            }));
          } else if (!mapResult.aborted) {
            if (!firstMapError && mapResult.errorMessage) {
              firstMapError = mapResult.errorMessage;
              setBatchNotice(mapResult.errorMessage);
            }
            setMapStatuses((prev) => ({
              ...prev,
              [item.id]: 'error',
            }));
          }
        }

        if (collectedMappedItems.length > 0 && !controller.signal.aborted) {
          const firstProductName =
            collectedMappedItems[0]?.nombre?.trim() || t.common.productFallback;
          const defaultServiceName = /^(?:servicio|service|serviço)\s+/i.test(
            firstProductName,
          )
            ? firstProductName
            : t.app.serviceDefaultPrefix(firstProductName);

          const snapshotImages: CatalogImageItem[] = items.map((item, idx) => {
            const uploaded = uploadedPayloads[idx];
            const permanentUrl =
              uploaded?.url || (!item.url.startsWith('blob:') ? item.url : '');
            return {
              ...item,
              url: permanentUrl || item.url,
              cleanUrl: uploaded?.url ?? item.cleanUrl,
            };
          });

          const snapshotCompressionStatuses: Record<string, ImageCompressionStatus> = {};
          const snapshotUploadStatuses: Record<string, ImageUploadStatus> = {};
          const snapshotReceiveStatuses: Record<string, ImageReceiveStatus> = {};
          const snapshotMapStatuses: Record<string, ImageMapStatus> = {};
          const snapshotMappedResults: Record<string, MappedImageMetadata> = {};
          const snapshotCompressionResults: Record<string, CompressedImageMeta> = {};

          items.forEach((item, idx) => {
            const compressed = compressedPayloads[idx];
            const uploaded = uploadedPayloads[idx];
            const mapped = mappedPayloads[idx];

            snapshotCompressionStatuses[item.id] = compressed ? 'done' : 'error';
            snapshotUploadStatuses[item.id] = uploaded ? 'done' : 'error';
            snapshotReceiveStatuses[item.id] = uploaded ? 'received' : 'error';
            snapshotMapStatuses[item.id] = mapped ? 'mapped' : 'error';

            if (uploaded) {
              snapshotCompressionResults[item.id] = {
                url: uploaded.url,
                cleanUrl: uploaded.url,
                savedPercent: uploaded.savedPercent,
                compressedBytes: uploaded.compressedBytes,
              };
            }

            if (mapped) {
              snapshotMappedResults[item.id] = mapped;
            }
          });

          const serviceSnapshot: OrganizationServiceSnapshot = {
            images: snapshotImages,
            compressionStatuses: snapshotCompressionStatuses,
            uploadStatuses: snapshotUploadStatuses,
            receiveStatuses: snapshotReceiveStatuses,
            mapStatuses: snapshotMapStatuses,
            mappedResults: snapshotMappedResults,
            compressionResults: snapshotCompressionResults,
          };

          const serviceSlug = generateCoreServiceSlug();
          const mintedKey = await generateCoreApiKey();
          const endpointUrl = buildCoreServiceEndpointUrl(serviceSlug);
          const tempServiceId = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          setActiveServiceCredentials({
            serviceName: defaultServiceName,
            apiKey: mintedKey.rawKey,
            endpointUrl,
            slug: serviceSlug,
          });

          const newService: OrganizationServiceItem = {
            id: tempServiceId,
            slug: serviceSlug,
            name: defaultServiceName,
            apiKey: mintedKey.rawKey,
            keyPrefix: mintedKey.keyPrefix,
            endpointUrl,
            isActive: true,
            requestsCount: 0,
            itemCount: collectedMappedItems.length,
            createdAt: new Date().toISOString(),
            products: collectedMappedItems.map((item, idx) => ({
              id: `prod-${Date.now()}-${idx}`,
              nombre: item.nombre,
              categoria: item.categoria,
              descripcion: item.descripcion,
              url: item.url,
            })),
            snapshot: serviceSnapshot,
          };

          setOrgServices((prev) => {
            const updated = [newService, ...prev];
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
            return updated;
          });

          if (authUserRef.current) {
            const coreSave = await createCoreServiceInSupabase({
              publicSlug: serviceSlug,
              nombre: defaultServiceName,
              sourceType: originPageUrl ? 'url' : 'files',
              sourceUrl: originPageUrl,
              keyPrefix: mintedKey.keyPrefix,
              keyHash: mintedKey.keyHash,
              snapshotJson: serviceSnapshot,
              items: collectedMappedItems,
            });

            if (coreSave.saved && coreSave.serviceId) {
              const savedUuid = coreSave.serviceId;
              setOrgServices((prev) => {
                const synced = prev.map((srv) =>
                  srv.id === tempServiceId ? { ...srv, id: savedUuid } : srv,
                );
                if (authUserRef.current) {
                  try {
                    window.localStorage.setItem(
                      `searchlink_services_${authUserRef.current.id}`,
                      JSON.stringify(synced),
                    );
                  } catch {
                    // Ignore storage quota errors
                  }
                }
                return synced;
              });
              if (!firstMapError) {
                setBatchNotice(t.app.coreSavedNotice);
              }
            }
          }
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

  return (
    <main
      className={`bg-white lg:bg-[#0e1013] relative min-h-dvh w-full overflow-x-hidden flex flex-row items-stretch ${
        isDesktopSplitActive ? 'lg:h-dvh lg:overflow-hidden' : ''
      }`}
    >
      {/* Mobile-only full-screen natural luminous backdrop with gentle living color movement */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 overflow-hidden lg:hidden"
        style={{
          background:
            'linear-gradient(160deg, #eef6ff 0%, #f8fbff 42%, #ffffff 70%, #f2fbf6 100%)',
        }}
      >
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [-18, 28, -10, -18],
                  y: [-12, 22, 10, -12],
                  scale: [1, 1.08, 0.96, 1],
                }
          }
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-24 -left-20 w-[92vw] h-[46vh] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(59, 130, 246, 0.28) 0%, rgba(96, 165, 250, 0.14) 55%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [20, -24, 14, 20],
                  y: [10, -16, 20, 10],
                  scale: [1.02, 0.95, 1.07, 1.02],
                }
          }
          transition={{
            duration: 21,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-16 -right-24 w-[88vw] h-[44vh] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(234, 67, 53, 0.20) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [-16, 22, -20, -16],
                  y: [18, -20, 8, 18],
                  scale: [0.98, 1.07, 1, 0.98],
                }
          }
          transition={{
            duration: 23,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[36vh] -left-20 w-[90vw] h-[44vh] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.16) 0%, rgba(59, 130, 246, 0.12) 55%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [14, -26, 12, 14],
                  y: [-14, 18, -8, -14],
                  scale: [1, 1.09, 0.97, 1],
                }
          }
          transition={{
            duration: 19,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -bottom-24 -right-16 w-[96vw] h-[48vh] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(59, 130, 246, 0.15) 52%, transparent 76%)',
          }}
        />
      </div>

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

      {/* Primary workspace column: shifts smoothly left when the 25% desktop menu docks on the right */}
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
          <div className="flex items-center gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                if (!authUser) return;
                fileInputRef.current?.click();
              }}
              disabled={isExtracting}
              aria-disabled={!authUser}
              aria-label={t.app.uploadImagesAria}
              title={authUser ? t.app.uploadImagesTitle : undefined}
              className={`${
                isDesktopSplitActive ? 'h-12 w-12 lg:h-11 lg:w-11' : 'h-12 w-12'
              } shrink-0 rounded-full flex items-center justify-center bg-white/40 lg:bg-white/95 backdrop-blur-xl lg:backdrop-blur-md border border-slate-900/12 lg:border-white/85 ring-1 ring-inset ring-white/85 lg:ring-0 text-blue-600/85 lg:text-slate-600 shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 lg:focus-visible:ring-white disabled:opacity-60 disabled:cursor-not-allowed ${
                authUser
                  ? 'hover:bg-white/75 lg:hover:bg-white hover:text-blue-700 lg:hover:text-slate-900 active:scale-95 cursor-pointer'
                  : 'opacity-45 lg:opacity-55 cursor-default'
              }`}
            >
              <Upload className="w-4.5 h-4.5" aria-hidden="true" />
            </button>

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
              onSubmit={handleSubmit}
              role="search"
              aria-label={t.app.pasteUrlFormAria}
              className="flex-1 min-w-0"
            >
              <div
                className={`group flex items-center gap-2.5 lg:gap-3 ${
                  isDesktopSplitActive ? 'h-12 lg:h-11' : 'h-12'
                } w-full rounded-full px-4 lg:px-4.5 bg-white/40 lg:bg-white/95 backdrop-blur-xl lg:backdrop-blur-md border border-slate-900/12 lg:border-white/85 ring-1 ring-inset ring-white/85 lg:ring-0 shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-all duration-150 focus-within:bg-white/75 lg:focus-within:bg-white focus-within:border-blue-500/45 lg:focus-within:border-white focus-within:shadow-[0_10px_34px_-6px_rgba(37,99,235,0.2)] lg:focus-within:shadow-[0_14px_42px_-6px_rgba(0,0,0,0.48)]`}
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
                  onChange={(e) => {
                    setUrl(e.target.value);
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
              </div>
            </form>
          </div>

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
            <p
              role="status"
              className="mt-2 px-3 text-[11px] sm:text-xs font-normal leading-snug text-black lg:text-white lg:drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] text-center"
            >
              <span>{t.app.domainPromptQuestion}</span>{' '}
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
                  {t.app.domainPromptContinue}
                </button>
              </span>
            </p>
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
        </motion.div>

        {/* Desktop top-right guest sketch or interactive Google avatar */}
        <div className="hidden lg:flex lg:justify-self-end items-center justify-end">
          <GuestAvatarSketch
            variant="dark"
            expanded={authUser ? isDesktopMenuOpen : isAuthOpen}
            user={authUser}
            onClick={() => {
              if (authUser) {
                setIsDesktopMenuOpen((prev) => !prev);
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
          (isAuthOpen && !authUser) || (isDesktopMenuOpen && Boolean(authUser))
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
      />

      {/* Desktop-only animated automation examples below the home showcase; fades out once an automation flow starts */}
      <AutomationExamplesSection
        visible={!hasSearched && !isFileUploadFlow && !isExtracting}
      />

      {/* Mobile-only swipeable boxes with Stage 2–5 auto-pan + unboxed metadata / JSON below */}
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
        onOpenOrganization={() => {
          if (authUser) {
            setIsMobilePanelOpen(true);
          } else {
            openAuthFlow();
          }
        }}
      />
      </div>

      {/* Desktop-only push-docked right menu (expands 25% -> 50% rounded on account / organization views) */}
      {authUser && (
        <DesktopAccountMenu
          open={isDesktopMenuOpen}
          user={authUser}
          orgProfile={orgProfile}
          services={orgServices}
          onSaveOrgProfile={handleSaveOrgProfile}
          onRenameService={handleRenameService}
          onNewProduct={handleStartNewProduct}
          onViewServiceHistory={handleViewServiceHistory}
          onOpenServiceChat={(service) => setActiveChatServiceId(service.id)}
          onRotateServiceKey={handleRotateServiceKey}
          onToggleServiceActive={handleToggleServiceActive}
          onClose={() => setIsDesktopMenuOpen(false)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Mobile-only slim right menu + centered Google account modal + full-screen Organización & Mi tienda */}
      {authUser && (
        <MobileAccountMenu
          menuOpen={isMobileMenuOpen}
          accountModalOpen={isMobileAccountModalOpen}
          languageModalOpen={isMobileLanguageModalOpen}
          panelOpen={isMobilePanelOpen}
          user={authUser}
          orgProfile={orgProfile}
          services={orgServices}
          onSaveOrgProfile={handleSaveOrgProfile}
          onRenameService={handleRenameService}
          onNewProduct={handleStartNewProduct}
          onViewServiceHistory={handleViewServiceHistory}
          onOpenServiceChat={(service) => setActiveChatServiceId(service.id)}
          onRotateServiceKey={handleRotateServiceKey}
          onToggleServiceActive={handleToggleServiceActive}
          onCloseMenu={() => setIsMobileMenuOpen(false)}
          onOpenAccountModal={() => setIsMobileAccountModalOpen(true)}
          onCloseAccountModal={() => setIsMobileAccountModalOpen(false)}
          onOpenLanguageModal={() => setIsMobileLanguageModalOpen(true)}
          onCloseLanguageModal={() => setIsMobileLanguageModalOpen(false)}
          onOpenPanel={() => setIsMobilePanelOpen(true)}
          onClosePanel={() => setIsMobilePanelOpen(false)}
          onSignOut={handleSignOut}
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
        onClose={() => setActiveChatServiceId(null)}
      />

      {/* Auth view: independent /login full-screen on mobile, right half drawer on desktop */}
      <AuthDrawer
        open={isAuthOpen && !authUser}
        onClose={closeAuthFlow}
      />
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
