import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useI18n } from '../lib/i18n';

export type AdvancedActionKey =
  | 'r2-delete'
  | 'clear-browser'
  | 'delete-account'
  | 'pause-apis';

interface AdvancedSettingsViewProps {
  variant: 'desktop' | 'mobile';
}

export function AdvancedSettingsView({ variant }: AdvancedSettingsViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  const [pendingAction, setPendingAction] = useState<AdvancedActionKey | null>(null);
  const [step1Status, setStep1Status] = useState<string | null>(null);

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
    if (isPaused) return;
    setStep1Status(null);
    setPendingAction(key);
  };

  const handleCancelInline = () => {
    setPendingAction(null);
  };

  const handleAcceptInline = () => {
    if (!pendingAction) return;
    setPendingAction(null);
    setStep1Status(t.advancedSettings.step1PreviewNotice);
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
            <div className="mt-3 flex items-center gap-5">
              <button
                type="button"
                onClick={handleCancelInline}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleAcceptInline}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer"
              >
                {t.common.accept}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step1Status && !activeConfig && (
        <p className="mb-4 text-xs leading-relaxed text-slate-600 border-b border-slate-200/75 pb-3.5">
          {step1Status}
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
              disabled={isPaused}
              onClick={() => handleRequestAction(item.key)}
              className="mt-2.5 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer disabled:cursor-default"
            >
              {item.buttonLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
