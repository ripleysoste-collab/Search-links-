import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import {
  buildCoreCurlSnippet,
  isRawCoreApiKey,
  testCoreServiceEndpoint,
  type CoreEndpointTestResult,
} from '../lib/searchLinkCore';
import { useI18n } from '../lib/i18n';

interface ServiceEndpointTestViewProps {
  service: OrganizationServiceItem;
  variant: 'desktop' | 'mobile';
}

export function ServiceEndpointTestView({
  service,
  variant,
}: ServiceEndpointTestViewProps) {
  const { t } = useI18n();
  const [copiedTarget, setCopiedTarget] = useState<'endpoint' | 'curl' | null>(null);
  const [manualTestKey, setManualTestKey] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [endpointTestResult, setEndpointTestResult] =
    useState<CoreEndpointTestResult | null>(null);

  const rawApiKeyAvailable = isRawCoreApiKey(service.apiKey);

  useEffect(() => {
    setCopiedTarget(null);
    setShowManualKey(false);
    setTestingEndpoint(false);
    setEndpointTestResult(null);
    setManualTestKey(isRawCoreApiKey(service.apiKey) ? service.apiKey : '');
  }, [service.id]);

  useEffect(() => {
    if (rawApiKeyAvailable) {
      setManualTestKey(service.apiKey);
    }
  }, [rawApiKeyAvailable, service.apiKey]);

  const effectiveKey =
    manualTestKey.trim() || (rawApiKeyAvailable ? service.apiKey : '');
  const canRunTest = Boolean(effectiveKey);

  const handleCopy = async (text: string, target: 'endpoint' | 'curl') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1600);
    } catch {
      setCopiedTarget(null);
    }
  };

  const handleRunTest = async () => {
    if (!canRunTest || testingEndpoint) return;
    setTestingEndpoint(true);
    try {
      const result = await testCoreServiceEndpoint(
        service.endpointUrl,
        effectiveKey,
      );
      setEndpointTestResult(result);
    } finally {
      setTestingEndpoint(false);
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';
  const boxHeightClass = variant === 'desktop' ? 'py-2.5' : 'min-h-[46px] py-2';
  const iconButtonClass =
    variant === 'desktop'
      ? 'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  const httpStatusLabel = endpointTestResult
    ? endpointTestResult.status === 200
      ? 'HTTP 200 OK'
      : endpointTestResult.status > 0
        ? `HTTP ${endpointTestResult.status}`
        : 'HTTP ERR'
    : '';

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
            htmlFor={`service-endpoint-url-${variant}-${service.id}`}
            className="block text-xs font-medium text-slate-950 mb-1.5"
          >
            {t.org.endpointFieldLabel}
          </label>
          <div
            className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1.5 px-3.5 ${boxHeightClass}`}
          >
            <input
              id={`service-endpoint-url-${variant}-${service.id}`}
              type="text"
              readOnly
              value={service.endpointUrl}
              aria-label={t.org.endpointFieldLabel}
              className="flex-1 min-w-0 bg-transparent font-mono text-xs text-slate-800 focus:outline-none select-all"
            />
            <button
              type="button"
              onClick={() => void handleCopy(service.endpointUrl, 'endpoint')}
              aria-label={t.org.copyEndpointAria}
              title={copiedTarget === 'endpoint' ? t.common.copied : t.common.copy}
              className={iconButtonClass}
            >
              {copiedTarget === 'endpoint' ? (
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

        {!rawApiKeyAvailable && (
          <div>
            <label
              htmlFor={`service-endpoint-manual-key-${variant}-${service.id}`}
              className="block text-xs font-medium text-slate-950 mb-1.5"
            >
              {t.org.apiKeyFieldLabel}
            </label>
            <div
              className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1 px-3.5 focus-within:border-blue-500/75 focus-within:bg-white transition-colors ${boxHeightClass}`}
            >
              <input
                id={`service-endpoint-manual-key-${variant}-${service.id}`}
                type={showManualKey ? 'text' : 'password'}
                value={manualTestKey}
                onChange={(e) => setManualTestKey(e.target.value)}
                placeholder={t.org.pasteKeyPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent font-mono text-xs text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowManualKey((prev) => !prev)}
                aria-label={
                  showManualKey ? t.org.hideApiKeyAria : t.org.showApiKeyAria
                }
                className={iconButtonClass}
              >
                {showManualKey ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              void handleCopy(
                buildCoreCurlSnippet(
                  service.endpointUrl,
                  effectiveKey || service.apiKey,
                ),
                'curl',
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:underline"
          >
            {copiedTarget === 'curl' ? (
              <>
                <Check
                  className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]"
                  aria-hidden="true"
                />
                <span className="text-emerald-700">{t.org.curlCopied}</span>
              </>
            ) : (
              <span>
                {variant === 'desktop'
                  ? t.org.copyCurlDesktop
                  : t.org.copyCurlMobile}
              </span>
            )}
          </button>
        </div>

        {!canRunTest && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {t.org.missingKeyForTestNote}
          </p>
        )}

        {endpointTestResult && (
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium">
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  endpointTestResult.ok ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {endpointTestResult.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{httpStatusLabel}</span>
              </span>
              <span className="text-slate-500 tabular-nums">
                {endpointTestResult.latencyMs} ms
              </span>
            </div>

            <pre className="max-h-72 overflow-auto font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
              {endpointTestResult.rawJson}
            </pre>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200/75 shrink-0">
        <button
          type="button"
          disabled={testingEndpoint || !canRunTest}
          onClick={() => void handleRunTest()}
          className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
            variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
          }`}
        >
          {testingEndpoint && (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          )}
          <span>{testingEndpoint ? t.org.testingBtn : t.org.testBtn}</span>
        </button>
      </div>
    </div>
  );
}
