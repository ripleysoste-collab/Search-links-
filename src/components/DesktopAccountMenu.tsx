import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Calendar, Check, ChevronDown, Copy, FileArchive, Loader2, Mail, User as UserIcon, X } from 'lucide-react';

import {
  DesktopOrganizationView,
  type OrganizationProfile,
  type OrganizationServiceItem,
} from './DesktopOrganizationView';
import { DesktopStoreView } from './DesktopStoreView';
import { ConnectServerView } from './ConnectServerView';
import { QuickServerCodeViewer } from './QuickServerCodeViewer';
import { ServerTestView } from './ServerTestView';
import { ServerSecretHelpView } from './ServerSecretHelpView';
import {
  ServerUpdatesView,
  formatAgencyUpdateDate,
  formatAgencyUpdateTitle,
} from './ServerUpdatesView';
import { ServerSecretKeyView } from './ServerSecretKeyView';
import { ServiceApiKeyView } from './ServiceApiKeyView';
import { ServiceEndpointTestView } from './ServiceEndpointTestView';
import { AdvancedSettingsView } from './AdvancedSettingsView';
import { LIGHT_TOKEN_CLASSES, tokenizeJsonLine } from './MobileJsonEditorModal';
import {
  AGENCY_SYNC_UPDATED_EVENT,
  hydrateAgencyConnectionFromCloud,
  loadAgencyConnectionState,
  type AgencyConnectionState,
  type AgencyServerUpdateRecord,
} from '../lib/agencySyncClient';
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

export type DesktopMenuView =
  | 'menu'
  | 'google-account'
  | 'advanced-settings'
  | 'organization'
  | 'connect-server'
  | 'store'
  | 'schema'
  | 'api-key'
  | 'endpoint-test'
  | 'language';

interface DesktopAccountMenuProps {
  open: boolean;
  view: DesktopMenuView;
  selectedStoreServiceId: string | null;
  selectedSchemaServiceId: string | null;
  selectedApiKeyServiceId: string | null;
  selectedEndpointTestServiceId: string | null;
  onViewChange: (nextView: DesktopMenuView, service?: OrganizationServiceItem) => void;
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
  onClose: () => void;
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

export function DesktopAccountMenu({
  open,
  view,
  selectedStoreServiceId,
  selectedSchemaServiceId,
  selectedApiKeyServiceId,
  selectedEndpointTestServiceId,
  onViewChange,
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
  onOpenDocumentation,
  onClose,
  onSignOut,
  onPurgeAllR2,
  onClearBrowserData,
  onDeleteAccount,
  onPauseAllApis,
  onUnfreezeAllApis,
  hasR2Images,
  hasActiveApis,
  hasPausedApis,
}: DesktopAccountMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const { locale, source, countryCode, setManualLocale, t } = useI18n();
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [serverConnState, setServerConnState] = useState<AgencyConnectionState>(() =>
    loadAgencyConnectionState(user.id),
  );
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isHelpingSecret, setIsHelpingSecret] = useState(false);
  const [isViewingServerUpdates, setIsViewingServerUpdates] = useState(false);
  const [isViewingSecretKey, setIsViewingSecretKey] = useState(false);
  const [selectedDesktopUpdate, setSelectedDesktopUpdate] =
    useState<AgencyServerUpdateRecord | null>(null);
  const [desktopUpdateCopied, setDesktopUpdateCopied] = useState(false);

  const info = getUserDisplayInfo(
    user,
    t.common.userFallback,
    locale,
    t.menu.dateUnavailable,
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
    if (!open || view !== 'connect-server') return;
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
  }, [open, view, user.id]);

  useEffect(() => {
    if (!open || view !== 'connect-server' || !serverConnState.autoSyncEnabled) {
      setIsTestingServer(false);
    }
    if (!open || view !== 'connect-server') {
      setIsHelpingSecret(false);
      setIsViewingServerUpdates(false);
      setIsViewingSecretKey(false);
      setSelectedDesktopUpdate(null);
      setDesktopUpdateCopied(false);
    }
  }, [open, view, serverConnState.autoSyncEnabled]);

  useEffect(() => {
    if (!open) {
      setDocsExpanded(false);
      setSchemaCopied(false);
      setConfirmSignOut(false);
      setSigningOut(false);
      setSignOutError(null);
      setIsTestingServer(false);
      setIsHelpingSecret(false);
      setIsViewingServerUpdates(false);
      setIsViewingSecretKey(false);
      setSelectedDesktopUpdate(null);
      setDesktopUpdateCopied(false);
    }
  }, [open]);

  const selectedStoreService =
    services.find((srv) => srv.id === selectedStoreServiceId) ?? services[0] ?? null;

  const selectedSchemaService =
    services.find((srv) => srv.id === selectedSchemaServiceId) ?? services[0] ?? null;

  const selectedApiKeyService =
    services.find((srv) => srv.id === selectedApiKeyServiceId) ?? services[0] ?? null;

  const selectedEndpointTestService =
    services.find((srv) => srv.id === selectedEndpointTestServiceId) ?? services[0] ?? null;

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

  const tokenizedSchemaLines = useMemo(
    () =>
      schemaJsonText
        ? schemaJsonText.split('\n').map((line) => tokenizeJsonLine(line))
        : [],
    [schemaJsonText],
  );

  const handleCopySchema = async () => {
    if (!schemaJsonText) return;
    try {
      await navigator.clipboard.writeText(schemaJsonText);
      setSchemaCopied(true);
      window.setTimeout(() => setSchemaCopied(false), 1600);
    } catch {
      setSchemaCopied(false);
    }
  };

  const handleCopyDesktopUpdate = async () => {
    if (!selectedDesktopUpdate?.payloadJson) return;
    try {
      await navigator.clipboard.writeText(selectedDesktopUpdate.payloadJson);
      setDesktopUpdateCopied(true);
      window.setTimeout(() => setDesktopUpdateCopied(false), 1600);
    } catch {
      setDesktopUpdateCopied(false);
    }
  };

  const isExpandedPanelView =
    view === 'google-account' ||
    view === 'advanced-settings' ||
    view === 'organization' ||
    view === 'connect-server' ||
    view === 'store' ||
    view === 'schema' ||
    view === 'api-key' ||
    view === 'endpoint-test' ||
    view === 'language';
  const isServerConnected = serverConnState.autoSyncEnabled;
  const isDesktopServerTestActive =
    view === 'connect-server' && isServerConnected && isTestingServer;
  const isDesktopServerUpdatesActive =
    view === 'connect-server' &&
    isViewingServerUpdates &&
    !isDesktopServerTestActive;
  const isDesktopSecretKeyActive =
    view === 'connect-server' &&
    isViewingSecretKey &&
    !isDesktopServerTestActive &&
    !isDesktopServerUpdatesActive;
  const isDesktopSecretHelpActive =
    view === 'connect-server' &&
    isHelpingSecret &&
    !isDesktopServerTestActive &&
    !isDesktopServerUpdatesActive &&
    !isDesktopSecretKeyActive;
  const isConnectSplitView =
    view === 'connect-server' &&
    !isServerConnected &&
    !isDesktopServerUpdatesActive &&
    !isDesktopSecretKeyActive;
  const topTitle =
    view === 'google-account'
      ? t.menu.googleAccount
      : view === 'advanced-settings'
        ? t.menu.advancedSettings
        : view === 'organization'
          ? t.menu.organization
          : view === 'connect-server'
            ? t.connectServer.title
            : view === 'store'
              ? t.menu.myStore
              : view === 'schema'
                ? t.org.schemaTitle
                : view === 'api-key'
                  ? t.org.menuViewApi
                  : view === 'endpoint-test'
                    ? t.org.menuTestEndpoint
                    : view === 'language'
                      ? t.menu.language
                      : t.menu.account;

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
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          aria-label={
            view === 'google-account'
              ? t.menu.googleAccountDetailsAria
              : view === 'advanced-settings'
                ? t.menu.advancedSettings
                : view === 'organization'
                  ? t.menu.organization
                  : view === 'connect-server'
                    ? t.connectServer.title
                    : view === 'store'
                      ? t.menu.myStore
                      : view === 'api-key'
                        ? t.org.menuViewApi
                        : view === 'endpoint-test'
                          ? t.org.menuTestEndpoint
                          : view === 'language'
                            ? t.menu.languagesTitle
                            : t.menu.accountMenuAria
          }
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  width: isConnectSplitView
                    ? '100%'
                    : isExpandedPanelView
                      ? '50%'
                      : '25%',
                  opacity: 1,
                  borderTopLeftRadius: isConnectSplitView
                    ? 0
                    : isExpandedPanelView
                      ? 28
                      : 0,
                  borderBottomLeftRadius: isConnectSplitView
                    ? 0
                    : isExpandedPanelView
                      ? 28
                      : 0,
                }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
          }
          className="hidden lg:flex shrink-0 h-dvh sticky top-0 overflow-hidden z-20 bg-white/95 backdrop-blur-xl border-l border-slate-200/85 shadow-[-18px_0_48px_-18px_rgba(15,23,42,0.24)] flex-col"
        >
          <div className="w-full min-w-[270px] h-full flex flex-col">
            {/* Top bar */}
            {view === 'schema' && selectedSchemaService ? (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200/75 bg-white shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold tracking-tight text-slate-950 shrink-0">
                    {t.org.schemaTitle}
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    · {selectedSchemaService.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopySchema()}
                    aria-label={t.org.copySchemaAria}
                    title={t.common.copy}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    {schemaCopied ? (
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
                    onClick={() => {
                      if (activeSchemaInput) {
                        downloadServiceSchemaZip(activeSchemaInput);
                      }
                    }}
                    aria-label={t.org.downloadSchemaZipAria}
                    title={t.org.downloadSchemaZipTitle}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    <FileArchive className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewChange('organization')}
                    aria-label={t.org.backToOrgSchemaAria}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200/75 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isExpandedPanelView &&
                    !isDesktopServerTestActive &&
                    !isDesktopSecretHelpActive &&
                    !isDesktopSecretKeyActive &&
                    (!isDesktopServerUpdatesActive || Boolean(selectedDesktopUpdate)) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isDesktopServerUpdatesActive && selectedDesktopUpdate) {
                            setSelectedDesktopUpdate(null);
                            setDesktopUpdateCopied(false);
                            return;
                          }
                          setConfirmSignOut(false);
                          setSignOutError(null);
                          onViewChange(
                            view === 'store' ||
                              view === 'api-key' ||
                              view === 'endpoint-test'
                              ? 'organization'
                              : view === 'advanced-settings'
                                ? 'google-account'
                                : 'menu',
                          );
                        }}
                        aria-label={
                          isDesktopServerUpdatesActive && selectedDesktopUpdate
                            ? t.connectServer.updatesBackToListAria
                            : view === 'store' ||
                                view === 'api-key' ||
                                view === 'endpoint-test'
                              ? t.menu.backToOrgAria
                              : view === 'advanced-settings'
                                ? t.menu.backToGoogleAccountAria
                                : t.menu.backToMenuAria
                        }
                        className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  {isDesktopServerUpdatesActive && selectedDesktopUpdate ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold tracking-tight text-slate-950 truncate">
                        {formatAgencyUpdateTitle(selectedDesktopUpdate, t)}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        · {formatAgencyUpdateDate(selectedDesktopUpdate.syncedAt, locale)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold tracking-tight text-slate-950 truncate">
                      {isDesktopServerTestActive
                        ? t.connectServer.testServerTitle
                        : isDesktopServerUpdatesActive
                          ? t.connectServer.updatesTitle
                          : isDesktopSecretKeyActive
                            ? t.connectServer.secretKeyViewTitle
                            : isDesktopSecretHelpActive
                              ? t.connectServer.secretHelpTitle
                              : topTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isDesktopServerUpdatesActive && selectedDesktopUpdate && (
                    <button
                      type="button"
                      onClick={() => void handleCopyDesktopUpdate()}
                      aria-label={t.connectServer.updatesCopyPayloadAria}
                      title={desktopUpdateCopied ? t.common.copied : t.common.copy}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                    >
                      {desktopUpdateCopied ? (
                        <Check
                          className="w-4 h-4 text-emerald-600 stroke-[2.5]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isDesktopServerTestActive) {
                        setIsTestingServer(false);
                      } else if (isDesktopServerUpdatesActive) {
                        setSelectedDesktopUpdate(null);
                        setDesktopUpdateCopied(false);
                        setIsViewingServerUpdates(false);
                      } else if (isDesktopSecretKeyActive) {
                        setIsViewingSecretKey(false);
                      } else if (isDesktopSecretHelpActive) {
                        setIsHelpingSecret(false);
                      } else {
                        onClose();
                      }
                    }}
                    aria-label={
                      isDesktopServerTestActive
                        ? t.connectServer.testCloseAria
                        : isDesktopServerUpdatesActive
                          ? t.connectServer.updatesCloseAria
                          : isDesktopSecretKeyActive
                            ? t.connectServer.secretKeyCloseAria
                            : isDesktopSecretHelpActive
                              ? t.connectServer.secretHelpCloseAria
                              : t.menu.closeMenuAria
                    }
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {view === 'menu' ? (
                <motion.nav
                  key="desktop-menu-list"
                  aria-label={t.menu.accountOptionsAria}
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex-1 overflow-y-auto px-6 py-4"
                >
                  <ul className="divide-y divide-slate-200/75">
                    <li>
                      <button
                        type="button"
                        onClick={() => onViewChange('google-account')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.googleAccount}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onViewChange('organization')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.organization}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onViewChange('connect-server')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.connectServer}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => onViewChange('language')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.language}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        aria-expanded={docsExpanded}
                        onClick={() => setDocsExpanded((prev) => !prev)}
                        className="w-full py-3 flex items-center justify-between gap-2 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
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
                            <ul className="pl-3 pb-3 pt-0.5 space-y-1 border-l border-slate-200/90 ml-1">
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('privacy');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.privacyAndUse}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('terms');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.termsAndConditions}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('content');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.contentPolicies}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('cookies');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.cookiePolicies}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('agency');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.agencyMode}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('agency-guide');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.agencyModeGuide}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('agency-liability');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
                                >
                                  {t.menu.agencyModeLiability}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenDocumentation('liability');
                                  }}
                                  className="w-full py-1.5 px-2 text-left text-[13px] font-medium text-slate-900 hover:text-black hover:bg-slate-100/75 rounded-lg transition-colors cursor-pointer"
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
                </motion.nav>
              ) : view === 'organization' ? (
                <motion.div
                  key="desktop-organization-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <DesktopOrganizationView
                    orgProfile={orgProfile}
                    googlePhotoUrl={info.photoUrl}
                    googleInitialLetter={info.initialLetter}
                    services={services}
                    onSaveOrgProfile={onSaveOrgProfile}
                    onRenameService={onRenameService}
                    onNewProduct={onNewProduct}
                    onOpenStore={(service) => {
                      onViewChange('store', service);
                    }}
                    onOpenApiKey={(service) => {
                      onViewChange('api-key', service);
                    }}
                    onOpenEndpointTest={(service) => {
                      onViewChange('endpoint-test', service);
                    }}
                    onViewServiceHistory={onViewServiceHistory}
                    onOpenSchema={(service) => {
                      setSchemaCopied(false);
                      onViewChange('schema', service);
                    }}
                    onOpenServiceChat={onOpenServiceChat}
                  />
                </motion.div>
              ) : view === 'connect-server' ? (
                isDesktopServerTestActive ? (
                  <motion.div
                    key="desktop-server-test-view"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 bg-white flex flex-col"
                  >
                    <ServerTestView
                      serverUrl={serverConnState.serverUrl}
                      variant="desktop"
                      onClose={() => setIsTestingServer(false)}
                    />
                  </motion.div>
                ) : isDesktopServerUpdatesActive ? (
                  <motion.div
                    key="desktop-server-updates-view"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 bg-white flex flex-col"
                  >
                    <ServerUpdatesView
                      userId={user.id}
                      variant="desktop"
                      selectedUpdate={selectedDesktopUpdate}
                      onSelectUpdate={(upd) => {
                        setDesktopUpdateCopied(false);
                        setSelectedDesktopUpdate(upd);
                      }}
                    />
                  </motion.div>
                ) : isDesktopSecretKeyActive ? (
                  <motion.div
                    key="desktop-server-secret-key-view"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 bg-white flex flex-col"
                  >
                    <ServerSecretKeyView userId={user.id} variant="desktop" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="desktop-connect-server-view"
                    initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex-1 min-h-0 bg-white ${
                      isConnectSplitView
                        ? 'grid grid-cols-2 divide-x divide-slate-200/80'
                        : 'flex flex-col'
                    }`}
                  >
                    {isConnectSplitView && (
                      <div className="min-h-0 min-w-0 flex flex-col bg-white">
                        <QuickServerCodeViewer
                          secretKey={serverConnState.secretKey}
                          variant="desktop"
                        />
                      </div>
                    )}
                    <div className="min-h-0 min-w-0 flex flex-col bg-white">
                      {isDesktopSecretHelpActive ? (
                        <ServerSecretHelpView variant="desktop" />
                      ) : (
                        <ConnectServerView
                          userId={user.id}
                          services={services}
                          variant="desktop"
                          onOpenServerTest={
                            isServerConnected
                              ? () => {
                                  setIsHelpingSecret(false);
                                  setIsViewingServerUpdates(false);
                                  setIsViewingSecretKey(false);
                                  setIsTestingServer(true);
                                }
                              : undefined
                          }
                          onOpenSecretHelp={() => {
                            setIsViewingServerUpdates(false);
                            setIsViewingSecretKey(false);
                            setIsHelpingSecret(true);
                          }}
                          onOpenServerUpdates={() => {
                            setIsHelpingSecret(false);
                            setIsTestingServer(false);
                            setIsViewingSecretKey(false);
                            setSelectedDesktopUpdate(null);
                            setIsViewingServerUpdates(true);
                          }}
                          onOpenSecretKey={() => {
                            setIsHelpingSecret(false);
                            setIsTestingServer(false);
                            setIsViewingServerUpdates(false);
                            setIsViewingSecretKey(true);
                          }}
                        />
                      )}
                    </div>
                  </motion.div>
                )
              ) : view === 'store' && selectedStoreService ? (
                <motion.div
                  key="desktop-store-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <DesktopStoreView
                    service={selectedStoreService}
                    organizationName={orgProfile.name}
                    organizationLogoUrl={orgProfile.logoUrl || info.photoUrl}
                  />
                </motion.div>
              ) : view === 'api-key' && selectedApiKeyService ? (
                <motion.div
                  key="desktop-api-key-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 bg-white flex flex-col"
                >
                  <ServiceApiKeyView
                    service={selectedApiKeyService}
                    variant="desktop"
                    onRotateServiceKey={onRotateServiceKey}
                    onToggleServiceActive={onToggleServiceActive}
                  />
                </motion.div>
              ) : view === 'endpoint-test' && selectedEndpointTestService ? (
                <motion.div
                  key="desktop-endpoint-test-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 bg-white flex flex-col"
                >
                  <ServiceEndpointTestView
                    service={selectedEndpointTestService}
                    variant="desktop"
                  />
                </motion.div>
              ) : view === 'schema' && selectedSchemaService ? (
                <motion.div
                  key="desktop-schema-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 bg-white flex flex-col"
                >
                  <div
                    aria-readonly="true"
                    className="flex-1 min-h-0 overflow-auto py-4 px-4 font-mono text-[12px] leading-[1.65] select-text"
                  >
                    <div className="min-w-max">
                      {tokenizedSchemaLines.map((tokens, idx) => (
                        <div
                          key={`desktop-schema-line-${idx}`}
                          className="flex items-start px-1.5"
                        >
                          <span
                            aria-hidden="true"
                            className="w-8 pr-3 text-right text-[11px] text-slate-300 select-none shrink-0 tabular-nums"
                          >
                            {idx + 1}
                          </span>
                          <pre className="whitespace-pre font-mono">
                            {tokens.length === 0 ? (
                              <span>{' '}</span>
                            ) : (
                              tokens.map((tok, tIdx) => (
                                <span
                                  key={`desktop-schema-tok-${idx}-${tIdx}`}
                                  className={LIGHT_TOKEN_CLASSES[tok.type]}
                                >
                                  {tok.text}
                                </span>
                              ))
                            )}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : view === 'language' ? (
                <motion.div
                  key="desktop-language-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 overflow-y-auto px-8 py-7 flex flex-col justify-between"
                >
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                        {t.menu.languagesTitle}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {t.menu.languageSectionPrompt}
                      </p>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label={t.menu.languageOptionsAria}
                      className="rounded-2xl border border-slate-200/85 bg-slate-50/70 divide-y divide-slate-200/75 overflow-hidden"
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
                            className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-white text-slate-950'
                                : 'text-slate-700 hover:bg-white/75 hover:text-slate-950'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950 truncate">
                                {option.nativeLabel}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {option.regionLabel}
                              </p>
                            </div>

                            {isSelected && (
                              <Check
                                className="w-4 h-4 text-slate-950 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 mt-8 border-t border-slate-200/75 space-y-1">
                    <p className="text-xs font-medium text-slate-700">
                      {source === 'manual'
                        ? t.menu.languageManualSavedNote
                        : t.menu.languageAutoDetectedNote(countryCode)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.menu.languageLocalStorageHint}
                    </p>
                  </div>
                </motion.div>
              ) : view === 'advanced-settings' ? (
                <motion.div
                  key="desktop-advanced-settings-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 bg-white flex flex-col"
                >
                  <AdvancedSettingsView
                    variant="desktop"
                    hasR2Images={hasR2Images}
                    hasActiveApis={hasActiveApis}
                    hasPausedApis={hasPausedApis}
                    onPurgeAllR2={onPurgeAllR2}
                    onClearBrowserData={onClearBrowserData}
                    onDeleteAccount={onDeleteAccount}
                    onPauseAllApis={onPauseAllApis}
                    onUnfreezeAllApis={onUnfreezeAllApis}
                  />
                </motion.div>
              ) : view === 'google-account' ? (
                <motion.div
                  key="desktop-google-account-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 overflow-y-auto px-8 py-7 flex flex-col justify-between"
                >
                  <div className="space-y-6">
                    {/* Profile header */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                        {info.photoUrl && !imgFailed ? (
                          <img
                            src={info.photoUrl}
                            alt={info.fullName}
                            referrerPolicy="no-referrer"
                            onError={() => setImgFailed(true)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-semibold text-slate-800">
                            {info.initialLetter}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight text-slate-950 truncate">
                          {info.fullName}
                        </h2>
                        {info.email && (
                          <p className="text-sm text-slate-500 truncate mt-0.5">
                            {info.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Account details */}
                    <div className="rounded-2xl border border-slate-200/85 bg-slate-50/70 divide-y divide-slate-200/75">
                      <div className="px-4 py-3.5 flex items-start gap-3">
                        <UserIcon
                          className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">
                            {t.menu.usernameLabel}
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5 break-words">
                            {info.fullName}
                          </p>
                        </div>
                      </div>

                      {info.email && (
                        <div className="px-4 py-3.5 flex items-start gap-3">
                          <Mail
                            className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-slate-400">
                              {t.menu.googleAccountLabel}
                            </p>
                            <p className="text-sm font-medium text-slate-900 mt-0.5 break-all">
                              {info.email}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="px-4 py-3.5 flex items-start gap-3">
                        <Calendar
                          className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">
                            {t.menu.createdAtLabel}
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">
                            {t.menu.accountCreatedOn(info.createdAtFormatted)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Sign-out text action + small confirmation box directly above */}
                  <div className="relative pt-6 mt-8 border-t border-slate-200/75">
                    <AnimatePresence>
                      {confirmSignOut && (
                        <motion.div
                          role="alertdialog"
                          aria-label={t.menu.confirmSignOutAria}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 8, scale: 0.97 }
                          }
                          animate={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 1, y: 0, scale: 1 }
                          }
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 6, scale: 0.97 }
                          }
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          className="mb-3 rounded-2xl border border-slate-200/95 bg-white p-4 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.18)]"
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {t.menu.confirmSignOutTitle}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t.menu.confirmSignOutDescDesktop}
                          </p>

                          {signOutError && (
                            <p className="text-xs text-rose-600 mt-2">{signOutError}</p>
                          )}

                          <div className="mt-3.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={signingOut}
                              onClick={() => {
                                setConfirmSignOut(false);
                                setSignOutError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {t.common.cancel}
                            </button>
                            <button
                              type="button"
                              disabled={signingOut}
                              onClick={() => void handleConfirmSignOut()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {signingOut && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
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
                        onViewChange('advanced-settings');
                      }}
                      className="block mb-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150 focus-visible:outline-none focus-visible:underline cursor-pointer"
                    >
                      {t.menu.goToAdvancedSettings}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSignOutError(null);
                        setConfirmSignOut((prev) => !prev);
                      }}
                      className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors duration-150 focus-visible:outline-none focus-visible:underline cursor-pointer"
                    >
                      {t.menu.signOut}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="desktop-organization-fallback-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <DesktopOrganizationView
                    orgProfile={orgProfile}
                    googlePhotoUrl={info.photoUrl}
                    googleInitialLetter={info.initialLetter}
                    services={services}
                    onSaveOrgProfile={onSaveOrgProfile}
                    onRenameService={onRenameService}
                    onNewProduct={onNewProduct}
                    onOpenStore={(service) => {
                      onViewChange('store', service);
                    }}
                    onOpenApiKey={(service) => {
                      onViewChange('api-key', service);
                    }}
                    onOpenEndpointTest={(service) => {
                      onViewChange('endpoint-test', service);
                    }}
                    onViewServiceHistory={onViewServiceHistory}
                    onOpenSchema={(service) => {
                      setSchemaCopied(false);
                      onViewChange('schema', service);
                    }}
                    onOpenServiceChat={onOpenServiceChat}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
