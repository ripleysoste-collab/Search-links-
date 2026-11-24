import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export type AdvancedActionKey =
  | 'r2-delete'
  | 'clear-browser'
  | 'delete-account'
  | 'pause-apis';

interface AdvancedSettingsViewProps {
  variant: 'desktop' | 'mobile';
  hasR2Images: boolean;
  hasPausedApis: boolean;
  onPurgeAllR2: () => Promise<{ deletedR2Count: number }>;
  onClearBrowserData: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onPauseAllApis: () => Promise<{ pausedServicesCount: number }>;
  onUnfreezeAllApis: () => Promise<{ unfrozenServicesCount: number }>;
}

export function AdvancedSettingsView({
  variant,
  hasR2Images,
  hasPausedApis,
  onPurgeAllR2,
  onClearBrowserData,
  onDeleteAccount,
  onPauseAllApis,
  onUnfreezeAllApis,
}: AdvancedSettingsViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  const [pendingAction, setPendingAction] = useState<AdvancedActionKey | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isUnfreezing, setIsUnfreezing] = useState(false);
  const [showEmptyR2Notice, setShowEmptyR2Notice] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isPaused = pendingAction !== null;

  const actions: Array<{
    key: AdvancedActionKey;
    title: string;
    buttonLabel: string;
    confirmText: string;
  }> = [
    {
      key: 'r2-delete',
      title: t.advancedSettings.r2DeleteTitle,
      buttonLabel: t.advancedSettings.r2DeleteButton,
      confirmText: t.advancedSettings.r2DeleteConfirmText,
    },
    {
      key: 'clear-browser',
      title: t.advancedSettings.clearBrowserDataTitle,
      buttonLabel: t.advancedSettings.clearBrowserDataButton,
      confirmText: t.advancedSettings.clearBrowserDataConfirmText,
    },
    {
      key: 'delete-account',
      title: t.advancedSettings.deleteAccountTitle,
      buttonLabel: t.advancedSettings.deleteAccountButton,
      confirmText: t.advancedSettings.deleteAccountConfirmText,
    },
    {
      key: 'pause-apis',
      title: t.advancedSettings.pauseAllApisTitle,
      buttonLabel: t.advancedSettings.pauseAllApisButton,
      confirmText: t.advancedSettings.pauseAllApisConfirmText,
    },
  ];

  const activeConfig =
    actions.find((item) => item.key === pendingAction) ?? null;

  const handleRequestAction = (key: AdvancedActionKey) => {
    if (isPaused || isExecuting || isUnfreezing) return;
    setActionFeedback(null);
    if (key === 'r2-delete' && !hasR2Images) {
      setShowEmptyR2Notice(true);
      return;
    }
    setShowEmptyR2Notice(false);
    setPendingAction(key);
  };

  const handleCancelInline = () => {
    if (isExecuting) return;
    setPendingAction(null);
    setActionFeedback(null);
  };

  const handleAcceptInline = async () => {
    if (!pendingAction || isExecuting) return;
    const actionKey = pendingAction;
    setIsExecuting(true);
    setActionFeedback(null);

    try {
      if (actionKey === 'r2-delete') {
        const res = await onPurgeAllR2();
        setPendingAction(null);
        setActionFeedback({
          type: 'success',
          text: t.advancedSettings.r2PurgeSuccess(res.deletedR2Count),
        });
      } else if (actionKey === 'pause-apis') {
        const res = await onPauseAllApis();
        setPendingAction(null);
        setActionFeedback({
          type: 'success',
          text: t.advancedSettings.pauseApisSuccess(res.pausedServicesCount),
        });
      } else if (actionKey === 'clear-browser') {
        await onClearBrowserData();
        setPendingAction(null);
      } else if (actionKey === 'delete-account') {
        await onDeleteAccount();
        setPendingAction(null);
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.trim()
          ? err.message
          : t.advancedSettings.actionErrorFallback;
      setActionFeedback({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUnfreezeAllApis = async () => {
    if (isPaused || isExecuting || isUnfreezing) return;
    setIsUnfreezing(true);
    setShowEmptyR2Notice(false);
    setActionFeedback(null);

    try {
      const res = await onUnfreezeAllApis();
      setActionFeedback({
        type: 'success',
        text: t.advancedSettings.unfreezeApisSuccess(res.unfrozenServicesCount),
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message.trim()
          ? err.message
          : t.advancedSettings.actionErrorFallback;
      setActionFeedback({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsUnfreezing(false);
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';

  return (
    <div
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col`}
    >
      {/* Inline non-floating re-confirmation block directly above options when paused */}
      <AnimatePresence initial={false}>
        {activeConfig && (
          <motion.div
            key={`inline-confirm-${activeConfig.key}`}
            role="region"
            aria-label={t.advancedSettings.confirmPromptAria}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, height: 0, marginBottom: 0 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, height: 'auto', marginBottom: 20 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, height: 0, marginBottom: 0 }
            }
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-slate-200/80 pb-4"
          >
            <p className="text-[13px] leading-relaxed text-slate-900">
              {activeConfig.confirmText}
            </p>

            {actionFeedback?.type === 'error' && (
              <p className="mt-2 text-xs leading-relaxed text-rose-600">
                {actionFeedback.text}
              </p>
            )}

            <div className="mt-3 flex items-center gap-5">
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleCancelInline}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer disabled:opacity-45 disabled:cursor-default"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => void handleAcceptInline()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer disabled:opacity-60 disabled:cursor-default"
              >
                {isExecuting && (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                )}
                {t.common.accept}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {actionFeedback && !activeConfig && (
        <p
          className={`mb-4 text-xs leading-relaxed border-b border-slate-200/75 pb-3.5 ${
            actionFeedback.type === 'error' ? 'text-rose-600' : 'text-slate-700'
          }`}
        >
          {actionFeedback.text}
        </p>
      )}

      {/* Clean 4-option list — paused/dimmed while inline confirmation is open */}
      <div
        aria-disabled={isPaused}
        className={`divide-y divide-slate-200/75 transition-opacity duration-150 ${
          isPaused ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'
        }`}
      >
        {actions.map((item, idx) => (
          <div
            key={item.key}
            className={idx === 0 ? 'pb-5' : 'py-5'}
          >
            <p className="text-sm font-medium text-slate-950">
              {item.title}
            </p>
            <button
              type="button"
              disabled={isPaused || isUnfreezing}
              onClick={() => handleRequestAction(item.key)}
              className="mt-2.5 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer disabled:cursor-default"
            >
              {item.buttonLabel}
            </button>
            {item.key === 'r2-delete' && showEmptyR2Notice && !hasR2Images && (
              <p className="mt-2 text-xs text-rose-600">
                {t.advancedSettings.r2EmptyError}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Conditional recovery section — only shown if the user has paused APIs/services */}
      {hasPausedApis && (
        <div
          aria-disabled={isPaused}
          className={`mt-1 pt-5 border-t border-slate-200/80 transition-opacity duration-150 ${
            isPaused ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'
          }`}
        >
          <p className="text-xs font-semibold text-slate-500">
            {t.advancedSettings.thingsYouCanDoTitle}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-950">
            {t.advancedSettings.unfreezeApisSubtitle}
          </p>
          <button
            type="button"
            disabled={isPaused || isUnfreezing}
            onClick={() => void handleUnfreezeAllApis()}
            className="mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            {isUnfreezing && (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            )}
            {t.advancedSettings.unfreezeApisButton}
          </button>
        </div>
      )}
    </div>
  );
}
