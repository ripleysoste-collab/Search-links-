import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import {
  AGENCY_SYNC_UPDATED_EVENT,
  dispatchAgencyServerDisconnect,
  dispatchAgencyServerSync,
  hydrateAgencyConnectionFromCloud,
  loadAgencyConnectionState,
  saveAgencyConnectionState,
  type AgencyConnectionState,
} from '../lib/agencySyncClient';
import { useI18n } from '../lib/i18n';

interface ConnectServerViewProps {
  userId: string;
  services: OrganizationServiceItem[];
  variant: 'desktop' | 'mobile';
  onOpenQuickServer?: () => void;
}

export function ConnectServerView({
  userId,
  services,
  variant,
  onOpenQuickServer,
}: ConnectServerViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const serviceMenuRef = useRef<HTMLDivElement>(null);
  const disconnectInputRef = useRef<HTMLInputElement>(null);
  const disconnectingGuardRef = useRef(false);

  const [connState, setConnState] = useState<AgencyConnectionState>(() =>
    loadAgencyConnectionState(userId),
  );
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [pendingSyncConfirm, setPendingSyncConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disconnectBoxOpen, setDisconnectBoxOpen] = useState(false);
  const [disconnectInput, setDisconnectInput] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  const isConnected = connState.autoSyncEnabled;

  useEffect(() => {
    setConnState(loadAgencyConnectionState(userId));
    setPendingSyncConfirm(false);
    setDisconnectBoxOpen(false);
    setDisconnectInput('');
    setFormError(null);
    setSyncSuccessMessage(null);
    let active = true;
    void hydrateAgencyConnectionFromCloud(userId).then((cloudState) => {
      if (active && cloudState) {
        setConnState(cloudState);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const handleSyncUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; state?: AgencyConnectionState }>)
        .detail;
      if (detail?.userId === userId && detail.state) {
        setConnState(detail.state);
      }
    };
    window.addEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
    return () =>
      window.removeEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
  }, [userId]);

  useEffect(() => {
    if (!serviceMenuOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (
        serviceMenuRef.current &&
        !serviceMenuRef.current.contains(event.target as Node)
      ) {
        setServiceMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setServiceMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [serviceMenuOpen]);

  useEffect(() => {
    if (!disconnectBoxOpen) return;
    const timer = window.setTimeout(() => {
      disconnectInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [disconnectBoxOpen]);

  const updateConnectionDraft = (patch: Partial<AgencyConnectionState>) => {
    setConnState((prev) => {
      const next: AgencyConnectionState = { ...prev, ...patch };
      saveAgencyConnectionState(userId, next, false);
      return next;
    });
  };

  const selectedService = useMemo(() => {
    if (!connState.selectedScope || connState.selectedScope === 'all') return null;
    return services.find((srv) => srv.id === connState.selectedScope) ?? null;
  }, [connState.selectedScope, services]);

  const effectiveScope =
    connState.selectedScope === 'all'
      ? 'all'
      : selectedService
        ? selectedService.id
        : null;

  const selectedServiceLabel =
    effectiveScope === 'all'
      ? t.connectServer.allServicesSelected
      : selectedService
        ? selectedService.name
        : '';

  const handleCopySecret = async () => {
    if (!connState.secretKey) return;
    try {
      await navigator.clipboard.writeText(connState.secretKey);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1600);
    } catch {
      setSecretCopied(false);
    }
  };

  const validateSyncForm = (): { trimmedUrl: string; scope: string } | null => {
    setSyncSuccessMessage(null);
    const trimmedUrl = connState.serverUrl.trim();
    if (!trimmedUrl) {
      setFormError(t.connectServer.validationUrlRequired);
      return null;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setFormError(t.connectServer.validationUrlInvalid);
        return null;
      }
    } catch {
      setFormError(t.connectServer.validationUrlInvalid);
      return null;
    }
    if (!effectiveScope) {
      setFormError(t.connectServer.validationServiceRequired);
      return null;
    }
    if (services.length === 0) {
      setFormError(t.connectServer.noServicesToSync);
      return null;
    }
    return { trimmedUrl, scope: effectiveScope };
  };

  const handleRequestSync = (event: React.FormEvent) => {
    event.preventDefault();
    if (isConnected || isSyncing || pendingSyncConfirm) return;
    const valid = validateSyncForm();
    if (!valid) return;
    setFormError(null);
    setPendingSyncConfirm(true);
  };

  const handleConfirmSync = async () => {
    if (isSyncing) return;
    const valid = validateSyncForm();
    if (!valid) {
      setPendingSyncConfirm(false);
      return;
    }

    setFormError(null);
    setIsSyncing(true);

    try {
      const result = await dispatchAgencyServerSync({
        userId,
        serverUrl: valid.trimmedUrl,
        serviceScope: valid.scope,
        secretKey: connState.secretKey,
        services,
        eventType: 'manual',
      });

      if (!result.ok) {
        setPendingSyncConfirm(false);
        setFormError(result.error || t.connectServer.syncNetworkError);
        return;
      }

      setPendingSyncConfirm(false);
      setSyncSuccessMessage(
        t.connectServer.syncSuccess(
          result.syncedServices ?? 1,
          result.syncedProducts ?? 0,
          result.durationMs ?? 1,
        ),
      );
    } catch {
      setPendingSyncConfirm(false);
      setFormError(t.connectServer.syncNetworkError);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenDisconnectBox = () => {
    if (!isConnected || isDisconnecting) return;
    setFormError(null);
    setSyncSuccessMessage(null);
    setDisconnectInput('');
    setDisconnectBoxOpen((prev) => !prev);
  };

  const executeDisconnect = async () => {
    if (disconnectingGuardRef.current || isDisconnecting) return;
    disconnectingGuardRef.current = true;
    setIsDisconnecting(true);
    setFormError(null);

    try {
      const result = await dispatchAgencyServerDisconnect(userId);
      if (!result.ok) {
        setFormError(result.error || t.connectServer.disconnectNetworkError);
        setDisconnectInput('');
        return;
      }

      setDisconnectBoxOpen(false);
      setDisconnectInput('');
      setPendingSyncConfirm(false);
      setSyncSuccessMessage(t.connectServer.disconnectSuccess);
    } catch {
      setFormError(t.connectServer.disconnectNetworkError);
      setDisconnectInput('');
    } finally {
      disconnectingGuardRef.current = false;
      setIsDisconnecting(false);
    }
  };

  const handleDisconnectInputChange = (value: string) => {
    setDisconnectInput(value);
    if (formError) setFormError(null);
    const normalizedTyped = value.trim().toLowerCase();
    const normalizedExpected = t.connectServer.disconnectConfirmPhrase
      .trim()
      .toLowerCase();
    if (normalizedTyped === normalizedExpected && !isDisconnecting) {
      void executeDisconnect();
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';
  const boxHeightClass = variant === 'desktop' ? 'py-2.5' : 'min-h-[46px] py-2';
  const iconButtonClass =
    variant === 'desktop'
      ? 'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <form
      onSubmit={handleRequestSync}
      noValidate
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-between gap-6`}
    >
      <div className="space-y-5">
        {/* 1. URL de tu servidor */}
        <div>
          <label
            htmlFor={`connect-server-url-${variant}`}
            className="block text-xs font-medium text-slate-950 mb-1.5"
          >
            {t.connectServer.serverUrlLabel}
          </label>
          <div
            className={`rounded-2xl border transition-colors flex items-center gap-1.5 px-3.5 ${boxHeightClass} ${
              isConnected
                ? 'border-slate-200/80 bg-slate-100/70'
                : 'border-slate-200/90 bg-slate-50/75 focus-within:bg-white focus-within:border-blue-500/70'
            }`}
          >
            <input
              id={`connect-server-url-${variant}`}
              type={showServerUrl ? 'text' : 'password'}
              value={connState.serverUrl}
              readOnly={isConnected}
              disabled={isConnected}
              onChange={(e) => {
                if (isConnected) return;
                updateConnectionDraft({ serverUrl: e.target.value });
                if (formError) setFormError(null);
                if (syncSuccessMessage) setSyncSuccessMessage(null);
                if (pendingSyncConfirm) setPendingSyncConfirm(false);
              }}
              aria-label={t.connectServer.serverUrlAria}
              autoComplete="new-password"
              spellCheck={false}
              inputMode="url"
              data-lpignore="true"
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-900 focus:outline-none disabled:text-slate-600 disabled:cursor-default"
            />
            <button
              type="button"
              onClick={() => setShowServerUrl((prev) => !prev)}
              aria-label={
                showServerUrl
                  ? t.connectServer.hideUrlAria
                  : t.connectServer.showUrlAria
              }
              title={
                showServerUrl
                  ? t.connectServer.hideUrlAria
                  : t.connectServer.showUrlAria
              }
              className={iconButtonClass}
            >
              {showServerUrl ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Escoge tu servicio */}
        <div ref={serviceMenuRef} className="relative">
          <span className="block text-xs font-medium text-slate-950 mb-1.5">
            {t.connectServer.chooseServiceLabel}
          </span>
          <button
            type="button"
            disabled={isConnected}
            onClick={() => {
              if (!isConnected) setServiceMenuOpen((prev) => !prev);
            }}
            aria-haspopup="menu"
            aria-expanded={!isConnected && serviceMenuOpen}
            aria-label={t.connectServer.chooseServiceMenuAria}
            className={`w-full rounded-2xl border transition-colors flex items-center justify-between gap-2 px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${boxHeightClass} ${
              isConnected
                ? 'border-slate-200/80 bg-slate-100/70 cursor-default opacity-80'
                : serviceMenuOpen
                  ? 'border-blue-500/70 bg-white cursor-pointer'
                  : 'border-slate-200/90 bg-slate-50/75 hover:bg-white hover:border-slate-300 cursor-pointer'
            }`}
          >
            <span className="text-sm font-medium text-slate-900 truncate min-h-[20px]">
              {selectedServiceLabel}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {selectedService && (
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                  {selectedService.itemCount}
                </span>
              )}
              {!isConnected && (
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    serviceMenuOpen ? 'rotate-180 text-slate-700' : ''
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          </button>

          <AnimatePresence>
            {serviceMenuOpen && !isConnected && (
              <motion.div
                role="menu"
                aria-label={t.connectServer.chooseServiceMenuAria}
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
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200/95 bg-white shadow-[0_18px_44px_-12px_rgba(15,23,42,0.24)] p-1.5 z-30"
              >
                <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {services.length === 0 ? (
                    <li className="px-2.5 py-2 text-xs text-slate-400">
                      {t.connectServer.noServicesHint}
                    </li>
                  ) : (
                    services.map((service) => {
                      const isActive = effectiveScope === service.id;
                      return (
                        <li key={`connect-srv-${service.id}`}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              updateConnectionDraft({ selectedScope: service.id });
                              setServiceMenuOpen(false);
                              if (formError) setFormError(null);
                              if (syncSuccessMessage) setSyncSuccessMessage(null);
                              if (pendingSyncConfirm) setPendingSyncConfirm(false);
                            }}
                            className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-slate-50 text-slate-950'
                                : 'text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-xs font-medium truncate">
                              {service.name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                {service.itemCount}
                              </span>
                              {isActive && (
                                <Check
                                  className="w-3.5 h-3.5 text-slate-900"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })
                  )}

                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        updateConnectionDraft({ selectedScope: 'all' });
                        setServiceMenuOpen(false);
                        if (formError) setFormError(null);
                        if (syncSuccessMessage) setSyncSuccessMessage(null);
                        if (pendingSyncConfirm) setPendingSyncConfirm(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        effectiveScope === 'all'
                          ? 'bg-slate-50 text-slate-950'
                          : 'text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-semibold">
                        {t.connectServer.syncAllOption}
                      </span>
                      {effectiveScope === 'all' && (
                        <Check
                          className="w-3.5 h-3.5 text-slate-900 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. Clave secreta */}
        <div>
          <label
            htmlFor={`connect-server-secret-${variant}`}
            className="block text-xs font-medium text-slate-950 mb-1.5"
          >
            {t.connectServer.secretKeyLabel}
          </label>
          <div
            className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1 px-3.5 ${boxHeightClass}`}
          >
            <input
              id={`connect-server-secret-${variant}`}
              type={showSecretKey ? 'text' : 'password'}
              readOnly
              value={connState.secretKey}
              aria-label={t.connectServer.secretKeyAria}
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent font-mono text-xs tracking-wide text-slate-800 focus:outline-none select-all"
            />

            <button
              type="button"
              onClick={() => setShowSecretKey((prev) => !prev)}
              aria-label={
                showSecretKey
                  ? t.connectServer.hideSecretAria
                  : t.connectServer.showSecretAria
              }
              title={
                showSecretKey
                  ? t.connectServer.hideSecretAria
                  : t.connectServer.showSecretAria
              }
              className={iconButtonClass}
            >
              {showSecretKey ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleCopySecret()}
              aria-label={t.connectServer.copySecretAria}
              title={secretCopied ? t.common.copiedFem : t.common.copy}
              className={iconButtonClass}
            >
              {secretCopied ? (
                <Check
                  className="w-4 h-4 text-emerald-600 stroke-[2.4]"
                  aria-hidden="true"
                />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {formError}
          </p>
        )}

        {syncSuccessMessage && (
          <p
            role="status"
            className="flex items-start gap-2 text-xs font-medium text-emerald-700"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{syncSuccessMessage}</span>
          </p>
        )}
      </div>

      {/* Minimal skeletal swipe cue on mobile right above Sincronizar before server connection */}
      {variant === 'mobile' && !isConnected && onOpenQuickServer && (
        <div className="mt-auto pt-2 flex justify-end">
          <button
            type="button"
            onClick={onOpenQuickServer}
            aria-label={t.connectServer.swipeToQuickServerAria}
            className="group min-h-[44px] min-w-[44px] inline-flex items-center gap-2 py-2 px-2 text-slate-400 hover:text-slate-700 active:opacity-70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-slate-900"
          >
            <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
              {t.connectServer.swipeHintLabel}
            </span>
            <span className="w-6 h-6 rounded-full border border-slate-300/85 group-hover:border-slate-400 flex items-center justify-center transition-colors shrink-0">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="w-3 h-3"
              >
                <path
                  d="M2.5 8H13M9.5 4.5L13 8L9.5 11.5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Bottom CTA & Inline Confirmations */}
      <div className="pt-4 border-t border-slate-200/75 shrink-0 space-y-3.5">
        <AnimatePresence initial={false}>
          {!isConnected && pendingSyncConfirm && (
            <motion.div
              key="sync-liability-confirm"
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, height: 'auto' }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0 }
              }
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <p className="text-[12.5px] leading-relaxed text-slate-800">
                {t.connectServer.syncLiabilityConfirmText}
              </p>
              <div className="mt-2.5 flex items-center gap-5">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => setPendingSyncConfirm(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline disabled:opacity-45"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void handleConfirmSync()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline disabled:opacity-60"
                >
                  {isSyncing && (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  )}
                  {t.common.accept}
                </button>
              </div>
            </motion.div>
          )}

          {isConnected && disconnectBoxOpen && (
            <motion.div
              key="disconnect-confirm-box"
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 4, height: 0 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, height: 'auto' }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 4, height: 0 }
              }
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/75 p-3.5 space-y-2.5">
                <p className="text-[12px] leading-relaxed text-slate-700">
                  {t.connectServer.disconnectConfirmPrompt}{' '}
                  <span className="font-semibold text-slate-950">
                    {t.connectServer.disconnectConfirmPhrase}
                  </span>
                </p>

                <input
                  ref={disconnectInputRef}
                  type="text"
                  value={disconnectInput}
                  disabled={isDisconnecting}
                  onChange={(e) => handleDisconnectInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t.connectServer.disconnectConfirmPlaceholder}
                  aria-label={t.connectServer.disconnectConfirmInputAria}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500/75 transition-colors disabled:opacity-60"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={isDisconnecting}
                    onClick={() => {
                      setDisconnectBoxOpen(false);
                      setDisconnectInput('');
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-45"
                  >
                    {t.common.cancel}
                  </button>

                  {isDisconnecting && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                      {t.connectServer.disconnectingAction}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isConnected ? (
          <button
            type="submit"
            disabled={isSyncing}
            className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
              variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
            }`}
          >
            {isSyncing && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {isSyncing
                ? t.connectServer.syncingAction
                : t.connectServer.syncAction}
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isDisconnecting}
            onClick={handleOpenDisconnectBox}
            className={`w-full rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40 ${
              variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
            }`}
          >
            {isDisconnecting && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {isDisconnecting
                ? t.connectServer.disconnectingAction
                : t.connectServer.disconnectAction}
            </span>
          </button>
        )}
      </div>
    </form>
  );
}
