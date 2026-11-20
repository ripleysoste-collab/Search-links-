import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bot,
  Camera,
  Check,
  Copy,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Store,
  X,
} from 'lucide-react';
import type { CatalogImageItem } from '../data/catalogSamples';
import {
  compressAndUploadOrgLogo,
  type MappedImageMetadata,
} from '../lib/imageCompression';
import {
  buildCoreCurlSnippet,
  isRawCoreApiKey,
  testCoreServiceEndpoint,
  type CoreEndpointTestResult,
} from '../lib/searchLinkCore';
import { useI18n } from '../lib/i18n';
import type {
  CompressedImageMeta,
  ImageCompressionStatus,
  ImageMapStatus,
  ImageReceiveStatus,
  ImageUploadStatus,
} from './MobileCatalogCarousel';

export interface OrganizationProfile {
  name: string;
  logoUrl: string | null;
  logoR2Key?: string | null;
  hasCompletedSetup: boolean;
}

export interface OrganizationServiceProduct {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
}

export interface OrganizationServiceSnapshot {
  images: CatalogImageItem[];
  compressionStatuses: Record<string, ImageCompressionStatus>;
  uploadStatuses: Record<string, ImageUploadStatus>;
  receiveStatuses: Record<string, ImageReceiveStatus>;
  mapStatuses: Record<string, ImageMapStatus>;
  mappedResults: Record<string, MappedImageMetadata>;
  compressionResults: Record<string, CompressedImageMeta>;
}

export interface OrganizationServiceItem {
  id: string;
  slug?: string;
  name: string;
  apiKey: string;
  keyPrefix?: string;
  endpointUrl: string;
  isActive?: boolean;
  requestsCount?: number;
  itemCount: number;
  createdAt: string;
  products?: OrganizationServiceProduct[];
  snapshot?: OrganizationServiceSnapshot;
}

interface DesktopOrganizationViewProps {
  orgProfile: OrganizationProfile;
  googlePhotoUrl: string | null;
  googleInitialLetter: string;
  services: OrganizationServiceItem[];
  onSaveOrgProfile: (next: OrganizationProfile) => void;
  onRenameService: (serviceId: string, nextName: string) => void;
  onNewProduct: () => void;
  onOpenStore: (service: OrganizationServiceItem) => void;
  onViewServiceHistory: (service: OrganizationServiceItem) => void;
  onOpenServiceChat?: (service: OrganizationServiceItem) => void;
  onRotateServiceKey?: (serviceId: string) => Promise<string | null>;
  onToggleServiceActive?: (serviceId: string, nextActive: boolean) => Promise<void>;
}

type OnboardingStage = 'welcome' | 'congrats';

interface CredentialModalState {
  serviceId: string;
  kind: 'api' | 'endpoint';
}

export function DesktopOrganizationView({
  orgProfile,
  googlePhotoUrl,
  googleInitialLetter,
  services,
  onSaveOrgProfile,
  onRenameService,
  onNewProduct,
  onOpenStore,
  onViewServiceHistory,
  onOpenServiceChat,
  onRotateServiceKey,
  onToggleServiceActive,
}: DesktopOrganizationViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dashboardLogoInputRef = useRef<HTMLInputElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);

  // First-time onboarding state
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('welcome');
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | null>(null);
  const [draftLogoR2Key, setDraftLogoR2Key] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Dashboard inline rename & modal state
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState(orgProfile.name);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceNameInput, setServiceNameInput] = useState('');
  const [credentialBox, setCredentialBox] = useState<CredentialModalState | null>(null);
  const [copiedCredential, setCopiedCredential] = useState<'main' | 'curl' | false>(
    false,
  );
  const [rotatingKey, setRotatingKey] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [manualTestKey, setManualTestKey] = useState('');
  const [endpointTestResult, setEndpointTestResult] =
    useState<CoreEndpointTestResult | null>(null);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);

  useEffect(() => {
    setOrgNameInput(orgProfile.name);
  }, [orgProfile.name]);

  useEffect(() => {
    setLogoImgFailed(false);
  }, [orgProfile.logoUrl, draftLogoUrl, googlePhotoUrl]);

  useEffect(() => {
    if (!storePickerOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        storeMenuRef.current &&
        !storeMenuRef.current.contains(event.target as Node)
      ) {
        setStorePickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [storePickerOpen]);

  const handleOnboardingLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isUploadingLogo) return;
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const uploaded = await compressAndUploadOrgLogo(file);
      setDraftLogoUrl(uploaded.url);
      setDraftLogoR2Key(uploaded.key);
    } catch (err) {
      setLogoUploadError(
        err instanceof Error ? err.message : t.org.logoUploadError,
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDashboardLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isUploadingLogo) return;
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const uploaded = await compressAndUploadOrgLogo(file);
      onSaveOrgProfile({
        ...orgProfile,
        logoUrl: uploaded.url,
        logoR2Key: uploaded.key,
      });
    } catch (err) {
      setLogoUploadError(
        err instanceof Error ? err.message : t.org.logoUploadError,
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const hasTypedName = draftName.trim().length > 0;
  const hasUploadedLogo = Boolean(draftLogoUrl);
  const canProceedFromOnboarding = hasUploadedLogo || hasTypedName;

  const handleSkipOnboarding = () => {
    onSaveOrgProfile({
      name: 'Sin nombre',
      logoUrl: googlePhotoUrl,
      logoR2Key: null,
      hasCompletedSetup: true,
    });
  };

  const handleFinishCongrats = () => {
    onSaveOrgProfile({
      name: draftName.trim() || 'Sin nombre',
      logoUrl: draftLogoUrl ?? googlePhotoUrl,
      logoR2Key: draftLogoUrl ? draftLogoR2Key : null,
      hasCompletedSetup: true,
    });
  };

  const handleSaveOrgRename = () => {
    const cleaned = orgNameInput.trim() || 'Sin nombre';
    onSaveOrgProfile({
      ...orgProfile,
      name: cleaned,
    });
    setEditingOrgName(false);
  };

  const handleSaveServiceRename = (serviceId: string) => {
    const cleaned = serviceNameInput.trim();
    if (cleaned) {
      onRenameService(serviceId, cleaned);
    }
    setEditingServiceId(null);
  };

  const handleCopyCredential = async (
    text: string,
    target: 'main' | 'curl' = 'main',
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredential(target);
      window.setTimeout(() => setCopiedCredential(false), 1600);
    } catch {
      setCopiedCredential(false);
    }
  };

  const openCredentialBox = (
    service: OrganizationServiceItem,
    kind: 'api' | 'endpoint',
  ) => {
    setCopiedCredential(false);
    setEndpointTestResult(null);
    setManualTestKey(isRawCoreApiKey(service.apiKey) ? service.apiKey : '');
    setCredentialBox({ serviceId: service.id, kind });
  };

  const activeCredentialService = credentialBox
    ? services.find((s) => s.id === credentialBox.serviceId) ?? null
    : null;

  // 1. First-time Onboarding View
  if (!orgProfile.hasCompletedSetup) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-7 flex flex-col justify-between">
        <AnimatePresence mode="wait" initial={false}>
          {onboardingStage === 'welcome' ? (
            <motion.div
              key="org-onboarding-welcome"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              {/* Centered welcome banner + top-left setup row + pointing arrow */}
              <div className="space-y-7">
                <div className="text-center pt-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    {t.org.welcomeTitle}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {t.org.welcomeSubtitle}
                  </p>
                </div>

                {/* Top-left logo circle + inline company name input */}
                <div className="pt-2">
                  <motion.div
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      delay: 0.08,
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex items-center gap-3.5"
                  >
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleOnboardingLogoChange}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      aria-label={t.org.uploadLogoAria}
                      title={t.org.uploadLogoTitle}
                      className="group relative w-14 h-14 rounded-full border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    >
                      {isUploadingLogo ? (
                        <Loader2
                          className="w-5 h-5 text-blue-600 animate-spin"
                          aria-hidden="true"
                        />
                      ) : draftLogoUrl ? (
                        <>
                          <img
                            src={draftLogoUrl}
                            alt={t.org.uploadLogoTitle}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Camera className="w-4 h-4" aria-hidden="true" />
                          </span>
                        </>
                      ) : (
                        <Plus
                          className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors"
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder={t.org.companyPlaceholder}
                        aria-label={t.org.companyPlaceholder}
                        maxLength={60}
                        className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500/70 focus:outline-none transition-colors"
                      />
                    </div>
                  </motion.div>

                  {/* Curved arrow pointing up toward logo & name + helper message */}
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16, duration: 0.3 }}
                    className="mt-3 pl-5 flex items-start gap-2.5 text-slate-500"
                  >
                    <svg
                      viewBox="0 0 36 32"
                      fill="none"
                      aria-hidden="true"
                      className="w-7 h-6 text-blue-600 shrink-0 -mt-0.5"
                    >
                      <path
                        d="M32 27C20 26 11 19 8 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3.5 11.5L7.8 5.2L13.2 10.1"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed pt-1">
                      {t.org.helperArrowPrompt}
                    </p>
                  </motion.div>
                  {logoUploadError && (
                    <p
                      role="alert"
                      className="mt-2 text-xs font-medium text-rose-600"
                    >
                      {logoUploadError}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom buttons: blue small rounded Omitir + Siguiente appearing once logo or name is added */}
              <div className="pt-4 border-t border-slate-200/75 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleSkipOnboarding}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  {t.common.skip}
                </button>

                <AnimatePresence>
                  {canProceedFromOnboarding && (
                    <motion.button
                      key="onboarding-next-btn"
                      type="button"
                      onClick={() => setOnboardingStage('congrats')}
                      initial={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, x: 6 }
                      }
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                      }
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    >
                      {t.common.nextBtn}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="org-onboarding-congrats"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center px-3 space-y-5">
                <div className="text-3xl" aria-hidden="true">
                  🎉
                </div>

                <div className="space-y-2 max-w-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    {t.org.congratsTitle}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {hasUploadedLogo && hasTypedName
                      ? t.org.congratsBoth
                      : hasUploadedLogo
                        ? t.org.congratsLogoOnly
                        : t.org.congratsNameOnly}
                  </p>
                </div>

                {/* Live summary preview */}
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-slate-200/85 bg-slate-50/80">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                    {draftLogoUrl || (googlePhotoUrl && !logoImgFailed) ? (
                      <img
                        src={draftLogoUrl || googlePhotoUrl || ''}
                        alt={t.org.uploadLogoTitle}
                        referrerPolicy="no-referrer"
                        onError={() => setLogoImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-slate-800">
                        {googleInitialLetter}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {draftName.trim() || t.org.unnamed}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/75 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOnboardingStage('welcome')}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  onClick={handleFinishCongrats}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  {t.common.continueBtn}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2. Active Organization Dashboard
  const activeLogoSrc = orgProfile.logoUrl || googlePhotoUrl;

  return (
    <div className="relative flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-6">
      {/* Top Organization Header: Left = Logo circle + Business name | Right = Store icon */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200/75">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <input
            ref={dashboardLogoInputRef}
            type="file"
            accept="image/*"
            onChange={handleDashboardLogoChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            disabled={isUploadingLogo}
            onClick={() => dashboardLogoInputRef.current?.click()}
            aria-label={t.org.changeLogoAria}
            title={t.org.changeLogoTitle}
            className="group relative w-11 h-11 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {activeLogoSrc && !logoImgFailed ? (
              <img
                src={activeLogoSrc}
                alt={orgProfile.name === 'Sin nombre' ? t.org.unnamed : orgProfile.name}
                referrerPolicy="no-referrer"
                onError={() => setLogoImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-slate-800">
                {googleInitialLetter}
              </span>
            )}
            {isUploadingLogo ? (
              <span className="absolute inset-0 bg-slate-950/45 flex items-center justify-center text-white">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              </span>
            ) : (
              <span className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            {editingOrgName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveOrgRename();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={orgNameInput}
                  onChange={(e) => setOrgNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOrgNameInput(orgProfile.name);
                      setEditingOrgName(false);
                    }
                  }}
                  autoFocus
                  maxLength={60}
                  placeholder={t.org.orgNamePlaceholder}
                  className="w-full max-w-[230px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label={t.org.saveOrgNameAria}
                  className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h2
                  className={`text-[15px] font-semibold tracking-tight truncate ${
                    orgProfile.name === 'Sin nombre'
                      ? 'text-slate-500'
                      : 'text-slate-950'
                  }`}
                >
                  {orgProfile.name === 'Sin nombre' ? t.org.unnamed : orgProfile.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setOrgNameInput(
                      orgProfile.name === 'Sin nombre' ? '' : orgProfile.name,
                    );
                    setEditingOrgName(true);
                  }}
                  aria-label={t.org.renameOrgAria}
                  title={t.org.renameOrgTitle}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Store icon at top-right corner + compact service selector popover */}
        <div ref={storeMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setStorePickerOpen((prev) => !prev)}
            aria-expanded={storePickerOpen}
            aria-haspopup="menu"
            aria-label={t.org.openStoreServicesAria}
            title={t.org.viewStoreTitle}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              storePickerOpen
                ? 'border-slate-300 bg-slate-100 text-slate-950'
                : 'border-slate-200/85 bg-slate-50/75 text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Store className="w-4 h-4" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {storePickerOpen && (
              <motion.div
                role="menu"
                aria-label={t.org.pickStoreAria}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: -4 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: -4 }
                }
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200/95 bg-white shadow-[0_18px_44px_-12px_rgba(15,23,42,0.24)] p-1.5 z-30"
              >
                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-slate-400">
                  {t.org.viewStoreOf}
                </p>

                {services.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-slate-500">
                    {t.org.noServicesAvailable}
                  </p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {services.map((service) => (
                      <li key={`store-pick-${service.id}`}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setStorePickerOpen(false);
                            onOpenStore(service);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {service.name}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums shrink-0">
                            {service.itemCount}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {logoUploadError && (
        <p
          role="alert"
          className="-mt-3 text-xs font-medium text-rose-600"
        >
          {logoUploadError}
        </p>
      )}

      {/* Mis servicios header + Nuevo producto CTA */}
      <div className="flex flex-col gap-3.5 flex-1 min-h-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold tracking-tight text-slate-900">
            {t.org.myServices}
          </h3>

          <button
            type="button"
            onClick={onNewProduct}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {t.org.newProduct}
          </button>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-5 py-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">
              {t.org.noServicesTitleDesktop}
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {t.org.noServicesDescDesktop}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {services.map((service) => {
              const isEditingThis = editingServiceId === service.id;

              return (
                <li
                  key={service.id}
                  className="rounded-2xl border border-slate-200/85 bg-slate-50/70 p-4 space-y-3"
                >
                  {/* Service name + rename icon */}
                  <div className="flex items-center justify-between gap-2">
                    {isEditingThis ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveServiceRename(service.id);
                        }}
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                      >
                        <input
                          type="text"
                          value={serviceNameInput}
                          onChange={(e) => setServiceNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingServiceId(null);
                            }
                          }}
                          autoFocus
                          maxLength={70}
                          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label={t.org.saveServiceNameAria}
                          className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm font-semibold text-slate-950 truncate">
                          {service.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setServiceNameInput(service.name);
                            setEditingServiceId(service.id);
                          }}
                          aria-label={t.org.renameServiceAria(service.name)}
                          title={t.org.renameServiceTitle}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                      {t.org.productCount(service.itemCount)}
                    </span>
                  </div>

                  {/* Bottom row: Left = API & Endpoint dot links | Bottom-right = small red history icon */}
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-1.5 pl-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => openCredentialBox(service, 'api')}
                        className="flex items-center gap-2.5 text-left text-xs font-medium text-slate-600 hover:text-slate-950 transition-colors cursor-pointer py-0.5"
                      >
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"
                        />
                        <span>{t.org.serviceApiLink}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openCredentialBox(service, 'endpoint')}
                        className="flex items-center gap-2.5 text-left text-xs font-medium text-slate-600 hover:text-slate-950 transition-colors cursor-pointer py-0.5"
                      >
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"
                        />
                        <span>{t.org.serviceEndpointLink}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onOpenServiceChat && (
                        <button
                          type="button"
                          onClick={() => onOpenServiceChat(service)}
                          aria-label={t.org.testChatAria(service.name)}
                          title={t.org.testChatTitle}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                        >
                          <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewServiceHistory(service)}
                        aria-label={t.org.viewHistoryAria(service.name)}
                        title={t.org.viewHistoryTitle}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                      >
                        <History className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Inline Search Link Core credential & live endpoint tester dialog */}
      <AnimatePresence>
        {credentialBox && activeCredentialService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
            onClick={() => setCredentialBox(null)}
            className="absolute inset-0 z-20 bg-slate-950/15 backdrop-blur-[1px] flex items-center justify-center p-6"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={
                credentialBox.kind === 'api'
                  ? t.org.serviceApiLink
                  : t.org.serviceEndpointLink
              }
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 8 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 6 }
              }
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-slate-200/95 bg-white p-4 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.28)] space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-950">
                      {credentialBox.kind === 'api'
                        ? t.org.serviceApiLink
                        : t.org.serviceEndpointLink}
                    </p>
                    <span className="text-[10px] font-medium text-slate-400">
                      Search Link Core
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {activeCredentialService.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCredentialBox(null)}
                  aria-label={t.org.closeBoxAria}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Value box */}
              {(() => {
                const rawApiKeyAvailable = isRawCoreApiKey(
                  activeCredentialService.apiKey,
                );
                const mainValue =
                  credentialBox.kind === 'api'
                    ? rawApiKeyAvailable
                      ? activeCredentialService.apiKey
                      : activeCredentialService.keyPrefix ||
                        activeCredentialService.apiKey
                    : activeCredentialService.endpointUrl;
                const canCopyMain =
                  credentialBox.kind === 'endpoint' || rawApiKeyAvailable;
                const serviceIsActive = activeCredentialService.isActive !== false;

                return (
                  <>
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/85 bg-slate-50/80 px-3 py-2.5">
                      <span className="font-mono text-xs font-medium text-slate-800 truncate">
                        {mainValue}
                      </span>

                      {canCopyMain && (
                        <button
                          type="button"
                          onClick={() => void handleCopyCredential(mainValue, 'main')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-[11px] font-semibold text-slate-700 hover:text-slate-950 hover:border-slate-300 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedCredential === 'main' ? (
                            <>
                              <Check
                                className="w-3 h-3 text-emerald-600 stroke-[2.75]"
                                aria-hidden="true"
                              />
                              {t.common.copied}
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" aria-hidden="true" />
                              {t.common.copy}
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {credentialBox.kind === 'api' ? (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {rawApiKeyAvailable
                            ? t.org.apiHintRaw
                            : t.org.apiHintPrefixDesktop}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          {onToggleServiceActive ? (
                            <button
                              type="button"
                              disabled={togglingStatus}
                              onClick={async () => {
                                setTogglingStatus(true);
                                try {
                                  await onToggleServiceActive(
                                    activeCredentialService.id,
                                    !serviceIsActive,
                                  );
                                } finally {
                                  setTogglingStatus(false);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/90 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <span
                                aria-hidden="true"
                                className={`w-1.5 h-1.5 rounded-full ${
                                  serviceIsActive ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              <span>
                                {serviceIsActive
                                  ? t.org.serviceActiveDesktop
                                  : t.org.servicePausedDesktop}
                              </span>
                            </button>
                          ) : (
                            <span />
                          )}

                          {onRotateServiceKey && (
                            <button
                              type="button"
                              disabled={rotatingKey}
                              onClick={async () => {
                                setRotatingKey(true);
                                try {
                                  const newKey = await onRotateServiceKey(
                                    activeCredentialService.id,
                                  );
                                  if (newKey) {
                                    setManualTestKey(newKey);
                                  }
                                } finally {
                                  setRotatingKey(false);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${rotatingKey ? 'animate-spin' : ''}`}
                                aria-hidden="true"
                              />
                              <span>{t.org.regenerateKeyDesktop}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {!rawApiKeyAvailable && (
                          <input
                            type="text"
                            value={manualTestKey}
                            onChange={(e) => setManualTestKey(e.target.value)}
                            placeholder={t.org.pasteKeyPlaceholder}
                            className="w-full rounded-lg border border-slate-200/90 bg-slate-50/70 px-2.5 py-1.5 font-mono text-[11px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none"
                          />
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyCredential(
                                buildCoreCurlSnippet(
                                  activeCredentialService.endpointUrl,
                                  manualTestKey || activeCredentialService.apiKey,
                                ),
                                'curl',
                              )
                            }
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            {copiedCredential === 'curl'
                              ? t.org.curlCopied
                              : t.org.copyCurlDesktop}
                          </button>

                          <button
                            type="button"
                            disabled={
                              testingEndpoint ||
                              !(manualTestKey.trim() || rawApiKeyAvailable)
                            }
                            onClick={async () => {
                              const keyToUse =
                                manualTestKey.trim() ||
                                (rawApiKeyAvailable
                                  ? activeCredentialService.apiKey
                                  : '');
                              if (!keyToUse) return;
                              setTestingEndpoint(true);
                              try {
                                const res = await testCoreServiceEndpoint(
                                  activeCredentialService.endpointUrl,
                                  keyToUse,
                                );
                                setEndpointTestResult(res);
                              } finally {
                                setTestingEndpoint(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-45"
                          >
                            {testingEndpoint ? (
                              <Loader2
                                className="w-3 h-3 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Play className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>{t.org.testLive}</span>
                          </button>
                        </div>

                        {endpointTestResult && (
                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[10.5px] font-medium">
                              <span
                                className={
                                  endpointTestResult.ok
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }
                              >
                                HTTP {endpointTestResult.status || 'ERR'}
                              </span>
                              <span className="text-slate-400 tabular-nums">
                                {endpointTestResult.latencyMs} ms
                              </span>
                            </div>
                            <pre className="max-h-36 overflow-auto font-mono text-[10.5px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all">
                              {endpointTestResult.rawJson}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
