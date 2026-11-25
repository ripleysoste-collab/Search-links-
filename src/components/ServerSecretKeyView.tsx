import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  AGENCY_SYNC_UPDATED_EVENT,
  dispatchAgencySecretRotate,
  loadAgencyConnectionState,
  type AgencyConnectionState,
} from '../lib/agencySyncClient';
import { useI18n } from '../lib/i18n';

interface ServerSecretKeyViewProps {
  userId: string;
  variant: 'desktop' | 'mobile';
}

export function ServerSecretKeyView({
  userId,
  variant,
}: ServerSecretKeyViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const rotateInputRef = useRef<HTMLInputElement>(null);
  const rotatingGuardRef = useRef(false);

  const [connState, setConnState] = useState<AgencyConnectionState>(() =>
    loadAgencyConnectionState(userId),
  );
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotateInput, setRotateInput] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccessMessage, setRotateSuccessMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setConnState(loadAgencyConnectionState(userId));
    setShowSecretKey(false);
    setSecretCopied(false);
    setRotateConfirmOpen(false);
    setRotateInput('');
    setRotateError(null);
    setRotateSuccessMessage(null);
  }, [userId]);

  useEffect(() => {
    const handleSyncUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ userId?: string; state?: AgencyConnectionState }>
      ).detail;
      if (detail?.userId === userId && detail.state) {
        setConnState(detail.state);
      }
    };
    window.addEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
    return () =>
      window.removeEventListener(AGENCY_SYNC_UPDATED_EVENT, handleSyncUpdated);
  }, [userId]);

  useEffect(() => {
    if (!rotateConfirmOpen) return;
    const timer = window.setTimeout(() => {
      rotateInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [rotateConfirmOpen]);

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

  const handleOpenRotateConfirm = () => {
    if (isRotating) return;
    setRotateError(null);
    setRotateSuccessMessage(null);
    setRotateInput('');
    setRotateConfirmOpen((prev) => !prev);
  };

  const executeRotate = async () => {
    if (rotatingGuardRef.current || isRotating) return;
    rotatingGuardRef.current = true;
    setIsRotating(true);
    setRotateError(null);

    try {
      const result = await dispatchAgencySecretRotate(userId);
      if (!result.ok) {
        setRotateError(result.error || t.connectServer.rotateNetworkError);
        setRotateInput('');
        return;
      }

      setRotateConfirmOpen(false);
      setRotateInput('');
      setShowSecretKey(false);
      setSecretCopied(false);
      setRotateSuccessMessage(t.connectServer.rotateSuccess);
    } catch {
      setRotateError(t.connectServer.rotateNetworkError);
      setRotateInput('');
    } finally {
      rotatingGuardRef.current = false;
      setIsRotating(false);
    }
  };

  const handleRotateInputChange = (value: string) => {
    setRotateInput(value);
    if (rotateError) setRotateError(null);
    const normalizedTyped = value.trim().toLowerCase();
    const normalizedExpected = t.connectServer.disconnectConfirmPhrase
      .trim()
      .toLowerCase();
    if (normalizedTyped === normalizedExpected && !isRotating) {
      void executeRotate();
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';
  const boxHeightClass = variant === 'desktop' ? 'py-2.5' : 'min-h-[46px] py-2';
  const iconButtonClass =
    variant === 'desktop'
      ? 'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <div
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-between gap-6`}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor={`dedicated-server-secret-${variant}`}
            className="block text-xs font-medium text-slate-950 mb-1.5"
          >
            {t.connectServer.secretKeyLabel}
          </label>
          <div
            className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1 px-3.5 ${boxHeightClass}`}
          >
            <input
              id={`dedicated-server-secret-${variant}`}
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

        {rotateError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {rotateError}
          </p>
        )}

        {rotateSuccessMessage && (
          <p
            role="status"
            className="flex items-start gap-2 text-xs font-medium text-emerald-700"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{rotateSuccessMessage}</span>
          </p>
        )}
      </div>

      {/* Bottom CTA & Auto-Confirm Inline Box */}
      <div className="pt-4 border-t border-slate-200/75 shrink-0 space-y-3.5">
        <AnimatePresence initial={false}>
          {rotateConfirmOpen && (
            <motion.div
              key="rotate-secret-confirm-box"
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
                  {t.connectServer.rotateConfirmPrompt}{' '}
                  <span className="font-semibold text-slate-950">
                    {t.connectServer.disconnectConfirmPhrase}
                  </span>
                </p>

                <input
                  ref={rotateInputRef}
                  type="text"
                  value={rotateInput}
                  disabled={isRotating}
                  onChange={(e) => handleRotateInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t.connectServer.disconnectConfirmPlaceholder}
                  aria-label={t.connectServer.rotateConfirmInputAria}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600/75 transition-colors disabled:opacity-60"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={isRotating}
                    onClick={() => {
                      setRotateConfirmOpen(false);
                      setRotateInput('');
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-45"
                  >
                    {t.common.cancel}
                  </button>

                  {isRotating && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600">
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                      {t.connectServer.rotatingKeyAction}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          disabled={isRotating}
          onClick={handleOpenRotateConfirm}
          className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
            variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
          }`}
        >
          {isRotating && (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          )}
          <span>
            {isRotating
              ? t.connectServer.rotatingKeyAction
              : t.connectServer.rotateKeyAction}
          </span>
        </button>
      </div>
    </div>
  );
}
