import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import { isRawCoreApiKey } from '../lib/searchLinkCore';
import { useI18n } from '../lib/i18n';

interface ServiceApiHelpViewProps {
  service: OrganizationServiceItem;
  variant: 'desktop' | 'mobile';
  onToggleServiceActive?: (serviceId: string, nextActive: boolean) => Promise<void>;
}

export function ServiceApiHelpView({
  service,
  variant,
  onToggleServiceActive,
}: ServiceApiHelpViewProps) {
  const { t } = useI18n();
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    setTogglingStatus(false);
  }, [service.id]);

  const rawApiKeyAvailable = isRawCoreApiKey(service.apiKey);
  const serviceIsActive = service.isActive !== false;
  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';

  const handleToggleActive = async () => {
    if (!onToggleServiceActive || togglingStatus) return;
    setTogglingStatus(true);
    try {
      await onToggleServiceActive(service.id, !serviceIsActive);
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
      <div className="max-w-2xl space-y-6 text-[13.5px] leading-relaxed text-slate-700">
        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.org.apiHelpUseTitle}
          </h2>
          <p>{t.org.apiHelpUseBody}</p>
          <div className="space-y-1 pt-1 text-[13px]">
            <p className="text-xs font-medium text-slate-500">
              {t.org.apiHelpHeadersLabel}
            </p>
            <p className="font-mono text-slate-900 select-all">
              Authorization: Bearer &lt;API_KEY&gt;
            </p>
            <p className="font-mono text-slate-900 select-all">
              x-api-key: &lt;API_KEY&gt;
            </p>
          </div>
        </section>

        <section className="pt-5 border-t border-slate-200/70 space-y-1.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t.org.apiHelpSecurityTitle}
          </h2>
          <p>
            {rawApiKeyAvailable
              ? t.org.apiHelpSecurityBodyRaw
              : t.org.apiHelpSecurityBodyPrefixOnly}
          </p>
        </section>

        <section className="pt-5 border-t border-slate-200/70 space-y-3 pb-2">
          <div className="space-y-1.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
              {t.org.apiHelpStatusTitle}
            </h2>
            <p>{t.org.apiHelpStatusBody}</p>
          </div>

          {onToggleServiceActive && (
            <button
              type="button"
              disabled={togglingStatus}
              onClick={() => void handleToggleActive()}
              className={`inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                variant === 'mobile' ? 'min-h-[44px] px-3.5' : 'px-3 py-2'
              }`}
            >
              {togglingStatus ? (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    serviceIsActive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              )}
              <span>
                {serviceIsActive
                  ? variant === 'desktop'
                    ? t.org.serviceActiveDesktop
                    : t.org.serviceActiveMobile
                  : variant === 'desktop'
                    ? t.org.servicePausedDesktop
                    : t.org.servicePausedMobile}
              </span>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
