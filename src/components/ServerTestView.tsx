import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
} from 'lucide-react';
import {
  dispatchAgencyServerTest,
  type AgencyServerTestItem,
  type ExecuteAgencyTestCallResult,
} from '../lib/agencySyncClient';
import { useI18n } from '../lib/i18n';

interface ServerTestViewProps {
  serverUrl: string;
  variant: 'desktop' | 'mobile';
  onClose: () => void;
}

export function ServerTestView({
  serverUrl,
  variant,
  onClose,
}: ServerTestViewProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<'confirm' | 'loading' | 'result'>('confirm');
  const [result, setResult] = useState<ExecuteAgencyTestCallResult | null>(null);
  const [brokenImageKeys, setBrokenImageKeys] = useState<Set<string>>(() => new Set());
  const [catalogApiKey, setCatalogApiKey] = useState('');
  const [showCatalogApiKey, setShowCatalogApiKey] = useState(false);

  const runServerEvaluation = async () => {
    setStep('loading');
    setBrokenImageKeys(new Set());
    try {
      const response = await dispatchAgencyServerTest(serverUrl, catalogApiKey);
      setResult(response);
      setStep('result');
    } catch {
      setResult({
        ok: false,
        error: t.connectServer.disconnectNetworkError,
      });
      setStep('result');
    }
  };

  const renderCatalogKeyField = (fieldIdSuffix: string) => (
    <div>
      <label
        htmlFor={`server-test-catalog-key-${variant}-${fieldIdSuffix}`}
        className="block text-[11.5px] font-medium text-slate-600 mb-1.5"
      >
        {t.connectServer.testCatalogKeyLabel}
      </label>
      <div
        className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1.5 px-3.5 focus-within:border-blue-500/75 focus-within:bg-white transition-colors ${
          variant === 'mobile' ? 'min-h-[46px]' : 'h-10'
        }`}
      >
        <input
          id={`server-test-catalog-key-${variant}-${fieldIdSuffix}`}
          type={showCatalogApiKey ? 'text' : 'password'}
          value={catalogApiKey}
          onChange={(e) => setCatalogApiKey(e.target.value)}
          placeholder={t.connectServer.testCatalogKeyPlaceholder}
          aria-label={t.connectServer.testCatalogKeyAria}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowCatalogApiKey((prev) => !prev)}
          aria-label={
            showCatalogApiKey
              ? t.connectServer.testHideCatalogKeyAria
              : t.connectServer.testShowCatalogKeyAria
          }
          title={
            showCatalogApiKey
              ? t.connectServer.testHideCatalogKeyAria
              : t.connectServer.testShowCatalogKeyAria
          }
          className={`${
            variant === 'mobile' ? 'min-w-[44px] min-h-[44px]' : 'w-8 h-8'
          } rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
        >
          {showCatalogApiKey ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';

  if (step === 'confirm') {
    return (
      <div
        className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-center`}
      >
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="text-2xl leading-none select-none shrink-0 mt-0.5"
            >
              🤝
            </span>
            <p className="text-[15px] leading-relaxed font-medium text-slate-900">
              {t.connectServer.testConsentPrompt}
            </p>
          </div>

          {renderCatalogKeyField('confirm')}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                variant === 'mobile' ? 'min-h-[44px]' : 'py-2.5'
              }`}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => void runServerEvaluation()}
              className={`px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-xs font-semibold text-white transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
                variant === 'mobile' ? 'min-h-[44px]' : 'py-2.5'
              }`}
            >
              {t.common.accept}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div
        className={`flex-1 min-h-0 bg-white ${containerPadding} flex flex-col items-center justify-center gap-3`}
      >
        <Loader2
          className="w-6 h-6 text-blue-600 animate-spin"
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-slate-600">
          {t.connectServer.testRunningLabel}
        </p>
      </div>
    );
  }

  const items: AgencyServerTestItem[] = result?.items ?? [];
  const imageItems = items.filter((item) => Boolean(item.imagen_url));
  const displayItems = imageItems.length > 0 ? imageItems : items;
  const httpStatus = result?.remoteStatus ?? (result?.ok ? 200 : undefined);
  const httpLabel = httpStatus
    ? `${httpStatus}${result?.statusText ? ` ${result.statusText}` : result?.ok ? ' OK' : ''}`
    : 'Error';

  return (
    <div
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-between gap-6`}
    >
      <div className="space-y-4">
        {!result?.ok ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-start gap-2.5">
              <div className="inline-flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold">{httpLabel}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">
                {result?.error || t.connectServer.disconnectNetworkError}
              </p>
            </div>
            {(result?.remoteStatus === 401 || result?.remoteStatus === 403) && (
              <div className="max-w-md pt-1">{renderCatalogKeyField('retry')}</div>
            )}
          </div>
        ) : displayItems.length === 0 ? (
          <p className="py-8 text-xs leading-relaxed text-slate-600">
            {t.connectServer.testEmptyCatalogNote}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {displayItems.map((item, idx) => {
              const cardKey = `${item.id}-${idx}`;
              const isBroken = !item.imagen_url || brokenImageKeys.has(cardKey);
              return (
                <div key={cardKey} className="min-w-0">
                  <div className="aspect-square w-full rounded-2xl border border-slate-200/80 bg-slate-50 overflow-hidden flex items-center justify-center">
                    {!isBroken ? (
                      <img
                        src={item.imagen_url}
                        alt={item.nombre}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={() => {
                          setBrokenImageKeys((prev) => {
                            const next = new Set(prev);
                            next.add(cardKey);
                            return next;
                          });
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100/80 text-slate-400">
                        <ImageOff className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-900 leading-snug line-clamp-2 break-words">
                    {item.nombre}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom real HTTP status & latency footer below the last images */}
      <div className="pt-4 border-t border-slate-200/75 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold ${
              result?.ok ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {result?.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {t.connectServer.testStatusLabel}: {httpLabel}
            </span>
          </span>

          {typeof result?.durationMs === 'number' && (
            <span className="tabular-nums text-slate-500">
              {t.connectServer.testLatencyLabel}:{' '}
              <span className="font-medium text-slate-900">
                {result.durationMs} ms
              </span>
            </span>
          )}

          {result?.ok && (
            <span className="tabular-nums text-slate-500">
              {t.connectServer.testImagesCountLabel}:{' '}
              <span className="font-medium text-slate-900">
                {imageItems.length}
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void runServerEvaluation()}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline"
        >
          {t.connectServer.testRetryAction}
        </button>
      </div>
    </div>
  );
}
