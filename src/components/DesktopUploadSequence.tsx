import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Image as ImageIcon, X } from 'lucide-react';
import type { CatalogImageItem } from '../data/catalogSamples';
import type {
  CompressedImageMeta,
  ImageCompressionStatus,
  ImageReceiveStatus,
  ImageUploadStatus,
} from './MobileCatalogCarousel';
import { useI18n } from '../lib/i18n';

interface DesktopUploadSequenceProps {
  images: CatalogImageItem[];
  showCompressionBox: boolean;
  compressionStatuses: Record<string, ImageCompressionStatus>;
  showUploadBox: boolean;
  uploadStatuses: Record<string, ImageUploadStatus>;
  showReceiveBox: boolean;
  receiveStatuses: Record<string, ImageReceiveStatus>;
  compressionResults: Record<string, CompressedImageMeta>;
  onComplete: () => void;
}

type SequencePhase = 'merging' | 'active' | 'splitting';

const TILE_GAP = 10;
const MERGE_DURATION_MS = 460;
const SPLIT_DURATION_MS = 500;
const VANISH_HOLD_AFTER_ALL_MS = 160;
const RECEIVE_COMPLETE_HOLD_MS = 700;

function computeUnifiedGrid(count: number, containerAspect: number) {
  if (count <= 1) return { cols: 1, rows: 1 };

  let bestCols = count;
  let bestRows = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const emptyCells = cols * rows - count;
    const cellAspect = containerAspect / (cols / rows);
    const squarePenalty = Math.abs(Math.log(Math.max(cellAspect, 0.1)));
    const score = emptyCells * 10 + squarePenalty;

    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
      bestRows = rows;
    }
  }

  return { cols: bestCols, rows: bestRows };
}

export function DesktopUploadSequence({
  images,
  showCompressionBox,
  compressionStatuses,
  showUploadBox,
  uploadStatuses,
  showReceiveBox,
  receiveStatuses,
  compressionResults,
  onComplete,
}: DesktopUploadSequenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();
  const [containerWidth, setContainerWidth] = useState(960);
  const [phase, setPhase] = useState<SequencePhase>(
    shouldReduceMotion ? 'active' : 'merging',
  );
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [hiddenCompTiles, setHiddenCompTiles] = useState<Record<number, boolean>>({});
  const [hiddenUploadTiles, setHiddenUploadTiles] = useState<Record<number, boolean>>({});
  const hasTriggeredSplitRef = useRef(false);

  const displayImages = useMemo(() => images.slice(0, 10), [images]);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Merge two columns into a single unified desktop card right when files are picked
  useEffect(() => {
    if (shouldReduceMotion) {
      setPhase('active');
      return;
    }
    setPhase('merging');
    const id = window.setTimeout(() => {
      setPhase('active');
    }, MERGE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [images, shouldReduceMotion]);

  // Check when Stage 2 (Compression) has completed all items
  const allCompressed = useMemo(() => {
    if (!showCompressionBox || showUploadBox || displayImages.length === 0) {
      return false;
    }
    return displayImages.every((item) => {
      const s = compressionStatuses[item.id];
      return s === 'done' || s === 'error';
    });
  }, [showCompressionBox, showUploadBox, displayImages, compressionStatuses]);

  // Disappear compressed tiles one by one from bottom to top before Stage 3 starts
  useEffect(() => {
    if (!allCompressed) {
      if (!showCompressionBox) setHiddenCompTiles({});
      return;
    }

    const count = displayImages.length;
    const stepMs = shouldReduceMotion ? 0 : Math.min(62, Math.floor(420 / Math.max(1, count)));
    const timers: number[] = [];

    for (let reverseIdx = 0; reverseIdx < count; reverseIdx++) {
      const tileIndex = count - 1 - reverseIdx;
      const delay = (shouldReduceMotion ? 0 : VANISH_HOLD_AFTER_ALL_MS) + reverseIdx * stepMs;
      const t = window.setTimeout(() => {
        setHiddenCompTiles((prev) => ({ ...prev, [tileIndex]: true }));
      }, delay);
      timers.push(t);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [allCompressed, showCompressionBox, displayImages.length, shouldReduceMotion]);

  // Check when Stage 3 (Uploading to R2) has completed all items
  const allUploaded = useMemo(() => {
    if (!showUploadBox || showReceiveBox || displayImages.length === 0) {
      return false;
    }
    return displayImages.every((item) => {
      const s = uploadStatuses[item.id];
      return s === 'done' || s === 'error';
    });
  }, [showUploadBox, showReceiveBox, displayImages, uploadStatuses]);

  // Disappear upload spinner/check slots one by one from bottom to top before Stage 4 starts
  useEffect(() => {
    if (!allUploaded) {
      if (!showUploadBox) setHiddenUploadTiles({});
      return;
    }

    const count = displayImages.length;
    const stepMs = shouldReduceMotion ? 0 : Math.min(62, Math.floor(420 / Math.max(1, count)));
    const timers: number[] = [];

    for (let reverseIdx = 0; reverseIdx < count; reverseIdx++) {
      const tileIndex = count - 1 - reverseIdx;
      const delay = (shouldReduceMotion ? 0 : VANISH_HOLD_AFTER_ALL_MS) + reverseIdx * stepMs;
      const t = window.setTimeout(() => {
        setHiddenUploadTiles((prev) => ({ ...prev, [tileIndex]: true }));
      }, delay);
      timers.push(t);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [allUploaded, showUploadBox, displayImages.length, shouldReduceMotion]);

  // Check when Stage 4 (Recibiendo) has received all URLs, then split back into 2 boxes
  const allReceived = useMemo(() => {
    if (!showReceiveBox || displayImages.length === 0) return false;
    return displayImages.every((item) => {
      const s = receiveStatuses[item.id];
      return s === 'received' || s === 'error';
    });
  }, [showReceiveBox, displayImages, receiveStatuses]);

  useEffect(() => {
    if (!allReceived || hasTriggeredSplitRef.current) return;
    hasTriggeredSplitRef.current = true;

    if (shouldReduceMotion) {
      onComplete();
      return;
    }

    const splitTimer = window.setTimeout(() => {
      setPhase('splitting');
    }, RECEIVE_COMPLETE_HOLD_MS);

    const completeTimer = window.setTimeout(() => {
      onComplete();
    }, RECEIVE_COMPLETE_HOLD_MS + SPLIT_DURATION_MS);

    return () => {
      window.clearTimeout(splitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [allReceived, onComplete, shouldReduceMotion]);

  const gapPx = containerWidth >= 920 ? 80 : 56;
  const halfWidth = Math.max(200, (containerWidth - gapPx) / 2);
  const rightStartX = halfWidth + gapPx;

  const unifiedGrid = useMemo(
    () => computeUnifiedGrid(displayImages.length, 2.66),
    [displayImages.length],
  );

  // Comfortable large spinner sizing per grid density so spinners never collide
  const uploadSpinnerClass =
    displayImages.length === 1
      ? 'w-16 h-16 border-[3.5px]'
      : displayImages.length <= 4
        ? 'w-12 h-12 border-[3px]'
        : 'w-9 h-9 border-[3px]';

  const uploadBadgeClass =
    displayImages.length === 1
      ? 'w-14 h-14'
      : displayImages.length <= 4
        ? 'w-11 h-11'
        : 'w-9 h-9';

  const uploadIconClass =
    displayImages.length === 1
      ? 'w-7 h-7'
      : displayImages.length <= 4
        ? 'w-5 h-5'
        : 'w-4 h-4';

  const stageTitle = showReceiveBox
    ? t.pipeline.stageReceivingTitle
    : showUploadBox
      ? t.pipeline.stageUploadingTitle
      : showCompressionBox
        ? t.pipeline.stageCompressingTitle
        : t.pipeline.stageImagesTitle;

  const headingClasses =
    'text-sm font-semibold text-white tracking-tight mb-2.5 pl-1 drop-shadow-[0_1px_10px_rgba(0,0,0,0.65)]';

  return (
    <div
      ref={containerRef}
      className="relative z-10 hidden lg:block w-full max-w-[960px] mt-8"
    >
      {/* Dynamic Heading */}
      {phase === 'splitting' ? (
        <div className="grid grid-cols-2 gap-14 xl:gap-20 w-full">
          <motion.h2
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className={headingClasses}
          >
            {t.pipeline.stageImagesTitle}
          </motion.h2>
          <motion.h2
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className={headingClasses}
          >
            {t.pipeline.stageMetadataTitle}
          </motion.h2>
        </div>
      ) : (
        <h2 className={headingClasses}>{stageTitle}</h2>
      )}

      {/* Stage Area matching the exact desktop card height */}
      <div className="relative w-full h-[min(50vh,380px)] min-h-[320px]">
        {phase === 'merging' ? (
          <>
            {/* Left card expands smoothly across full width */}
            <motion.section
              aria-hidden="true"
              initial={{ left: 0, width: halfWidth }}
              animate={{ left: 0, width: containerWidth }}
              transition={{ duration: MERGE_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 h-full rounded-3xl bg-white border border-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] p-4 overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0.15 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full grid"
                style={{
                  gap: `${TILE_GAP}px`,
                  gridTemplateColumns: `repeat(${unifiedGrid.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${unifiedGrid.rows}, minmax(0, 1fr))`,
                }}
              >
                {displayImages.map((item) => (
                  <div
                    key={`merge-thumb-${item.id}`}
                    className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-50"
                  >
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-full object-cover select-none"
                      draggable={false}
                    />
                  </div>
                ))}
              </motion.div>
            </motion.section>

            {/* Right card glides inward and fuses seamlessly into the unified card */}
            <motion.section
              aria-hidden="true"
              initial={{ left: rightStartX, width: halfWidth, opacity: 1 }}
              animate={{ left: halfWidth * 0.45, width: halfWidth, opacity: 0 }}
              transition={{ duration: (MERGE_DURATION_MS * 0.85) / 1000, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute top-0 h-full rounded-3xl bg-white border border-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)]"
            />
          </>
        ) : phase === 'splitting' ? (
          <>
            {/* Left card separates cleanly back to left column */}
            <motion.section
              aria-label={t.pipeline.stageImagesTitle}
              initial={{ left: 0, width: containerWidth }}
              animate={{ left: 0, width: halfWidth }}
              transition={{ duration: SPLIT_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 h-full rounded-3xl bg-white border border-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] p-4 overflow-hidden"
            >
              <div className="w-full h-full rounded-2xl bg-slate-50/40" />
            </motion.section>

            {/* Right card glides smoothly out to right column */}
            <motion.section
              aria-label={t.pipeline.stageMetadataTitle}
              initial={{ left: containerWidth - halfWidth, width: halfWidth, opacity: 0.25 }}
              animate={{ left: rightStartX, width: halfWidth, opacity: 1 }}
              transition={{ duration: SPLIT_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 h-full rounded-3xl bg-white border border-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] p-4 overflow-hidden"
            >
              <div className="w-full h-full rounded-2xl bg-slate-50/40" />
            </motion.section>
          </>
        ) : (
          /* Active Unified Single Box: handles Preview -> Comprimiendo -> Lanzando a base de datos -> Recibiendo */
          <section
            aria-label={stageTitle}
            className="w-full h-full rounded-3xl bg-white border border-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] p-4 overflow-hidden"
          >
            {showReceiveBox ? (
              /* Stage 4: Recibiendo — URLs stacked top-to-bottom inside fixed unified box */
              <ul className="w-full h-full flex flex-col justify-start gap-1.5 overflow-hidden px-1 py-0.5">
                {displayImages.map((item) => {
                  const status = receiveStatuses[item.id] ?? 'waiting';
                  const received = compressionResults[item.id];
                  const displayUrl = received?.cleanUrl ?? item.cleanUrl;

                  return (
                    <li
                      key={`desktop-receive-${item.id}`}
                      className="h-7 shrink-0 w-full min-w-0 flex items-center justify-between gap-3 px-2 rounded-lg overflow-hidden select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                          {status === 'waiting' && (
                            <span
                              aria-label={t.app.receiveStatusAria('waiting', item.alt)}
                              className="w-4 h-4 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin [animation-duration:500ms]"
                            />
                          )}

                          {status === 'received' && (
                            <motion.span
                              initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              aria-label={t.app.receiveStatusAria('received', item.alt)}
                              className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                            </motion.span>
                          )}

                          {status === 'error' && (
                            <span
                              aria-label={t.app.receiveStatusAria('error', item.alt)}
                              className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"
                            >
                              <X className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                            </span>
                          )}
                        </div>

                        {status === 'received' ? (
                          <motion.span
                            initial={shouldReduceMotion ? false : { opacity: 0, x: 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.18 }}
                            className="flex-1 min-w-0 font-mono text-xs leading-none text-slate-800 truncate tabular-nums"
                          >
                            {displayUrl}
                          </motion.span>
                        ) : status === 'error' ? (
                          <span className="flex-1 min-w-0 text-xs leading-none text-rose-500 truncate">
                            {t.pipeline.couldNotReceive}
                          </span>
                        ) : (
                          <span className="h-2.5 w-1/2 rounded-full bg-slate-100 animate-pulse" />
                        )}
                      </div>

                      {status === 'received' && received && received.savedPercent > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-600 tabular-nums shrink-0">
                          -{received.savedPercent}%
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : showUploadBox ? (
              /* Stage 3: Lanzando a base de datos — thumbnails cleared, large comfortable green spinners in each image position */
              <div
                className="w-full h-full grid"
                style={{
                  gap: `${TILE_GAP}px`,
                  gridTemplateColumns: `repeat(${unifiedGrid.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${unifiedGrid.rows}, minmax(0, 1fr))`,
                }}
              >
                {displayImages.map((item, idx) => {
                  const status = uploadStatuses[item.id] ?? 'pending';
                  const isHidden = Boolean(hiddenUploadTiles[idx]);

                  return (
                    <motion.div
                      key={`desktop-upload-slot-${item.id}`}
                      animate={
                        isHidden
                          ? { scale: 0.72, opacity: 0 }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-full h-full rounded-2xl bg-slate-50/75 border border-slate-200/60 flex items-center justify-center overflow-hidden"
                    >
                      {status === 'pending' && (
                        <span
                          aria-label={t.app.imageUploadAria('pending', item.alt)}
                          className={`${uploadSpinnerClass} rounded-full border-slate-200`}
                        />
                      )}

                      {status === 'uploading' && (
                        <span
                          aria-label={t.app.imageUploadAria('uploading', item.alt)}
                          className={`${uploadSpinnerClass} rounded-full border-emerald-200 border-t-emerald-500 animate-spin`}
                        />
                      )}

                      {status === 'done' && (
                        <motion.span
                          initial={shouldReduceMotion ? false : { scale: 0.55, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          aria-label={t.app.imageUploadAria('done', item.alt)}
                          className={`${uploadBadgeClass} rounded-full bg-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.38)] flex items-center justify-center`}
                        >
                          <Check className={`${uploadIconClass} stroke-[2.75]`} aria-hidden="true" />
                        </motion.span>
                      )}

                      {status === 'error' && (
                        <span
                          aria-label={t.app.imageUploadAria('error', item.alt)}
                          className={`${uploadBadgeClass} rounded-full bg-rose-100 text-rose-600 flex items-center justify-center`}
                        >
                          <X className={`${uploadIconClass} stroke-[2.5]`} aria-hidden="true" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Stage 1 & Stage 2: Unified Grid (Preview -> Comprimiendo -> Bottom-to-Top Disappear) */
              <div
                className="w-full h-full grid"
                style={{
                  gap: `${TILE_GAP}px`,
                  gridTemplateColumns: `repeat(${unifiedGrid.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${unifiedGrid.rows}, minmax(0, 1fr))`,
                }}
              >
                {displayImages.map((item, idx) => {
                  const compStatus = compressionStatuses[item.id] ?? 'pending';
                  const isHidden = Boolean(hiddenCompTiles[idx]);
                  const hasError = Boolean(failedIds[item.id]);

                  return (
                    <motion.div
                      key={`desktop-comp-tile-${item.id}`}
                      animate={
                        isHidden
                          ? { scale: 0.72, opacity: 0 }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-inset ring-black/[0.04] flex items-center justify-center"
                    >
                      {hasError ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                          <ImageIcon className="w-6 h-6" aria-hidden="true" />
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.alt}
                          referrerPolicy="no-referrer"
                          decoding="sync"
                          onError={() =>
                            setFailedIds((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className="w-full h-full object-cover select-none"
                          draggable={false}
                        />
                      )}

                      {showCompressionBox && compStatus === 'rendering' && (
                        <motion.div
                          initial={shouldReduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.14 }}
                          aria-label={t.app.compressionStatusAria('rendering', item.alt)}
                          className="absolute inset-0 bg-slate-950/25 flex items-center justify-center"
                        >
                          <span className="w-10 h-10 rounded-full bg-white/95 shadow-sm flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full border-[2.5px] border-blue-200 border-t-blue-600 animate-spin" />
                          </span>
                        </motion.div>
                      )}

                      {showCompressionBox && compStatus === 'compressing' && (
                        <motion.div
                          initial={shouldReduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.14 }}
                          aria-label={t.app.compressionStatusAria('compressing', item.alt)}
                          className="absolute inset-0 bg-slate-950/25 flex items-center justify-center"
                        >
                          <span className="w-10 h-10 rounded-full bg-white/95 shadow-sm flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full border-[2.5px] border-emerald-200 border-t-emerald-500 animate-spin" />
                          </span>
                        </motion.div>
                      )}

                      {showCompressionBox && compStatus === 'done' && (
                        <motion.div
                          initial={shouldReduceMotion ? false : { scale: 0.55, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          aria-label={t.app.compressionStatusAria('done', item.alt)}
                          className="absolute inset-0 bg-slate-950/10 flex items-center justify-center pointer-events-none"
                        >
                          <span className="w-9 h-9 rounded-full bg-emerald-500 text-white ring-2 ring-white shadow-[0_3px_10px_rgba(16,185,129,0.4)] flex items-center justify-center">
                            <Check className="w-5 h-5 stroke-[2.75]" aria-hidden="true" />
                          </span>
                        </motion.div>
                      )}

                      {showCompressionBox && compStatus === 'error' && (
                        <div
                          aria-label={t.app.compressionStatusAria('error', item.alt)}
                          className="absolute inset-0 bg-slate-950/20 flex items-center justify-center pointer-events-none"
                        >
                          <span className="w-9 h-9 rounded-full bg-rose-500 text-white ring-2 ring-white flex items-center justify-center">
                            <X className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
