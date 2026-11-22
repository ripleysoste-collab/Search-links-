import { Bookmark, Check, Loader2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ImageBankImageItem } from '../lib/imageBankClient';
import { useI18n } from '../lib/i18n';

interface ImageBankResultsGridProps {
  items: ImageBankImageItem[];
  savedIds: Set<string>;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  onToggleSave: (item: ImageBankImageItem) => void;
  onGenerateAi: () => void;
  isGeneratingAi: boolean;
  generatedAiImage: ImageBankImageItem | null;
  variant: 'desktop' | 'mobile';
}

export function ImageBankResultsGrid({
  items,
  savedIds,
  isSearching,
  hasSearched,
  error,
  onToggleSave,
  onGenerateAi,
  isGeneratingAi,
  generatedAiImage,
  variant,
}: ImageBankResultsGridProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();

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

  if (!hasSearched && items.length === 0 && !generatedAiImage) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div
        className={
          variant === 'desktop'
            ? 'grid grid-cols-2 xl:grid-cols-3 gap-3'
            : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5'
        }
      >
        {generatedAiImage ? (
          <motion.div
            key={generatedAiImage.id}
            layout={!shouldReduceMotion}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0.85, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.34,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="col-span-2 group relative rounded-2xl overflow-hidden bg-slate-100 border border-white/75 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.28)]"
          >
            <button
              type="button"
              onClick={() => onToggleSave(generatedAiImage)}
              aria-pressed={savedIds.has(generatedAiImage.id)}
              aria-label={
                savedIds.has(generatedAiImage.id)
                  ? t.imageBank.unsaveImageAria(generatedAiImage.alt)
                  : t.imageBank.saveImageAria(generatedAiImage.alt)
              }
              className="block w-full aspect-[2/1] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <img
                src={generatedAiImage.previewUrl}
                alt={generatedAiImage.alt}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span
                aria-hidden="true"
                className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shadow-sm ${
                  savedIds.has(generatedAiImage.id)
                    ? 'bg-slate-950 text-white scale-100'
                    : 'bg-white/85 text-slate-700 opacity-90 group-hover:opacity-100'
                }`}
              >
                {savedIds.has(generatedAiImage.id) ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            <div className="px-3 py-1.5 bg-white/95 backdrop-blur-sm flex items-center justify-between gap-2 text-[10px] text-slate-600">
              <span className="truncate font-medium text-slate-800">
                {generatedAiImage.alt}
              </span>
              <span className="shrink-0 text-blue-600 font-semibold">
                {savedIds.has(generatedAiImage.id)
                  ? `${generatedAiImage.author} · ${t.imageBank.generatedAutoSavedBadge}`
                  : generatedAiImage.author}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="image-bank-generate-ai-tile"
            type="button"
            layout={!shouldReduceMotion}
            onClick={onGenerateAi}
            disabled={isGeneratingAi}
            aria-busy={isGeneratingAi}
            className="group relative flex flex-col rounded-2xl overflow-hidden bg-white/92 hover:bg-white backdrop-blur-md border border-white/80 shadow-[0_6px_20px_-8px_rgba(15,23,42,0.24)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer disabled:cursor-wait text-center"
          >
            <div className="w-full aspect-[4/3] flex flex-col items-center justify-center px-3">
              {isGeneratingAi ? (
                <>
                  <Loader2
                    className="w-6 h-6 text-blue-600 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="mt-2 text-[11px] font-medium text-slate-600">
                    {t.imageBank.generatingAiLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[13px] font-semibold tracking-tight text-slate-900 group-hover:text-black">
                    {t.imageBank.generateCardTitle}
                  </span>
                  <span className="mt-1 text-[10px] font-medium text-blue-600">
                    {t.imageBank.generateCardPlusBadge}
                  </span>
                </>
              )}
            </div>
            <div
              aria-hidden="true"
              className="w-full px-2.5 py-1.5 bg-white/95 border-t border-slate-100/80 text-[10px] text-transparent select-none"
            >
              IA
            </div>
          </motion.button>
        )}

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
                {item.sourcePageUrl ? (
                  <a
                    href={item.sourcePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-blue-600 hover:underline capitalize font-medium"
                  >
                    {item.provider}
                  </a>
                ) : (
                  <span className="shrink-0 text-blue-600 uppercase font-medium">
                    {item.provider}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasSearched && items.length === 0 && !generatedAiImage && (
        <p
          role="status"
          className={`px-4 py-2 rounded-2xl text-xs font-medium text-center ${
            variant === 'desktop'
              ? 'bg-white/88 text-slate-900 shadow-sm'
              : 'text-slate-700'
          }`}
        >
          {t.imageBank.noResultsNotice}
        </p>
      )}
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
            {item.sourcePageUrl ? (
              <a
                href={item.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-600 hover:underline capitalize font-medium"
              >
                {item.provider}
              </a>
            ) : (
              <span className="shrink-0 text-blue-600 uppercase font-medium">
                {item.provider}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
