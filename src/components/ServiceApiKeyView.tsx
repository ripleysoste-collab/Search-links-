import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import { isRawCoreApiKey } from '../lib/searchLinkCore';
import { useI18n } from '../lib/i18n';

interface ServiceApiKeyViewProps {
  service: OrganizationServiceItem;
  variant: 'desktop' | 'mobile';
  onRotateServiceKey?: (serviceId: string) => Promise<string | null>;
  onOpenHelp?: () => void;
}

export function ServiceApiKeyView({
  service,
  variant,
  onRotateServiceKey,
  onOpenHelp,
}: ServiceApiKeyViewProps) {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);

  useEffect(() => {
    setShowApiKey(false);
    setCopied(false);
    setIsRotating(false);
    setRotateError(null);
    setRotateSuccess(null);
  }, [service.id]);

  const rawApiKeyAvailable = isRawCoreApiKey(service.apiKey);
  const displayedValue = rawApiKeyAvailable
    ? service.apiKey
    : service.keyPrefix || service.apiKey;

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
      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
          {service.name}
        </h2>

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

        {onOpenHelp && (
          <div>
            <button
              type="button"
              onClick={onOpenHelp}
              className={`inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 rounded ${
                variant === 'mobile' ? 'min-h-[36px]' : 'py-0.5'
              }`}
            >
              {t.org.apiHelpLink}
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
