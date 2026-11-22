import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, Loader2, PenLine, X } from 'lucide-react';
import type { ImageBankImageItem } from '../lib/imageBankClient';
import { useI18n } from '../lib/i18n';
import { ImageBankResultsGrid, ImageBankSavedGrid } from './ImageBankGrid';

interface DesktopImageBankPanelProps {
  open: boolean;
  query: string;
  onChangeQuery: (next: string) => void;
  onSearchSubmit: () => void;
  results: ImageBankImageItem[];
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;
  savedImages: ImageBankImageItem[];
  savedIds: Set<string>;
  onToggleSaveImage: (item: ImageBankImageItem) => void;
  onRemoveSavedImage: (id: string) => void;
  showSaved: boolean;
  onToggleSaved: () => void;
  onCloseSaved: () => void;
  backgroundUrl: string;
  onClose: () => void;
}

export function DesktopImageBankPanel({
  open,
  query,
  onChangeQuery,
  onSearchSubmit,
  results,
  isSearching,
  hasSearched,
  searchError,
  savedImages,
  savedIds,
  onToggleSaveImage,
  onRemoveSavedImage,
  showSaved,
  onToggleSaved,
  onCloseSaved,
  backgroundUrl,
  onClose,
}: DesktopImageBankPanelProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      if (!showSaved) {
        inputRef.current?.focus();
      }
    }, 180);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showSaved) {
          onCloseSaved();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, showSaved, onCloseSaved, onClose]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          role="dialog"
          aria-modal="false"
          aria-label={t.imageBank.panelAria}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  width: '50%',
                  opacity: 1,
                  borderTopRightRadius: 28,
                  borderBottomRightRadius: 28,
                }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
          }
          className="hidden lg:flex shrink-0 h-dvh sticky top-0 overflow-hidden z-20 bg-[#0e1013] border-r border-white/25 shadow-[18px_0_48px_-18px_rgba(15,23,42,0.45)] flex-col"
        >
          {/* Same background as the desktop home canvas */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 overflow-hidden"
          >
            <img
              src={backgroundUrl}
              alt=""
              referrerPolicy="no-referrer"
              decoding="sync"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/40" />
          </div>

          <div className="relative z-10 w-full min-w-[360px] h-full flex flex-col">
            {/* Top search input + Saved icon beside input + X close button */}
            <div className="flex items-center gap-2.5 px-6 pt-5 pb-3 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSearchSubmit();
                }}
                role="search"
                aria-label={t.imageBank.panelAria}
                className="flex-1 min-w-0"
              >
                <div className="group flex items-center gap-2.5 h-11 w-full rounded-full px-4 bg-white/95 backdrop-blur-md border border-white/85 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.4)] transition-all duration-150 focus-within:bg-white focus-within:shadow-[0_14px_42px_-6px_rgba(0,0,0,0.48)]">
                  <PenLine
                    className="w-4 h-4 text-slate-400 shrink-0 transition-colors duration-150 group-focus-within:text-slate-700"
                    aria-hidden="true"
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    enterKeyHint="search"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder={t.imageBank.placeholder}
                    aria-label={t.imageBank.inputAria}
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent text-[14px] font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {isSearching ? (
                    <Loader2
                      className="w-4 h-4 text-slate-700 animate-spin shrink-0"
                      aria-label={t.imageBank.searchingAria}
                    />
                  ) : (
                    query.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onChangeQuery('')}
                        aria-label={t.imageBank.clearQueryAria}
                        className="flex items-center justify-center w-6 h-6 -mr-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )
                  )}
                </div>
              </form>

              <button
                type="button"
                onClick={onToggleSaved}
                aria-pressed={showSaved}
                aria-label={t.imageBank.savedAria}
                title={t.imageBank.savedTitle}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border shadow-[0_12px_36px_-6px_rgba(0,0,0,0.38)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer shrink-0 ${
                  showSaved
                    ? 'bg-slate-950 text-white border-white/60'
                    : 'bg-white/95 hover:bg-white border-white/85 text-slate-600 hover:text-slate-950'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${showSaved ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                {savedImages.length > 0 && !showSaved && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums shadow"
                  >
                    {savedImages.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.imageBank.closeAria}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </div>

            {/* Search Link Pexels title & public bank notice crediting Pexels + Pixabay side by side */}
            <div className="px-6 pb-3 shrink-0">
              <div className="rounded-2xl bg-white/88 backdrop-blur-md border border-white/80 px-4 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.28)]">
                <p className="text-xs font-semibold tracking-tight text-black">
                  {t.imageBank.brandTitle}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug font-normal text-black">
                  {t.imageBank.publicBankNotice}{' '}
                  <a
                    href="https://www.pexels.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    {t.imageBank.publicBankLinkLabel}
                  </a>
                  {' · '}
                  <a
                    href="https://pixabay.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    {t.imageBank.publicBankSecondLinkLabel}
                  </a>
                </p>
              </div>
            </div>

            {/* Open gallery area over the matching background */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
              <ImageBankResultsGrid
                items={results}
                savedIds={savedIds}
                isSearching={isSearching}
                hasSearched={hasSearched}
                error={searchError}
                onToggleSave={onToggleSaveImage}
                variant="desktop"
              />
            </div>
          </div>

          {/* Full white Guardado interface opened from the saved icon */}
          <AnimatePresence initial={false}>
            {showSaved && (
              <motion.div
                key="desktop-image-bank-saved-view"
                role="dialog"
                aria-modal="false"
                aria-label={t.imageBank.savedFullTitle}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-20 bg-white flex flex-col"
              >
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200/75 bg-white shrink-0">
                  <h2 className="text-sm font-semibold tracking-tight text-slate-950">
                    {t.imageBank.savedFullTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={onCloseSaved}
                    aria-label={t.imageBank.closeSavedAria}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
                  <ImageBankSavedGrid
                    items={savedImages}
                    onRemove={onRemoveSavedImage}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
