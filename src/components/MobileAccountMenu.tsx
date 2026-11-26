import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  FileArchive,
  Loader2,
  Mail,
  User as UserIcon,
  X,
} from 'lucide-react';
import type {
  OrganizationProfile,
  OrganizationServiceItem,
} from './DesktopOrganizationView';
import { MobileOrganizationView } from './MobileOrganizationView';
import { MobileStoreView } from './MobileStoreView';
import { ConnectServerView } from './ConnectServerView';
import { QuickServerCodeViewer } from './QuickServerCodeViewer';
import { ServerTestView } from './ServerTestView';
import { ServerSecretHelpView } from './ServerSecretHelpView';
import { ServerUpdatesView } from './ServerUpdatesView';
import { ServerSecretKeyView } from './ServerSecretKeyView';
import { AdvancedSettingsView } from './AdvancedSettingsView';
import { MobileJsonEditorModal } from './MobileJsonEditorModal';
import {
  AGENCY_SYNC_UPDATED_EVENT,
  hydrateAgencyConnectionFromCloud,
  loadAgencyConnectionState,
  type AgencyConnectionState,
} from '../lib/agencySyncClient';
import {
  buildQuickServerFiles,
  downloadQuickServerZip,
} from '../lib/quickServerTemplate';
import {
  buildSchemaInputFromService,
  buildServiceOpenApiSchemaJson,
  downloadServiceSchemaZip,
} from '../lib/schemaExport';
import {
  formatCreationDate,
  LANGUAGE_OPTIONS,
  useI18n,
  type SupportedLocale,
} from '../lib/i18n';

interface MobileAccountMenuProps {
  menuOpen: boolean;
  accountModalOpen: boolean;
  languageModalOpen: boolean;
  connectServerModalOpen: boolean;
  advancedSettingsModalOpen: boolean;
  panelOpen: boolean;
  panelSubView: 'organization' | 'store';
  selectedStoreServiceId: string | null;
  selectedSchemaServiceId: string | null;
  user: User;
  orgProfile: OrganizationProfile;
  services: OrganizationServiceItem[];
  onSaveOrgProfile: (next: OrganizationProfile) => void;
  onRenameService: (serviceId: string, nextName: string) => void;
  onNewProduct: () => void;
  onViewServiceHistory: (service: OrganizationServiceItem) => void;
  onOpenServiceChat?: (service: OrganizationServiceItem) => void;
  onRotateServiceKey?: (serviceId: string) => Promise<string | null>;
  onToggleServiceActive?: (serviceId: string, nextActive: boolean) => Promise<void>;
  onCloseMenu: () => void;
  onOpenAccountModal: () => void;
  onCloseAccountModal: () => void;
  onOpenLanguageModal: () => void;
  onCloseLanguageModal: () => void;
  onOpenConnectServerModal: () => void;
  onCloseConnectServerModal: () => void;
  onOpenAdvancedSettingsModal: () => void;
  onCloseAdvancedSettingsModal: () => void;
  onBackToAccountFromAdvancedSettings: () => void;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  onOpenStore: (service: OrganizationServiceItem) => void;
  onBackToOrganization: () => void;
  onOpenSchema: (service: OrganizationServiceItem) => void;
  onCloseSchema: () => void;
  onOpenDocumentation: (
    docId:
      | 'privacy'
      | 'terms'
      | 'content'
      | 'cookies'
      | 'agency'
      | 'agency-guide'
      | 'agency-liability'
      | 'liability',
  ) => void;
  onSignOut: () => Promise<void>;
  onPurgeAllR2: () => Promise<{ deletedR2Count: number }>;
  onClearBrowserData: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onPauseAllApis: () => Promise<{ pausedServicesCount: number }>;
  onUnfreezeAllApis: () => Promise<{ unfrozenServicesCount: number }>;
  hasR2Images: boolean;
  hasActiveApis: boolean;
  hasPausedApis: boolean;
}

function getUserDisplayInfo(
  user: User,
  userFallback: string,
  locale: SupportedLocale,
  dateUnavailable: string,
) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    user.email?.split('@')[0] ||
    userFallback;
  const photoUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    null;

  return {
    fullName,
    email: user.email || '',
    photoUrl,
    createdAtFormatted: formatCreationDate(user.created_at, locale, dateUnavailable),
    initialLetter: fullName.trim().charAt(0).toUpperCase() || 'U',
  };
}

export function MobileAccountMenu({
  menuOpen,
  accountModalOpen,
  languageModalOpen,
  connectServerModalOpen,
  advancedSettingsModalOpen,
  panelOpen,
  panelSubView,
  selectedStoreServiceId,
  selectedSchemaServiceId,
  user,
  orgProfile,
  services,
  onSaveOrgProfile,
  onRenameService,
  onNewProduct,
  onViewServiceHistory,
  onOpenServiceChat,
  onRotateServiceKey,
  onToggleServiceActive,
  onCloseMenu,
  onOpenAccountModal,
  onCloseAccountModal,
  onOpenLanguageModal,
  onCloseLanguageModal,
  onOpenConnectServerModal,
  onCloseConnectServerModal,
  onOpenAdvancedSettingsModal,
  onCloseAdvancedSettingsModal,
  onBackToAccountFromAdvancedSettings,
  onOpenPanel,
  onClosePanel,
  onOpenStore,
  onBackToOrganization,
  onOpenSchema,
  onCloseSchema,
  onOpenDocumentation,
  onSignOut,
  onPurgeAllR2,
  onClearBrowserData,
  onDeleteAccount,
  onPauseAllApis,
  onUnfreezeAllApis,
  hasR2Images,
  hasActiveApis,
  hasPausedApis,
}: MobileAccountMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const { locale, source, countryCode, setManualLocale, t } = useI18n();
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [serverConnState, setServerConnState] = useState<AgencyConnectionState>(() =>
    loadAgencyConnectionState(user.id),
  );
  const [connectServerPage, setConnectServerPage] = useState<0 | 1>(0);
  const [quickServerFileId, setQuickServerFileId] = useState('server');
  const [quickServerCopied, setQuickServerCopied] = useState(false);
  const [mobileTestOpen, setMobileTestOpen] = useState(false);
  const [mobileSecretHelpOpen, setMobileSecretHelpOpen] = useState(false);
  const [mobileUpdatesOpen, setMobileUpdatesOpen] = useState(false);
  const [mobileSecretKeyOpen, setMobileSecretKeyOpen] = useState(false);
  const swipeTouchRef = useRef<{
    startX: number;
    startY: number;
    lockedAxis: 'x' | 'y' | null;
    blocked: boolean;
  } | null>(null);

  const isServerConnected = serverConnState.autoSyncEnabled;

  const info = getUserDisplayInfo(
    user,
    t.common.userFallback,
    locale,
    t.menu.dateUnavailable,
  );

  const selectedStoreService =
    services.find((srv) => srv.id === selectedStoreServiceId) ?? services[0] ?? null;

  const selectedSchemaService = useMemo(
    () =>
      selectedSchemaServiceId
        ? services.find((srv) => srv.id === selectedSchemaServiceId) ?? null
        : null,
    [selectedSchemaServiceId, services],
  );

  const activeSchemaInput = useMemo(
    () =>
      selectedSchemaService
        ? buildSchemaInputFromService(selectedSchemaService, orgProfile.name, locale)
        : null,
    [selectedSchemaService, orgProfile.name, locale],
  );

  const schemaJsonText = useMemo(
    () => (activeSchemaInput ? buildServiceOpenApiSchemaJson(activeSchemaInput) : ''),
    [activeSchemaInput],
  );

  const quickServerFiles = useMemo(
    () => buildQuickServerFiles(serverConnState.secretKey),
    [serverConnState.secretKey],
  );

  const activeQuickServerFile = useMemo(
    () =>
      quickServerFiles.find((file) => file.id === quickServerFileId) ??
      quickServerFiles[0],
    [quickServerFiles, quickServerFileId],
  );

  useEffect(() => {
    setImgFailed(false);
  }, [info.photoUrl]);

  useEffect(() => {
    setServerConnState(loadAgencyConnectionState(user.id));
    const handleSyncUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ userId?: string; state?: AgencyConnectionState }>
      ).detail;
      if (detail?.userId === user.id && detail.state) {
        setServerConnState(detail.state);
      }
    };
    window.addEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
    return () =>
      window.removeEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
  }, [user.id]);

  useEffect(() => {
    if (!connectServerModalOpen) {
      setConnectServerPage(0);
      setQuickServerCopied(false);
      setMobileTestOpen(false);
      setMobileSecretHelpOpen(false);
      setMobileUpdatesOpen(false);
      setMobileSecretKeyOpen(false);
      return;
    }
    setServerConnState(loadAgencyConnectionState(user.id));
    let active = true;
    void hydrateAgencyConnectionFromCloud(user.id).then((cloudState) => {
      if (active && cloudState) {
        setServerConnState(cloudState);
      }
    });
    return () => {
      active = false;
    };
  }, [connectServerModalOpen, user.id]);

  useEffect(() => {
    if (isServerConnected) {
      setConnectServerPage(0);
    } else {
      setMobileTestOpen(false);
    }
  }, [isServerConnected]);

  useEffect(() => {
    if (!menuOpen) {
      setDocsExpanded(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!accountModalOpen) {
      setConfirmSignOut(false);
      setSigningOut(false);
      setSignOutError(null);
    }
  }, [accountModalOpen]);

  const handleCopyQuickServerFile = async () => {
    if (!activeQuickServerFile) return;
    try {
      await navigator.clipboard.writeText(activeQuickServerFile.code);
      setQuickServerCopied(true);
      window.setTimeout(() => setQuickServerCopied(false), 1600);
    } catch {
      setQuickServerCopied(false);
    }
  };

  const handleConnectTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isServerConnected || event.touches.length !== 1) {
      swipeTouchRef.current = null;
      return;
    }
    const target = event.target as HTMLElement | null;
    const insideNoSwipe = Boolean(target?.closest('[data-no-page-swipe="true"]'));
    const codeScroller = target?.closest('[data-code-scroller="true"]') as
      | HTMLElement
      | null;
    const scrollerNotAtLeft = Boolean(
      connectServerPage === 1 && codeScroller && codeScroller.scrollLeft > 4,
    );

    swipeTouchRef.current = {
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
      lockedAxis: null,
      blocked: insideNoSwipe || scrollerNotAtLeft,
    };
  };

  const handleConnectTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const tracker = swipeTouchRef.current;
    if (!tracker || tracker.blocked || isServerConnected || event.touches.length !== 1) {
      return;
    }
    const dx = event.touches[0].clientX - tracker.startX;
    const dy = event.touches[0].clientY - tracker.startY;

    if (!tracker.lockedAxis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      tracker.lockedAxis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'x' : 'y';
    }
  };

  const handleConnectTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const tracker = swipeTouchRef.current;
    swipeTouchRef.current = null;
    if (!tracker || tracker.blocked || isServerConnected) return;
    if (tracker.lockedAxis !== 'x') return;

    const endTouch = event.changedTouches[0];
    if (!endTouch) return;
    const dx = endTouch.clientX - tracker.startX;

    if (connectServerPage === 0 && dx < -48) {
      setConnectServerPage(1);
    } else if (connectServerPage === 1 && dx > 48) {
      setConnectServerPage(0);
    }
  };

  const handleConfirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await onSignOut();
    } catch {
      setSignOutError(t.menu.signOutError);
      setSigningOut(false);
    }
  };

  return (
    <>
      {/* 1. Mobile right slide-in slim menu with dimmed backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Dimmed backdrop — tap outside to close */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
              onClick={onCloseMenu}
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            />

            {/* Slim comfortable right drawer */}
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.accountMenuAria}
              initial={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
              }
              className="absolute top-0 right-0 bottom-0 w-[62%] max-w-[248px] min-w-[208px] bg-white/96 backdrop-blur-xl border-l border-slate-200/85 shadow-[-14px_0_38px_-14px_rgba(15,23,42,0.28)] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3.5 border-b border-slate-200/75 shrink-0">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.account}
                </span>
                <button
                  type="button"
                  onClick={onCloseMenu}
                  aria-label={t.menu.closeMenuAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <nav aria-label={t.menu.accountOptionsAria} className="flex-1 overflow-y-auto px-4 py-3">
                <ul className="divide-y divide-slate-200/75">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenAccountModal();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.googleAccount}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenPanel();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.organization}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenConnectServerModal();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.connectServer}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenLanguageModal();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.language}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      aria-expanded={docsExpanded}
                      onClick={() => setDocsExpanded((prev) => !prev)}
                      className="w-full py-3 flex items-center justify-between gap-2 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      <span>{t.menu.documentation}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                          docsExpanded ? 'rotate-180 text-slate-700' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {docsExpanded && (
                        <motion.div
                          initial={
                            shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
                          }
                          animate={
                            shouldReduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }
                          }
                          exit={
                            shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
                          }
                          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <ul className="pl-2.5 pb-2.5 pt-0.5 space-y-1 border-l border-slate-200/90 ml-0.5">
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('privacy');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.privacyAndUse}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('terms');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.termsAndConditions}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('content');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.contentPolicies}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('cookies');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.cookiePolicies}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('agency');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.agencyMode}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('agency-guide');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.agencyModeGuide}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('agency-liability');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.agencyModeLiability}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  onCloseMenu();
                                  onOpenDocumentation('liability');
                                }}
                                className="w-full py-2 px-1.5 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.menu.intellectualPropertyAndLiability}
                              </button>
                            </li>
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                </ul>
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Mobile centered compact Google Account modal */}
      <AnimatePresence>
        {accountModalOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-center justify-center p-5">
            {/* Dimmed backdrop */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              onClick={() => {
                if (!signingOut) onCloseAccountModal();
              }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />

            {/* Centered compact card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.googleAccountDetailsAria}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
              }
              className="relative w-full max-w-[336px] rounded-3xl bg-white/96 backdrop-blur-xl border border-slate-200/90 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.3)] overflow-visible"
            >
              {/* Modal top bar */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-200/75">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.googleAccount}
                </span>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={onCloseAccountModal}
                  aria-label={t.menu.closeAccountModalAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Account summary + details */}
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {info.photoUrl && !imgFailed ? (
                      <img
                        src={info.photoUrl}
                        alt={info.fullName}
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-semibold text-slate-800">
                        {info.initialLetter}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-950 truncate">
                      {info.fullName}
                    </p>
                    {info.email && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {info.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 divide-y divide-slate-200/70">
                  <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                    <UserIcon
                      className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400">
                        {t.menu.usernameLabel}
                      </p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5 break-words">
                        {info.fullName}
                      </p>
                    </div>
                  </div>

                  {info.email && (
                    <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                      <Mail
                        className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-slate-400">
                          {t.menu.googleAccountLabel}
                        </p>
                        <p className="text-xs font-medium text-slate-900 mt-0.5 break-all">
                          {info.email}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                    <Calendar
                      className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400">
                        {t.menu.createdAtLabel}
                      </p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5">
                        {t.menu.accountCreatedOn(info.createdAtFormatted)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Sign Out + small confirmation dialog right above */}
              <div className="px-5 pt-3 pb-4 border-t border-slate-200/75 relative">
                <AnimatePresence>
                  {confirmSignOut && (
                    <motion.div
                      role="alertdialog"
                      aria-label={t.menu.confirmSignOutAria}
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 8, scale: 0.96 }
                      }
                      animate={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, y: 0, scale: 1 }
                      }
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 6, scale: 0.96 }
                      }
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      className="mb-3 rounded-2xl border border-slate-200/95 bg-white p-3.5 shadow-[0_14px_32px_-10px_rgba(15,23,42,0.22)]"
                    >
                      <p className="text-xs font-medium text-slate-900">
                        {t.menu.confirmSignOutTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t.menu.confirmSignOutDescMobile}
                      </p>

                      {signOutError && (
                        <p className="text-[11px] text-rose-600 mt-1.5">{signOutError}</p>
                      )}

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={signingOut}
                          onClick={() => {
                            setConfirmSignOut(false);
                            setSignOutError(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={signingOut}
                          onClick={() => void handleConfirmSignOut()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {signingOut && (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          )}
                          {t.common.accept}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmSignOut(false);
                    setSignOutError(null);
                    onOpenAdvancedSettingsModal();
                  }}
                  className="block mb-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  {t.menu.goToAdvancedSettings}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSignOutError(null);
                    setConfirmSignOut((prev) => !prev);
                  }}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  {t.menu.signOut}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Mobile full-screen Organización & Mi tienda flow */}
      <AnimatePresence>
        {panelOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={
              panelSubView === 'store' ? t.menu.myStore : t.menu.organization
            }
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-2 min-w-0">
                {panelSubView === 'store' && (
                  <button
                    type="button"
                    onClick={onBackToOrganization}
                    aria-label={t.menu.backToOrgAria}
                    className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                  {panelSubView === 'store' ? t.menu.myStore : t.menu.organization}
                </span>
              </div>

              <button
                type="button"
                onClick={onClosePanel}
                aria-label={
                  panelSubView === 'store'
                    ? t.menu.closeStoreAria
                    : t.menu.closeOrgAria
                }
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            {panelSubView === 'store' && selectedStoreService ? (
              <MobileStoreView
                service={selectedStoreService}
                organizationName={orgProfile.name}
                organizationLogoUrl={orgProfile.logoUrl || info.photoUrl}
              />
            ) : (
              <MobileOrganizationView
                orgProfile={orgProfile}
                googlePhotoUrl={info.photoUrl}
                googleInitialLetter={info.initialLetter}
                services={services}
                onSaveOrgProfile={onSaveOrgProfile}
                onRenameService={onRenameService}
                onNewProduct={onNewProduct}
                onOpenStore={onOpenStore}
                onViewServiceHistory={onViewServiceHistory}
                onOpenSchema={onOpenSchema}
                onOpenServiceChat={onOpenServiceChat}
                onRotateServiceKey={onRotateServiceKey}
                onToggleServiceActive={onToggleServiceActive}
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Mobile full-screen white Schema Viewer modal (Copy, ZIP download, X to return) */}
      <AnimatePresence>
        {panelOpen && selectedSchemaService && activeSchemaInput && (
          <MobileJsonEditorModal
            jsonText={schemaJsonText}
            ariaLabel={t.org.schemaTitle}
            copyAria={t.org.copySchemaAria}
            copyTitle={t.common.copy}
            downloadZipAria={t.org.downloadSchemaZipAria}
            downloadZipTitle={t.org.downloadSchemaZipTitle}
            closeAria={t.org.backToOrgSchemaAria}
            onDownloadZip={() => downloadServiceSchemaZip(activeSchemaInput)}
            onClose={onCloseSchema}
          />
        )}
      </AnimatePresence>

      {/* 3b. Mobile full-screen white Conecta tu servidor + swipeable Rápido y ejecutable */}
      <AnimatePresence>
        {connectServerModalOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={
              connectServerPage === 1 && !isServerConnected
                ? t.connectServer.quickServerTitle
                : t.connectServer.title
            }
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-2 min-w-0">
                {connectServerPage === 1 && !isServerConnected && (
                  <button
                    type="button"
                    onClick={() => setConnectServerPage(0)}
                    aria-label={t.connectServer.backToConnectServerAria}
                    className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                  {connectServerPage === 1 && !isServerConnected
                    ? t.connectServer.quickServerTitle
                    : t.connectServer.title}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {connectServerPage === 1 && !isServerConnected && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCopyQuickServerFile()}
                      aria-label={t.connectServer.copyQuickServerFileAria}
                      title={quickServerCopied ? t.common.copied : t.common.copy}
                      className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer"
                    >
                      {quickServerCopied ? (
                        <Check
                          className="w-4 h-4 text-emerald-600 stroke-[2.5]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadQuickServerZip(serverConnState.secretKey)
                      }
                      aria-label={t.connectServer.downloadQuickServerZipAria}
                      title={t.connectServer.downloadQuickServerZipTitle}
                      className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-100/80 transition-colors cursor-pointer"
                    >
                      <FileArchive className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={onCloseConnectServerModal}
                  aria-label={t.menu.closeConnectServerAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4.5 h-4.5" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div
              onTouchStart={handleConnectTouchStart}
              onTouchMove={handleConnectTouchMove}
              onTouchEnd={handleConnectTouchEnd}
              className="flex-1 min-h-0 overflow-hidden flex flex-col"
            >
              <motion.div
                initial={false}
                animate={{
                  x: connectServerPage === 1 && !isServerConnected ? '-50%' : '0%',
                }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                }
                className="w-[200%] flex-1 min-h-0 flex"
              >
                <div className="w-1/2 h-full min-h-0 flex flex-col shrink-0">
                  <ConnectServerView
                    userId={user.id}
                    services={services}
                    variant="mobile"
                    onOpenQuickServer={
                      isServerConnected
                        ? undefined
                        : () => setConnectServerPage(1)
                    }
                    onOpenServerTest={
                      isServerConnected
                        ? () => setMobileTestOpen(true)
                        : undefined
                    }
                    onOpenSecretHelp={() => setMobileSecretHelpOpen(true)}
                    onOpenServerUpdates={() => setMobileUpdatesOpen(true)}
                    onOpenSecretKey={() => setMobileSecretKeyOpen(true)}
                  />
                </div>

                <div className="w-1/2 h-full min-h-0 flex flex-col shrink-0 bg-white">
                  {!isServerConnected && (
                    <QuickServerCodeViewer
                      secretKey={serverConnState.secretKey}
                      variant="mobile"
                      hideHeader
                      activeFileId={quickServerFileId}
                      onSelectFileId={(fileId) => {
                        setQuickServerFileId(fileId);
                        setQuickServerCopied(false);
                      }}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3b-bis. Mobile full-screen Server Test dialog */}
      <AnimatePresence>
        {connectServerModalOpen && isServerConnected && mobileTestOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t.connectServer.testServerTitle}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[55] lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                {t.connectServer.testServerTitle}
              </span>

              <button
                type="button"
                onClick={() => setMobileTestOpen(false)}
                aria-label={t.connectServer.testCloseAria}
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            <ServerTestView
              serverUrl={serverConnState.serverUrl}
              variant="mobile"
              onClose={() => setMobileTestOpen(false)}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3b-ter. Mobile full-screen Secret Key Help Manual dialog */}
      <AnimatePresence>
        {connectServerModalOpen && mobileSecretHelpOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t.connectServer.secretHelpTitle}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[55] lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                {t.connectServer.secretHelpTitle}
              </span>

              <button
                type="button"
                onClick={() => setMobileSecretHelpOpen(false)}
                aria-label={t.connectServer.secretHelpCloseAria}
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            <ServerSecretHelpView variant="mobile" />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3b-quater. Mobile full-screen Tus actualizaciones dialog */}
      <AnimatePresence>
        {connectServerModalOpen && mobileUpdatesOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t.connectServer.updatesTitle}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[55] lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                {t.connectServer.updatesTitle}
              </span>

              <button
                type="button"
                onClick={() => setMobileUpdatesOpen(false)}
                aria-label={t.connectServer.updatesCloseAria}
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            <ServerUpdatesView userId={user.id} variant="mobile" />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3b-quinquies. Mobile full-screen Tu clave secreta dialog */}
      <AnimatePresence>
        {connectServerModalOpen && mobileSecretKeyOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t.connectServer.secretKeyViewTitle}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[55] lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                {t.connectServer.secretKeyViewTitle}
              </span>

              <button
                type="button"
                onClick={() => setMobileSecretKeyOpen(false)}
                aria-label={t.connectServer.secretKeyCloseAria}
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            <ServerSecretKeyView userId={user.id} variant="mobile" />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3c. Mobile full-screen white Ajustes avanzados view */}
      <AnimatePresence>
        {advancedSettingsModalOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t.menu.advancedSettings}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onBackToAccountFromAdvancedSettings}
                  aria-label={t.menu.backToGoogleAccountAria}
                  className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                  {t.menu.advancedSettings}
                </span>
              </div>

              <button
                type="button"
                onClick={onCloseAdvancedSettingsModal}
                aria-label={t.menu.closeAdvancedSettingsAria}
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            <AdvancedSettingsView
              variant="mobile"
              hasR2Images={hasR2Images}
              hasActiveApis={hasActiveApis}
              hasPausedApis={hasPausedApis}
              onPurgeAllR2={onPurgeAllR2}
              onClearBrowserData={onClearBrowserData}
              onDeleteAccount={onDeleteAccount}
              onPauseAllApis={onPauseAllApis}
              onUnfreezeAllApis={onUnfreezeAllApis}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 4. Mobile centered floating Idioma modal (exact same frame as Google Account modal) */}
      <AnimatePresence>
        {languageModalOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-center justify-center p-5">
            {/* Dimmed backdrop */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              onClick={onCloseLanguageModal}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />

            {/* Centered compact card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.languagesTitle}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
              }
              className="relative w-full max-w-[336px] rounded-3xl bg-white/96 backdrop-blur-xl border border-slate-200/90 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.3)] overflow-visible"
            >
              {/* Modal top bar */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-200/75">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.language}
                </span>
                <button
                  type="button"
                  onClick={onCloseLanguageModal}
                  aria-label={t.menu.closeMenuAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Languages list */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500">
                  {t.menu.languagesTitle}
                </p>

                <div
                  role="radiogroup"
                  aria-label={t.menu.languageOptionsAria}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/75 divide-y divide-slate-200/70 overflow-hidden"
                >
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isSelected = locale === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setManualLocale(option.code)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white text-slate-950'
                            : 'text-slate-700 hover:bg-white/75 hover:text-slate-950'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-950 truncate">
                            {option.nativeLabel}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {option.regionLabel}
                          </p>
                        </div>
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5 text-slate-950 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom auto/manual hint */}
              <div className="px-5 pt-3 pb-4 border-t border-slate-200/75">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {source === 'manual'
                    ? t.menu.languageManualSavedNote
                    : t.menu.languageAutoDetectedNote(countryCode)}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
