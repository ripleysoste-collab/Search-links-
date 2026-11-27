import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Camera,
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Store,
} from 'lucide-react';
import { compressAndUploadOrgLogo } from '../lib/imageCompression';
import { useI18n } from '../lib/i18n';
import type {
  OrganizationProfile,
  OrganizationServiceItem,
} from './DesktopOrganizationView';

interface MobileOrganizationViewProps {
  orgProfile: OrganizationProfile;
  googlePhotoUrl: string | null;
  googleInitialLetter: string;
  services: OrganizationServiceItem[];
  onSaveOrgProfile: (next: OrganizationProfile) => void;
  onRenameService: (serviceId: string, nextName: string) => void;
  onNewProduct: () => void;
  onOpenStore: (service: OrganizationServiceItem) => void;
  onOpenApiKey: (service: OrganizationServiceItem) => void;
  onOpenEndpointTest: (service: OrganizationServiceItem) => void;
  onViewServiceHistory: (service: OrganizationServiceItem) => void;
  onOpenSchema: (service: OrganizationServiceItem) => void;
  onOpenServiceChat?: (service: OrganizationServiceItem) => void;
}

type OnboardingStage = 'welcome' | 'congrats';

export function MobileOrganizationView({
  orgProfile,
  googlePhotoUrl,
  googleInitialLetter,
  services,
  onSaveOrgProfile,
  onRenameService,
  onNewProduct,
  onOpenStore,
  onOpenApiKey,
  onOpenEndpointTest,
  onViewServiceHistory,
  onOpenSchema,
  onOpenServiceChat,
}: MobileOrganizationViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dashboardLogoInputRef = useRef<HTMLInputElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);

  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('welcome');
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | null>(null);
  const [draftLogoR2Key, setDraftLogoR2Key] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState(orgProfile.name);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceNameInput, setServiceNameInput] = useState('');
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [openActionMenuServiceId, setOpenActionMenuServiceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setOrgNameInput(orgProfile.name);
  }, [orgProfile.name]);

  useEffect(() => {
    setLogoImgFailed(false);
  }, [orgProfile.logoUrl, draftLogoUrl, googlePhotoUrl]);

  useEffect(() => {
    if (!storePickerOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (
        storeMenuRef.current &&
        !storeMenuRef.current.contains(event.target as Node)
      ) {
        setStorePickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, [storePickerOpen]);

  useEffect(() => {
    if (!openActionMenuServiceId) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-mobile-service-action-menu]')) {
        setOpenActionMenuServiceId(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, [openActionMenuServiceId]);

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
  const canProceed = hasUploadedLogo || hasTypedName;

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

  // 1. Mobile First-time Onboarding (clean, compact, breathable)
  if (!orgProfile.hasCompletedSetup) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col justify-between">
        <AnimatePresence mode="wait" initial={false}>
          {onboardingStage === 'welcome' ? (
            <motion.div
              key="mobile-org-welcome"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-5"
            >
              <div className="space-y-6">
                <div className="text-center pt-1">
                  <h2 className="text-[16px] font-semibold tracking-tight text-slate-950">
                    {t.org.welcomeTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t.org.welcomeSubtitle}</p>
                </div>

                <div>
                  <div className="flex items-center gap-3">
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
                      className="group relative w-11 h-11 rounded-full border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-wait"
                    >
                      {isUploadingLogo ? (
                        <Loader2
                          className="w-4 h-4 text-blue-600 animate-spin"
                          aria-hidden="true"
                        />
                      ) : draftLogoUrl ? (
                        <>
                          <img
                            src={draftLogoUrl}
                            alt={t.org.uploadLogoTitle}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        </>
                      ) : (
                        <Plus className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      )}
                    </button>

                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder={t.org.companyPlaceholder}
                      aria-label={t.org.companyPlaceholder}
                      maxLength={60}
                      className="flex-1 min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/75 px-3 py-2 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500/70 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Curved pointer arrow + prompt */}
                  <div className="mt-2.5 pl-4 flex items-start gap-2 text-slate-500">
                    <svg
                      viewBox="0 0 36 32"
                      fill="none"
                      aria-hidden="true"
                      className="w-6 h-5 text-blue-600 shrink-0 -mt-0.5"
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
                    <p className="text-[11.5px] font-medium text-slate-600 leading-snug pt-0.5">
                      {t.org.helperArrowPrompt}
                    </p>
                  </div>
                  {logoUploadError && (
                    <p
                      role="alert"
                      className="mt-2 text-[11.5px] font-medium text-rose-600"
                    >
                      {logoUploadError}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-200/75 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSkipOnboarding}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t.common.skip}
                </button>

                <AnimatePresence>
                  {canProceed && (
                    <motion.button
                      key="mobile-org-continue-btn"
                      type="button"
                      onClick={() => setOnboardingStage('congrats')}
                      initial={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                      }
                      transition={{ duration: 0.16 }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {t.common.continueBtn}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mobile-org-congrats"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-5"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 space-y-4">
                <div className="text-2xl" aria-hidden="true">
                  🎉
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <h2 className="text-[16px] font-semibold text-slate-950">
                    {t.org.congratsTitle}
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {t.org.congratsMobileFallback}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-slate-200/85 bg-slate-50/80">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
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
                  <span className="text-xs font-semibold text-slate-900">
                    {draftName.trim() || t.org.unnamed}
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-200/75 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOnboardingStage('welcome')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  onClick={handleFinishCongrats}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
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

  // 2. Active Mobile Organization Dashboard (smaller, airy, uncrowded)
  const activeLogoSrc = orgProfile.logoUrl || googlePhotoUrl;

  return (
    <div className="relative flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
      {/* Compact Org Identity Header + Store Icon */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200/75">
        <div className="flex items-center gap-3 min-w-0 flex-1">
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
            className="group relative w-10 h-10 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-wait"
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
              <span className="text-xs font-semibold text-slate-800">
                {googleInitialLetter}
              </span>
            )}
            {isUploadingLogo ? (
              <span className="absolute inset-0 bg-slate-950/45 flex items-center justify-center text-white">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              </span>
            ) : (
              <span className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-3 h-3" aria-hidden="true" />
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
                  autoFocus
                  maxLength={60}
                  placeholder={t.org.orgNameShortPlaceholder}
                  className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label={t.org.saveOrgNameAria}
                  className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Check className="w-3 h-3" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[13.5px] font-semibold truncate ${
                    orgProfile.name === 'Sin nombre'
                      ? 'text-slate-500'
                      : 'text-slate-950'
                  }`}
                >
                  {orgProfile.name === 'Sin nombre' ? t.org.unnamed : orgProfile.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOrgNameInput(
                      orgProfile.name === 'Sin nombre' ? '' : orgProfile.name,
                    );
                    setEditingOrgName(true);
                  }}
                  aria-label={t.org.renameOrgAria}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Store icon top-right + selector */}
        <div ref={storeMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setStorePickerOpen((prev) => !prev)}
            aria-expanded={storePickerOpen}
            aria-label={t.org.openStoreAria}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              storePickerOpen
                ? 'border-slate-300 bg-slate-100 text-slate-950'
                : 'border-slate-200/85 bg-slate-50/75 text-slate-600'
            }`}
          >
            <Store className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {storePickerOpen && (
              <motion.div
                role="menu"
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
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200/95 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.24)] p-1.5 z-30"
              >
                <p className="px-2.5 pt-1 pb-1 text-[10.5px] font-medium text-slate-400">
                  {t.org.viewStoreOf}
                </p>
                {services.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11.5px] text-slate-500">
                    {t.org.noServicesAvailable}
                  </p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {services.map((service) => (
                      <li key={`mob-store-pick-${service.id}`}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setStorePickerOpen(false);
                            onOpenStore(service);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left active:bg-slate-50 cursor-pointer"
                        >
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {service.name}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
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
          className="-mt-2.5 text-[11.5px] font-medium text-rose-600"
        >
          {logoUploadError}
        </p>
      )}

      {/* Mis servicios header + Nuevo producto CTA */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-tight text-slate-900">
            {t.org.myServices}
          </h3>

          <button
            type="button"
            onClick={onNewProduct}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
            {t.org.newProduct}
          </button>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/55 px-4 py-6 text-center space-y-1.5">
            <p className="text-xs font-medium text-slate-800">
              {t.org.noServicesTitleMobile}
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {t.org.noServicesDescMobile}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5 pb-24">
            {services.map((service, idx) => {
              const isEditingThis = editingServiceId === service.id;
              const openMenuDownward = idx === 0;

              return (
                <li
                  key={`mob-srv-${service.id}`}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2"
                >
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
                          autoFocus
                          maxLength={70}
                          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label={t.org.saveServiceNameAria}
                          className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Check className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[13.5px] font-semibold text-slate-950 truncate">
                          {service.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setServiceNameInput(service.name);
                            setEditingServiceId(service.id);
                          }}
                          aria-label={t.org.renameServiceAria(service.name)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 shrink-0 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom row: Left = product count | Right = three-dots menu */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                      {t.org.productCountShort(service.itemCount)}
                    </span>

                    <div data-mobile-service-action-menu className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionMenuServiceId((prev) =>
                            prev === service.id ? null : service.id,
                          )
                        }
                        aria-haspopup="menu"
                        aria-expanded={openActionMenuServiceId === service.id}
                        aria-label={t.org.moreActionsAria(service.name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          openActionMenuServiceId === service.id
                            ? 'bg-white text-slate-950 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-900 active:bg-white'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <AnimatePresence>
                        {openActionMenuServiceId === service.id && (
                          <motion.div
                            role="menu"
                            aria-label={t.org.moreActionsAria(service.name)}
                            initial={
                              shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.96, y: openMenuDownward ? -4 : 4 }
                            }
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={
                              shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.96, y: openMenuDownward ? -4 : 4 }
                            }
                            transition={{ duration: 0.14 }}
                            className={`absolute right-0 ${
                              openMenuDownward ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                            } w-44 rounded-2xl border border-slate-200/95 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.24)] p-1 z-30`}
                          >
                            <ul className="divide-y divide-slate-100">
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionMenuServiceId(null);
                                    onOpenApiKey(service);
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-800 active:bg-slate-50 cursor-pointer whitespace-nowrap"
                                >
                                  {t.org.menuViewApi}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionMenuServiceId(null);
                                    onOpenEndpointTest(service);
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-800 active:bg-slate-50 cursor-pointer whitespace-nowrap"
                                >
                                  {t.org.menuTestEndpoint}
                                </button>
                              </li>
                              {onOpenServiceChat && (
                                <li>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenActionMenuServiceId(null);
                                      onOpenServiceChat(service);
                                    }}
                                    className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-800 active:bg-slate-50 cursor-pointer whitespace-nowrap"
                                  >
                                    {t.org.menuSearchAi}
                                  </button>
                                </li>
                              )}
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionMenuServiceId(null);
                                    onViewServiceHistory(service);
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-800 active:bg-slate-50 cursor-pointer whitespace-nowrap"
                                >
                                  {t.org.menuViewProcess}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionMenuServiceId(null);
                                    onOpenSchema(service);
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-800 active:bg-slate-50 cursor-pointer whitespace-nowrap"
                                >
                                  {t.org.menuViewSchema}
                                </button>
                              </li>
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
