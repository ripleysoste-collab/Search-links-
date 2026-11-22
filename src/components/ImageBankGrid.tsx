import { Bookmark, Check, Loader2, X } from 'lucide-react';
import type { ImageBankImageItem } from '../lib/imageBankClient';
import { useI18n } from '../lib/i18n';

interface ImageBankResultsGridProps {
  items: ImageBankImageItem[];
  savedIds: Set<string>;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  onToggleSave: (item: ImageBankImageItem) => void;
  variant: 'desktop' | 'mobile';
}

export function ImageBankResultsGrid({
  items,
  savedIds,
  isSearching,
  hasSearched,
  error,
  onToggleSave,
  variant,
}: ImageBankResultsGridProps) {
  const { t } = useI18n();

  if (isSearching) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ${
            variant === 'desktop'
              ? 'bg-white/90 text-slate-900 shadow-sm'
              : 'bg-white/80 text-slate-900 border border-slate-200/80 shadow-sm'
          }`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <span>{t.imageBank.searchingAria}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className={`mt-4 px-3 py-2 rounded-xl text-xs font-medium text-center ${
          variant === 'desktop'
            ? 'bg-white/90 text-rose-600 shadow-sm'
            : 'text-rose-600'
        }`}
      >
        {error}
      </p>
    );
  }

  if (hasSearched && items.length === 0) {
    return (
      <p
        role="status"
        className={`mt-6 px-4 py-2.5 rounded-2xl text-xs font-medium text-center ${
          variant === 'desktop'
            ? 'bg-white/88 text-slate-900 shadow-sm'
            : 'text-slate-700'
        }`}
      >
        {t.imageBank.noResultsNotice}
      </p>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={
        variant === 'desktop'
          ? 'grid grid-cols-2 xl:grid-cols-3 gap-3'
          : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5'
      }
    >
      {items.map((item) => {
        const isSaved = savedIds.has(item.id);
        return (
          <div
            key={item.id}
            className="group relative rounded-2xl overflow-hidden bg-slate-100 border border-white/60 shadow-[0_6px_20px_-8px_rgba(15,23,42,0.24)]"
          >
            <button
              type="button"
              onClick={() => onToggleSave(item)}
              aria-pressed={isSaved}
              aria-label={
                isSaved
                  ? t.imageBank.unsaveImageAria(item.alt)
                  : t.imageBank.saveImageAria(item.alt)
              }
              className="block w-full aspect-[4/3] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <img
                src={item.previewUrl}
                alt={item.alt}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span
                aria-hidden="true"
                className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shadow-sm ${
                  isSaved
                    ? 'bg-slate-950 text-white scale-100'
                    : 'bg-white/85 text-slate-700 opacity-90 group-hover:opacity-100'
                }`}
              >
                {isSaved ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            <div className="px-2.5 py-1.5 bg-white/95 backdrop-blur-sm flex items-center justify-between gap-2 text-[10px] text-slate-600">
              <span className="truncate font-medium text-slate-800">
                {item.author}
              </span>
              <a
                href={item.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-600 hover:underline capitalize font-medium"
              >
                {item.provider}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ImageBankSavedGridProps {
  items: ImageBankImageItem[];
  onRemove: (id: string) => void;
}

export function ImageBankSavedGrid({
  items,
  onRemove,
}: ImageBankSavedGridProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center">
        <div className="max-w-xs">
          <Bookmark
            className="w-5 h-5 text-slate-400 mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            {t.imageBank.savedEmptyHint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.14)]"
        >
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={item.previewUrl}
              alt={item.alt}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={t.imageBank.removeSavedAria(item.alt)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600 shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <div className="px-2.5 py-1.5 bg-white flex items-center justify-between gap-2 text-[10px] text-slate-600 border-t border-slate-100">
            <span className="truncate font-medium text-slate-800">
              {item.author}
            </span>
            <a
              href={item.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-blue-600 hover:underline capitalize font-medium"
            >
              {item.provider}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
