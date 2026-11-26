import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  AGENCY_UPDATES_UPDATED_EVENT,
  loadAgencyServerUpdates,
  type AgencyServerUpdateRecord,
} from '../lib/agencySyncClient';
import {
  LIGHT_TOKEN_CLASSES,
  MobileJsonEditorModal,
  tokenizeJsonLine,
} from './MobileJsonEditorModal';
import { useI18n, type SupportedLocale, type TranslationDictionary } from '../lib/i18n';

interface ServerUpdatesViewProps {
  userId: string;
  variant: 'desktop' | 'mobile';
  selectedUpdate?: AgencyServerUpdateRecord | null;
  onSelectUpdate?: (update: AgencyServerUpdateRecord | null) => void;
}

function getDateLocaleTag(locale: SupportedLocale): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'pt') return 'pt-BR';
  return 'es-ES';
}

export function formatAgencyUpdateDate(
  iso: string,
  locale: SupportedLocale,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(getDateLocaleTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatAgencyUpdateTitle(
  record: AgencyServerUpdateRecord,
  t: TranslationDictionary,
): string {
  const firstServiceName = record.serviceNames[0];
  if (record.eventType === 'service.created') {
    return t.connectServer.updatesTitleServiceCreated(firstServiceName);
  }
  if (record.eventType === 'service.updated') {
    return t.connectServer.updatesTitleServiceUpdated(firstServiceName);
  }
  if (record.eventType === 'resync') {
    return t.connectServer.updatesTitleResync;
  }
  if (record.serviceScope === 'new') {
    return t.connectServer.updatesTitleNewHandshake;
  }
  if (record.serviceScope === 'all') {
    return t.connectServer.updatesTitleManualAll;
  }
  return t.connectServer.updatesTitleManualSingle(firstServiceName);
}

function buildPayloadPreviewLines(payloadJson: string): string {
  const lines = payloadJson
    .split('\n')
    .slice(0, 4)
    .map((line) => (line.length > 92 ? `${line.slice(0, 91)}…` : line));
  return lines.join('\n');
}

export function ServerUpdatesView({
  userId,
  variant,
  selectedUpdate: controlledSelectedUpdate,
  onSelectUpdate,
}: ServerUpdatesViewProps) {
  const { locale, t } = useI18n();
  const [updates, setUpdates] = useState<AgencyServerUpdateRecord[]>(() =>
    loadAgencyServerUpdates(userId),
  );
  const [internalSelectedUpdate, setInternalSelectedUpdate] =
    useState<AgencyServerUpdateRecord | null>(null);

  const activeSelectedUpdate =
    controlledSelectedUpdate !== undefined
      ? controlledSelectedUpdate
      : internalSelectedUpdate;

  const setActiveSelectedUpdate = (next: AgencyServerUpdateRecord | null) => {
    if (onSelectUpdate) {
      onSelectUpdate(next);
    } else {
      setInternalSelectedUpdate(next);
    }
  };

  useEffect(() => {
    setUpdates(loadAgencyServerUpdates(userId));
    const handleUpdatesChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          userId?: string;
          updates?: AgencyServerUpdateRecord[];
        }>
      ).detail;
      if (detail?.userId === userId && Array.isArray(detail.updates)) {
        setUpdates(detail.updates);
      }
    };
    window.addEventListener(AGENCY_UPDATES_UPDATED_EVENT, handleUpdatesChanged);
    return () =>
      window.removeEventListener(
        AGENCY_UPDATES_UPDATED_EVENT,
        handleUpdatesChanged,
      );
  }, [userId]);

  const tokenizedSelectedLines = useMemo(() => {
    if (variant !== 'desktop' || !activeSelectedUpdate) return [];
    return activeSelectedUpdate.payloadJson
      .split('\n')
      .map((line) => tokenizeJsonLine(line));
  }, [variant, activeSelectedUpdate]);

  useEffect(() => {
    if (variant !== 'desktop' || !activeSelectedUpdate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveSelectedUpdate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variant, activeSelectedUpdate]);

  if (variant === 'desktop' && activeSelectedUpdate) {
    return (
      <div className="flex-1 min-h-0 bg-white flex flex-col">
        <div
          aria-readonly="true"
          className="flex-1 min-h-0 overflow-auto py-4 px-4 font-mono text-[12px] leading-[1.65] select-text"
        >
          <div className="min-w-max">
            {tokenizedSelectedLines.map((tokens, idx) => (
              <div
                key={`desktop-update-line-${idx}`}
                className="flex items-start px-1.5 hover:bg-slate-50/75"
              >
                <span
                  aria-hidden="true"
                  className="w-8 pr-3 text-right text-[11px] text-slate-300 select-none shrink-0 tabular-nums"
                >
                  {idx + 1}
                </span>
                <pre className="whitespace-pre font-mono">
                  {tokens.length === 0 ? (
                    <span>{' '}</span>
                  ) : (
                    tokens.map((tok, tIdx) => (
                      <span
                        key={`desktop-update-tok-${idx}-${tIdx}`}
                        className={LIGHT_TOKEN_CLASSES[tok.type]}
                      >
                        {tok.text}
                      </span>
                    ))
                  )}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const containerPadding = variant === 'desktop' ? 'px-8 py-4' : 'px-5 py-2';

  return (
    <>
      <div
        className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col`}
      >
        {updates.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center">
            <p className="text-sm text-slate-500">
              {t.connectServer.updatesEmptyText}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/80">
            {updates.map((record) => {
              const title = formatAgencyUpdateTitle(record, t);
              const formattedDate = formatAgencyUpdateDate(
                record.syncedAt,
                locale,
              );
              const previewText = buildPayloadPreviewLines(record.payloadJson);

              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSelectedUpdate(record)}
                    aria-label={t.connectServer.updatesOpenItemAria(
                      title,
                      formattedDate,
                    )}
                    className={`w-full text-left py-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-slate-50 ${
                      variant === 'mobile' ? 'min-h-[64px]' : ''
                    }`}
                  >
                    <p className="text-[14px] font-semibold text-slate-950 leading-snug truncate">
                      {title}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {formattedDate}
                    </p>
                    <pre className="mt-2 font-mono text-[11.5px] leading-[1.55] text-slate-500 whitespace-pre-wrap break-all overflow-hidden">
                      {previewText}
                    </pre>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Mobile full-screen white read-only syntax-highlighted payload editor */}
      <AnimatePresence>
        {variant === 'mobile' && activeSelectedUpdate && (
          <MobileJsonEditorModal
            jsonText={activeSelectedUpdate.payloadJson}
            ariaLabel={t.connectServer.updatesEditorAria}
            copyAria={t.connectServer.updatesCopyPayloadAria}
            copyTitle={t.common.copy}
            closeAria={t.connectServer.updatesBackToListAria}
            onClose={() => setActiveSelectedUpdate(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
