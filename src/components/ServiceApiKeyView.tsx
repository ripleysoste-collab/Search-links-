import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import { isRawCoreApiKey } from '../lib/searchLinkCore';
import { useI18n } from '../lib/i18n';

interface ServiceApiKeyViewProps {
  service: OrganizationServiceItem;
  variant: 'desktop' | 'mobile';
  onRotateServiceKey?: (serviceId: string) => Promise<string | null>;
  onToggleServiceActive?: (serviceId: string, nextActive: boolean) => Promise<void>;
}

export function ServiceApiKeyView({
  service,
  variant,
  onRotateServiceKey,
  onToggleServiceActive,
}: ServiceApiKeyViewProps) {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);

  useEffect(() => {
    setShowApiKey(false);
    setCopied(false);
    setIsRotating(false);
    setTogglingStatus(false);
    setRotateError(null);
    setRotateSuccess(null);
  }, [service.id]);

  const rawApiKeyAvailable = isRawCoreApiKey(service.apiKey);
  const displayedValue = rawApiKeyAvailable
    ? service.apiKey
    : service.keyPrefix || service.apiKey;
  const serviceIsActive = service.isActive !== false;

  const handleCopy = async () => {
    if (!rawApiKeyAvailable) return;
    try {
      await navigator.clipboard.writeText(service.apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handleRotate = async () => {
    if (!onRotateServiceKey || isRotating) return;
    setIsRotating(true);
    setRotateError(null);
    setRotateSuccess(null);
    try {
      const nextKey = await onRotateServiceKey(service.id);
      if (nextKey) {
        setCopied(false);
        setRotateSuccess(t.org.rotateSuccessMsg);
      } else {
        setRotateError(t.org.rotateErrorMsg);
      }
    } catch {
      setRotateError(t.org.rotateErrorMsg);
    } finally {
      setIsRotating(false);
    }
  };

  const handleToggleActive = async () => {
    if (!onToggleServiceActive || togglingStatus) return;
    setTogglingStatus(true);
    try {
      await onToggleServiceActive(service.id, !serviceIsActive);
    } finally {
      setTogglingStatus(false);
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
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-sm font-semibold text-slate-950 truncate">
            {service.name}
          </p>
          <span className="text-[11px] font-medium text-slate-400 shrink-0">
            Search Link Core
          </span>
        </div>

        <div>
          <label
            htmlFor={`service-api-key-${variant}-${service.id}`}
            className="block text-xs font-medium text-slate-950 mb-1.5"
          >
            {t.org.apiKeyFieldLabel}
          </label>
          <div
            className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1 px-3.5 ${boxHeightClass}`}
          >
            <input
              id={`service-api-key-${variant}-${service.id}`}
              type={showApiKey ? 'text' : 'password'}
              readOnly
              value={displayedValue}
              aria-label={t.org.apiKeyFieldLabel}
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent font-mono text-xs tracking-wide text-slate-800 focus:outline-none select-all"
            />

            <button
              type="button"
              onClick={() => setShowApiKey((prev) => !prev)}
              aria-label={
                showApiKey ? t.org.hideApiKeyAria : t.org.showApiKeyAria
              }
              title={showApiKey ? t.org.hideApiKeyAria : t.org.showApiKeyAria}
              className={iconButtonClass}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {rawApiKeyAvailable && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                aria-label={t.org.copyApiKeyAria}
                title={copied ? t.common.copiedFem : t.common.copy}
                className={iconButtonClass}
              >
                {copied ? (
                  <Check
                    className="w-4 h-4 text-emerald-600 stroke-[2.4]"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {rawApiKeyAvailable
            ? t.org.apiHintRaw
            : variant === 'desktop'
              ? t.org.apiHintPrefixDesktop
              : t.org.apiHintPrefixMobile}
        </p>

        {onToggleServiceActive && (
          <div className="pt-1">
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
          </div>
        )}

        {rotateError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {rotateError}
          </p>
        )}

        {rotateSuccess && (
          <p
            role="status"
            className="flex items-start gap-2 text-xs font-medium text-emerald-700"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{rotateSuccess}</span>
          </p>
        )}
      </div>

      {onRotateServiceKey && (
        <div className="pt-4 border-t border-slate-200/75 shrink-0">
          <button
            type="button"
            disabled={isRotating}
            onClick={() => void handleRotate()}
            className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
              variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
            }`}
          >
            {isRotating && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>{isRotating ? t.org.rotatingBtn : t.org.rotateBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
}
