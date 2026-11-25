import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface ServerSecretHelpViewProps {
  secretKey: string;
  variant: 'desktop' | 'mobile';
}

const WEBHOOK_VAR_NAME = 'SEARCHLINK_WEBHOOK_SECRET';

export function ServerSecretHelpView({
  secretKey,
  variant,
}: ServerSecretHelpViewProps) {
  const { t } = useI18n();
  const providers = t.connectServer.secretHelpProviders;
  const [activeProviderId, setActiveProviderId] = useState(
    () => providers[0]?.id || 'render',
  );
  const [varCopied, setVarCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const activeProvider =
    providers.find((provider) => provider.id === activeProviderId) ?? providers[0];

  const handleCopyText = async (
    value: string,
    setCopied: (next: boolean) => void,
  ) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';
  const iconButtonClass =
    variant === 'desktop'
      ? 'w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
      <div className="max-w-2xl space-y-8">
        {/* 1. Purpose of the Secret Key */}
        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpWhyTitle}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-slate-600">
            {t.connectServer.secretHelpWhyBody}
          </p>
        </section>

        {/* 2. Universal Rule: Variable Name + Secret Key */}
        <section className="pt-7 border-t border-slate-200/75 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
              {t.connectServer.secretHelpVarRuleTitle}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-slate-600">
              {t.connectServer.secretHelpVarRuleBody}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/75 divide-y divide-slate-200/75">
            {/* Variable Name */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">
                  {t.connectServer.secretHelpVarNameLabel}
                </p>
                <p className="font-mono text-[13px] font-semibold text-slate-950 mt-0.5 select-all truncate">
                  {WEBHOOK_VAR_NAME}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyText(WEBHOOK_VAR_NAME, setVarCopied)}
                aria-label={t.connectServer.secretHelpCopyVarAria}
                title={varCopied ? t.common.copied : t.common.copy}
                className={iconButtonClass}
              >
                {varCopied ? (
                  <Check
                    className="w-4 h-4 text-emerald-600 stroke-[2.4]"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Variable Value (Secret Key) */}
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500">
                  {t.connectServer.secretHelpVarValueLabel}
                </p>
                <input
                  type={showKey ? 'text' : 'password'}
                  readOnly
                  value={secretKey}
                  aria-label={t.connectServer.secretKeyAria}
                  className="w-full bg-transparent font-mono text-[12.5px] text-slate-900 mt-0.5 focus:outline-none select-all"
                />
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  aria-label={
                    showKey
                      ? t.connectServer.hideSecretAria
                      : t.connectServer.showSecretAria
                  }
                  title={
                    showKey
                      ? t.connectServer.hideSecretAria
                      : t.connectServer.showSecretAria
                  }
                  className={iconButtonClass}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyText(secretKey, setKeyCopied)}
                  aria-label={t.connectServer.copySecretAria}
                  title={keyCopied ? t.common.copiedFem : t.common.copy}
                  className={iconButtonClass}
                >
                  {keyCopied ? (
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
          </div>
        </section>

        {/* 3. Hosting Provider Instructions */}
        <section className="pt-7 border-t border-slate-200/75 space-y-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpProvidersTitle}
          </h2>

          <div
            role="tablist"
            aria-label={t.connectServer.secretHelpProvidersTitle}
            className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 overflow-x-auto no-scrollbar"
          >
            {providers.map((provider) => {
              const isSelected = provider.id === activeProvider?.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveProviderId(provider.id)}
                  className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    isSelected
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {provider.name}
                </button>
              );
            })}
          </div>

          {activeProvider && (
            <ol
              role="tabpanel"
              className="divide-y divide-slate-200/70 border-t border-slate-200/70"
            >
              {activeProvider.steps.map((step, index) => (
                <li
                  key={`${activeProvider.id}-step-${index}`}
                  className="py-3 flex items-start gap-3"
                >
                  <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums shrink-0 pt-0.5">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-slate-700">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 4. Final Step: Paste URL and Sync */}
        <section className="pt-7 border-t border-slate-200/75 space-y-2 pb-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpFinalStepTitle}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-slate-600">
            {t.connectServer.secretHelpFinalStepBody}
          </p>
        </section>
      </div>
    </div>
  );
}
