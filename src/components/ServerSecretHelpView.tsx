import { useI18n } from '../lib/i18n';

interface ServerSecretHelpViewProps {
  variant: 'desktop' | 'mobile';
}

const WEBHOOK_VAR_NAME = 'SEARCHLINK_WEBHOOK_SECRET';

export function ServerSecretHelpView({ variant }: ServerSecretHelpViewProps) {
  const { t } = useI18n();
  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';

  return (
    <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
      <div className="max-w-2xl space-y-6 text-[13.5px] leading-relaxed text-slate-700">
        {/* 1. Purpose of the Secret Key */}
        <section className="space-y-1.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpWhyTitle}
          </h2>
          <p>{t.connectServer.secretHelpWhyBody}</p>
        </section>

        {/* 2. Variable Name & Fictional Example */}
        <section className="pt-5 border-t border-slate-200/70 space-y-2.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpVarRuleTitle}
          </h2>
          <p>{t.connectServer.secretHelpVarRuleBody}</p>

          <div className="space-y-1 pt-1 text-[13px]">
            <p className="text-slate-600">
              <span className="font-medium text-slate-900">
                {t.connectServer.secretHelpVarNameLabel}
              </span>{' '}
              <span className="font-mono font-semibold text-slate-950 select-all">
                {WEBHOOK_VAR_NAME}
              </span>
            </p>
            <p className="text-slate-600 break-all">
              <span className="font-medium text-slate-900">
                {t.connectServer.secretHelpExampleValueLabel}
              </span>{' '}
              <span className="font-mono text-slate-800">
                {t.connectServer.secretHelpExampleValue}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              {t.connectServer.secretHelpExampleHint}
            </p>
          </div>
        </section>

        {/* 3. Plain-text Guide by Hosting Provider */}
        <section className="pt-5 border-t border-slate-200/70 space-y-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpProvidersTitle}
          </h2>

          <div className="space-y-5">
            {t.connectServer.secretHelpProviders.map((provider) => (
              <div key={provider.id} className="space-y-1.5">
                <h3 className="text-[13.5px] font-semibold text-slate-950">
                  {provider.name}
                </h3>
                <ol className="space-y-1 text-[13px] text-slate-600">
                  {provider.steps.map((step, index) => (
                    <li key={`${provider.id}-step-${index}`}>
                      <span className="font-medium text-slate-500 tabular-nums mr-1.5">
                        {index + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Final Step */}
        <section className="pt-5 border-t border-slate-200/70 space-y-1.5 pb-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.connectServer.secretHelpFinalStepTitle}
          </h2>
          <p>{t.connectServer.secretHelpFinalStepBody}</p>
        </section>
      </div>
    </div>
  );
}
