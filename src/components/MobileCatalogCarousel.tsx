import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react';
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Image as ImageIcon,
  Link2,
  Loader2,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import type { CatalogImageItem } from '../data/catalogSamples';
import type { MappedImageMetadata } from '../lib/imageCompression';
import {
  generateAndDownloadCatalogPdf,
  type CatalogPdfExportKind,
} from '../lib/pdfExport';
import { MobileJsonEditorModal } from './MobileJsonEditorModal';
import { useI18n } from '../lib/i18n';

export type ImageCompressionStatus =
  | 'pending'
  | 'rendering'
  | 'compressing'
  | 'done'
  | 'error';
export type ImageUploadStatus = 'pending' | 'uploading' | 'done' | 'error';
export type ImageReceiveStatus = 'waiting' | 'received' | 'error';
export type ImageMapStatus = 'waiting' | 'mapping' | 'mapped' | 'error';

export interface CompressedImageMeta {
  url: string;
  cleanUrl: string;
  savedPercent: number;
  compressedBytes: number;
}

import type { ServiceCredentialsDisplay } from './DualCatalogShowcase';

interface MobileCatalogCarouselProps {
  images: CatalogImageItem[];
  isUnified: boolean;
  isExtracting: boolean;
  extractError: string | null;
  hasExtractedResults: boolean;
  showCompressionBox?: boolean;
  compressionStatuses?: Record<string, ImageCompressionStatus>;
  showUploadBox?: boolean;
  uploadStatuses?: Record<string, ImageUploadStatus>;
  showReceiveBox?: boolean;
  receiveStatuses?: Record<string, ImageReceiveStatus>;
  showMapBox?: boolean;
  mapStatuses?: Record<string, ImageMapStatus>;
  mappedResults?: Record<string, MappedImageMetadata>;
  compressionResults?: Record<string, CompressedImageMeta>;
  onOpenOrganization?: () => void;
  isReadOnlyReplay?: boolean;
  serviceCredentials?: ServiceCredentialsDisplay | null;
}

const BENEFIT_VISUALS = {
  speed: { icon: Zap, toneClass: 'bg-amber-50 text-amber-600' },
  'clean-urls': { icon: Link2, toneClass: 'bg-blue-50 text-blue-600' },
  'easy-anywhere': { icon: Smartphone, toneClass: 'bg-emerald-50 text-emerald-600' },
  'ready-to-share': { icon: Copy, toneClass: 'bg-rose-50 text-rose-600' },
} as const;

export function MobileCatalogCarousel({
  images,
  isUnified,
  isExtracting,
  extractError,
  hasExtractedResults,
  showCompressionBox = false,
  compressionStatuses = {},
  showUploadBox = false,
  uploadStatuses = {},
  showReceiveBox = false,
  receiveStatuses = {},
  showMapBox = false,
  mapStatuses = {},
  mappedResults = {},
  compressionResults = {},
  onOpenOrganization,
  isReadOnlyReplay = false,
  serviceCredentials = null,
}: MobileCatalogCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const compressionScrollRef = useRef<HTMLDivElement>(null);
  const compressionCardRef = useRef<HTMLDivElement>(null);
  const uploadCardRef = useRef<HTMLDivElement>(null);
  const receiveCardRef = useRef<HTMLDivElement>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const lifecycleCardRef = useRef<HTMLDivElement>(null);
  const viewApiCardRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState<0 | 1 | 2>(0);
  const [activeCompressionCard, setActiveCompressionCard] = useState<
    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  >(0);
  const [showLifecycleBox, setShowLifecycleBox] = useState(
    Boolean(isReadOnlyReplay),
  );
  const [showViewApiBox, setShowViewApiBox] = useState(Boolean(isReadOnlyReplay));
  const [exportingPdfKind, setExportingPdfKind] =
    useState<CatalogPdfExportKind | null>(null);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<CatalogImageItem | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [expandedMappedIds, setExpandedMappedIds] = useState<Record<string, boolean>>({});
  const [copiedMetadataId, setCopiedMetadataId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [mergeStage, setMergeStage] = useState<'idle' | 'merging' | 'unified'>(
    isReadOnlyReplay ? 'unified' : 'idle',
  );
  const shouldReduceMotion = useReducedMotion();
  const { t, locale } = useI18n();

  useEffect(() => {
    setExpandedMappedIds({});
    if (!isReadOnlyReplay) {
      setShowLifecycleBox(false);
      setShowViewApiBox(false);
    }
  }, [images, isReadOnlyReplay]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyMetadataUrl = async (itemId: string, urlToCopy: string) => {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(urlToCopy);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = urlToCopy;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedMetadataId(itemId);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedMetadataId((prev) => (prev === itemId ? null : prev));
        copyTimerRef.current = null;
      }, 1500);
    }
  };

  useEffect(() => {
    if (!isUnified) {
      setMergeStage('idle');
      return;
    }

    if (shouldReduceMotion || isReadOnlyReplay) {
      setMergeStage('unified');
      return;
    }

    if (scrollRef.current && scrollRef.current.scrollLeft > 0) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }

    setMergeStage('merging');
    const timer = window.setTimeout(() => {
      setMergeStage('unified');
    }, 460);

    return () => window.clearTimeout(timer);
  }, [isUnified, shouldReduceMotion, isReadOnlyReplay]);

  useEffect(() => {
    if (
      !showCompressionBox ||
      showUploadBox ||
      showReceiveBox ||
      showMapBox ||
      mergeStage !== 'unified'
    ) {
      if (!showCompressionBox) setActiveCompressionCard(0);
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const container = compressionScrollRef.current;
      const target = compressionCardRef.current;
      if (!container || !target) return;

      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft || '16',
      );
      const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

      container.scrollTo({
        left: targetLeft,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
      setActiveCompressionCard(1);
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [
    showCompressionBox,
    showUploadBox,
    showReceiveBox,
    showMapBox,
    mergeStage,
    shouldReduceMotion,
  ]);

  useEffect(() => {
    if (
      !showUploadBox ||
      !showCompressionBox ||
      showReceiveBox ||
      showMapBox ||
      mergeStage !== 'unified'
    ) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const container = compressionScrollRef.current;
      const target = uploadCardRef.current;
      if (!container || !target) return;

      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft || '16',
      );
      const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

      container.scrollTo({
        left: targetLeft,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
      setActiveCompressionCard(2);
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [
    showUploadBox,
    showCompressionBox,
    showReceiveBox,
    showMapBox,
    mergeStage,
    shouldReduceMotion,
  ]);

  useEffect(() => {
    if (
      !showReceiveBox ||
      !showUploadBox ||
      !showCompressionBox ||
      showMapBox ||
      mergeStage !== 'unified'
    ) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const container = compressionScrollRef.current;
      const target = receiveCardRef.current;
      if (!container || !target) return;

      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft || '16',
      );
      const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

      container.scrollTo({
        left: targetLeft,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
      setActiveCompressionCard(3);
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [
    showReceiveBox,
    showUploadBox,
    showCompressionBox,
    showMapBox,
    mergeStage,
    shouldReduceMotion,
  ]);

  useEffect(() => {
    if (
      !showMapBox ||
      !showReceiveBox ||
      !showUploadBox ||
      !showCompressionBox ||
      showLifecycleBox ||
      showViewApiBox ||
      mergeStage !== 'unified'
    ) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const container = compressionScrollRef.current;
      const target = mapCardRef.current;
      if (!container || !target) return;

      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft || '16',
      );
      const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

      container.scrollTo({
        left: targetLeft,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
      setActiveCompressionCard(4);
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [
    showMapBox,
    showReceiveBox,
    showUploadBox,
    showCompressionBox,
    showLifecycleBox,
    showViewApiBox,
    mergeStage,
    shouldReduceMotion,
  ]);

  const allMappedComplete = Boolean(
    showMapBox &&
      images.length > 0 &&
      images.every((img) => {
        const status = mapStatuses[img.id];
        return status === 'mapped' || status === 'error';
      }) &&
      images.some((img) => Boolean(mappedResults[img.id])),
  );

  const processedCount = images.filter((img) => Boolean(mappedResults[img.id])).length;

  useEffect(() => {
    if (isReadOnlyReplay) {
      if (allMappedComplete) {
        setShowLifecycleBox(true);
        setShowViewApiBox(true);
      }
      return;
    }

    if (!allMappedComplete) {
      setShowLifecycleBox(false);
      setShowViewApiBox(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowLifecycleBox(true);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [allMappedComplete, isReadOnlyReplay]);

  useEffect(() => {
    if (!showLifecycleBox || showViewApiBox || mergeStage !== 'unified') {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const container = compressionScrollRef.current;
      const target = lifecycleCardRef.current;
      if (!container || !target) return;

      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft || '16',
      );
      const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

      container.scrollTo({
        left: targetLeft,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
      setActiveCompressionCard(5);
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [showLifecycleBox, showViewApiBox, mergeStage, shouldReduceMotion]);

  useEffect(() => {
    if (!showLifecycleBox || showViewApiBox) {
      return;
    }

    const autoAdvanceTimer = window.setTimeout(() => {
      setShowViewApiBox(true);
    }, 2000);

    return () => window.clearTimeout(autoAdvanceTimer);
  }, [showLifecycleBox, showViewApiBox]);

  const scrollToViewApiCard = () => {
    const container = compressionScrollRef.current;
    const target = viewApiCardRef.current;
    if (!container || !target) return;

    const paddingLeft = Number.parseFloat(
      window.getComputedStyle(container).paddingLeft || '16',
    );
    const targetLeft = Math.max(0, target.offsetLeft - paddingLeft);

    container.scrollTo({
      left: targetLeft,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
    setActiveCompressionCard(6);
  };

  useEffect(() => {
    if (!showViewApiBox || mergeStage !== 'unified') {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      scrollToViewApiCard();
    }, 90);

    return () => window.clearTimeout(scrollTimer);
  }, [showViewApiBox, mergeStage, shouldReduceMotion]);

  const handleOpenViewApi = () => {
    if (showViewApiBox) {
      scrollToViewApiCard();
      return;
    }
    setShowViewApiBox(true);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const index = Math.min(2, Math.max(0, Math.round((el.scrollLeft / maxScroll) * 2)));
    setActiveCard(index as 0 | 1 | 2);
  };

  const handleCompressionScroll = () => {
    const el = compressionScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const totalSteps = showViewApiBox
      ? 7
      : showLifecycleBox
        ? 5
        : showMapBox
          ? 4
          : showReceiveBox
            ? 3
            : showUploadBox
              ? 2
              : 1;
    const index = Math.min(
      totalSteps,
      Math.max(0, Math.round((el.scrollLeft / maxScroll) * totalSteps)),
    );
    setActiveCompressionCard(index as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7);
  };

  const fullMappedJsonText = useMemo(() => {
    const payload = images.map((item) => {
      const mapped = mappedResults[item.id];
      const compressed = compressionResults[item.id];
      const bestUrl =
        compressed?.url ||
        mapped?.url ||
        item.sourcePageUrl ||
        (!item.url.startsWith('blob:') ? item.url : '') ||
        item.cleanUrl ||
        item.url;
      return {
        nombre: mapped?.nombre || item.alt || t.common.productFallback,
        categoria: mapped?.categoria || t.common.generalCategory,
        descripcion: mapped?.descripcion || '',
        ...(mapped?.analisis_visual
          ? { analisis_visual: mapped.analisis_visual }
          : {}),
        url: bestUrl,
      };
    });
    return JSON.stringify(payload, null, 2);
  }, [images, mappedResults, compressionResults, t]);

  const handleExportPdf = async (kind: CatalogPdfExportKind) => {
    if (exportingPdfKind) return;
    setExportingPdfKind(kind);
    try {
      await generateAndDownloadCatalogPdf({
        kind,
        images,
        mappedResults,
        compressionResults,
        locale,
      });
    } finally {
      setExportingPdfKind(null);
    }
  };

  const mobileCols = images.length <= 1 ? 1 : images.length <= 4 ? 2 : 3;
  const mobileRows = Math.max(1, Math.ceil(images.length / mobileCols));

  return (
    <>
      {mergeStage !== 'unified' ? (
        <div className="relative z-10 lg:hidden w-full flex flex-col mt-6">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={`-mx-4 sm:-mx-5 w-[calc(100%+2rem)] sm:w-[calc(100%+2.5rem)] snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-5 px-4 sm:px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              mergeStage === 'merging' ? 'overflow-hidden' : 'overflow-x-auto'
            }`}
            aria-label={t.pipeline.mobileCarouselAria}
          >
            <div className="flex items-start gap-3.5 w-max pr-4 sm:pr-5">
              {/* Card 1: Expands cleanly to full visible mobile width during merge */}
              <motion.div
                animate={
                  mergeStage === 'merging'
                    ? { width: 'calc(100vw - 2rem)' }
                    : undefined
                }
                transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                className="w-[62vw] max-w-[248px] shrink-0 snap-start flex flex-col"
              >
                <h2 className="text-[13.5px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                  {t.pipeline.stageImagesTitle}
                </h2>

                <section
                  aria-label={t.pipeline.stageImagesTitle}
                  className="h-[min(41dvh,300px)] min-h-[245px] w-full rounded-[18px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_14px_38px_-12px_rgba(15,23,42,0.11),0_4px_12px_-4px_rgba(37,99,235,0.06)] p-2 overflow-hidden"
                >
                  {isExtracting ? (
                    <ExtractingPlaceholder />
                  ) : (
                    <div
                      className="w-full h-full grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))`,
                      }}
                    >
                      {images.map((item) => {
                        const hasError = Boolean(failedIds[item.id]);

                        return (
                          <button
                            key={`mobile-thumb-${item.id}`}
                            type="button"
                            onClick={() => setFullscreenImage(item)}
                            aria-label={t.pipeline.viewProductAria(item.alt)}
                            className="relative w-full h-full overflow-hidden rounded-lg bg-slate-50 ring-1 ring-inset ring-black/[0.04] active:scale-[0.96] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                          >
                            {hasError ? (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
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
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </motion.div>

              {/* Card 2: Slides smoothly leftward into Card 1 when merging */}
              <motion.div
                animate={
                  mergeStage === 'merging'
                    ? { x: -110, opacity: 0, scale: 0.94 }
                    : { x: 0, opacity: 1, scale: 1 }
                }
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="w-[62vw] max-w-[248px] shrink-0 snap-start flex flex-col"
              >
                <h2 className="text-[13.5px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                  {t.pipeline.stageMetadataTitle}
                </h2>

                <section
                  aria-label={t.pipeline.stageMetadataTitle}
                  className="h-[min(41dvh,300px)] min-h-[245px] w-full rounded-[18px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_14px_38px_-12px_rgba(15,23,42,0.11),0_4px_12px_-4px_rgba(37,99,235,0.06)] px-2.5 py-1.5"
                >
                  <div className="w-full h-full flex flex-col divide-y divide-slate-100/85 select-none overflow-hidden">
                    {images.map((item) => (
                      <div
                        key={`mobile-url-${item.id}`}
                        className="flex-1 max-h-7 flex items-center gap-1.5 px-0.5 min-w-0"
                      >
                        <Eye
                          className="w-2.5 h-2.5 text-blue-500/70 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-mono text-[9.5px] leading-none text-slate-700 truncate tabular-nums">
                          {item.cleanUrl}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </motion.div>

              {/* Column 3: Slides leftward and fades out cleanly during merge */}
              <motion.div
                animate={
                  mergeStage === 'merging'
                    ? { x: -180, opacity: 0, scale: 0.94 }
                    : { x: 0, opacity: 1, scale: 1 }
                }
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="w-[62vw] max-w-[248px] shrink-0 snap-start flex flex-col"
              >
                <h2 className="text-[13.5px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                  {t.pipeline.whyUseSearchLink}
                </h2>

                <section
                  aria-label={t.pipeline.whyUseSearchLinkAria}
                  className="h-[min(41dvh,300px)] min-h-[245px] w-full flex flex-col justify-between gap-2"
                >
                  {t.pipeline.benefits.map((benefit) => {
                    const visual =
                      BENEFIT_VISUALS[benefit.id as keyof typeof BENEFIT_VISUALS] ??
                      BENEFIT_VISUALS.speed;
                    const Icon = visual.icon;
                    return (
                      <article
                        key={benefit.id}
                        className="flex-1 min-h-0 w-full rounded-[14px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_8px_22px_-10px_rgba(15,23,42,0.11),0_2px_8px_-3px_rgba(37,99,235,0.05)] px-2.5 py-1.5 flex items-center gap-2.5"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${visual.toneClass}`}
                          aria-hidden="true"
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[11px] font-semibold text-slate-950 leading-tight truncate">
                            {benefit.title}
                          </h3>
                          <p className="mt-0.5 text-[9.5px] leading-[1.2] text-slate-500 line-clamp-2">
                            {benefit.description}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </motion.div>
            </div>
          </div>

          {/* Passive 3-step scroll progress cue (hidden as soon as merge begins) */}
          <motion.div
            aria-hidden="true"
            animate={{ opacity: mergeStage === 'merging' ? 0 : 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-1.5 mt-1"
          >
            {[0, 1, 2].map((step) => (
              <span
                key={step}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  activeCard === step ? 'w-5 bg-slate-900' : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </motion.div>
        </div>
      ) : (
        /* Unified mobile view after merge: single image box or auto-panning 2-box compression flow + unboxed metadata below */
        <div className="relative z-10 lg:hidden w-full flex flex-col mt-6">
          {showCompressionBox && !isExtracting && images.length > 0 ? (
            <div className="w-full flex flex-col">
              <div
                ref={compressionScrollRef}
                onScroll={handleCompressionScroll}
                className="relative -mx-4 sm:-mx-5 w-[calc(100%+2rem)] sm:w-[calc(100%+2.5rem)] overflow-x-auto snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-5 px-4 sm:px-5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t.pipeline.mobileCompressionAria}
              >
                <div className="flex items-start gap-3.5 w-max pr-4 sm:pr-5">
                  {/* Card 1: Uploaded images remain safely accessible on the left */}
                  <div className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col">
                    <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                      {t.pipeline.stageImagesTitle}
                    </h2>

                    <section
                      aria-label={t.pipeline.stageImagesTitle}
                      className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.06)] p-2.5 overflow-hidden"
                    >
                      <div
                        className="w-full h-full grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))`,
                        }}
                      >
                        {images.map((item) => {
                          const hasError = Boolean(failedIds[item.id]);

                          return (
                            <button
                              key={`comp-left-thumb-${item.id}`}
                              type="button"
                              onClick={() => setFullscreenImage(item)}
                              aria-label={t.pipeline.viewProductAria(item.alt)}
                              className="relative w-full h-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-inset ring-black/[0.04] active:scale-[0.96] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                            >
                              {hasError ? (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                  <ImageIcon className="w-4 h-4" aria-hidden="true" />
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
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  {/* Card 2: Automatic "Comprimiendo" box that slides into view to the right */}
                  <motion.div
                    ref={compressionCardRef}
                    initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                  >
                    <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                      {t.pipeline.stageCompressingTitle}
                    </h2>

                    <section
                      aria-label={t.pipeline.stageCompressingTitle}
                      className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(16,185,129,0.08)] p-2.5 overflow-hidden"
                    >
                      <div
                        className="w-full h-full grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))`,
                        }}
                      >
                        {images.map((item) => {
                          const status = compressionStatuses[item.id] ?? 'pending';
                          const hasError = Boolean(failedIds[item.id]);

                          return (
                            <div
                              key={`comp-right-tile-${item.id}`}
                              className={`relative w-full h-full overflow-hidden rounded-xl ring-1 ring-inset transition-colors duration-200 flex items-center justify-center ${
                                status === 'done'
                                  ? 'bg-emerald-50/70 ring-emerald-200/70'
                                  : status === 'error'
                                    ? 'bg-rose-50/70 ring-rose-200/70'
                                    : 'bg-slate-50 ring-black/[0.04]'
                              }`}
                            >
                              {status === 'pending' && (
                                hasError ? (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                    <ImageIcon className="w-4 h-4" aria-hidden="true" />
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
                                )
                              )}

                              {status === 'rendering' && (
                                <motion.div
                                  initial={shouldReduceMotion ? false : { scale: 0.7, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.16 }}
                                  aria-label={`Renderizando ${item.alt}`}
                                  className="flex items-center justify-center"
                                >
                                  <span className="w-5 h-5 rounded-full border-[2.5px] border-blue-200 border-t-blue-600 animate-spin" />
                                </motion.div>
                              )}

                              {status === 'compressing' && (
                                <motion.div
                                  initial={shouldReduceMotion ? false : { scale: 0.7, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.16 }}
                                  aria-label={`Comprimiendo ${item.alt}`}
                                  className="flex items-center justify-center"
                                >
                                  <span className="w-5 h-5 rounded-full border-[2.5px] border-emerald-200 border-t-emerald-500 animate-spin" />
                                </motion.div>
                              )}

                              {status === 'done' && (
                                <motion.div
                                  initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                  aria-label={`${item.alt} comprimida`}
                                  className="w-6 h-6 rounded-full bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)] flex items-center justify-center"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.75]" aria-hidden="true" />
                                </motion.div>
                              )}

                              {status === 'error' && (
                                <div
                                  aria-label={`Error al comprimir ${item.alt}`}
                                  className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"
                                >
                                  <X className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </motion.div>

                  {/* Card 3: Automatic "Lanzando a base de datos" box — thumbnails stay visible with green spinner/check overlay */}
                  {showUploadBox && (
                    <motion.div
                      ref={uploadCardRef}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageUploadingTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageUploadingTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(16,185,129,0.08)] p-2.5 overflow-hidden"
                      >
                        <div
                          className="w-full h-full grid gap-1.5"
                          style={{
                            gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))`,
                          }}
                        >
                          {images.map((item) => {
                            const status = uploadStatuses[item.id] ?? 'pending';
                            const hasError = Boolean(failedIds[item.id]);

                            return (
                              <button
                                key={`upload-right-tile-${item.id}`}
                                type="button"
                                onClick={() => setFullscreenImage(item)}
                                aria-label={`Ver ${item.alt}`}
                                className="relative w-full h-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-inset ring-black/[0.04] active:scale-[0.96] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                              >
                                {hasError ? (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                    <ImageIcon className="w-4 h-4" aria-hidden="true" />
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

                                {status === 'uploading' && (
                                  <motion.div
                                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.14 }}
                                    aria-label={`Subiendo ${item.alt}`}
                                    className="absolute inset-0 bg-slate-950/25 flex items-center justify-center"
                                  >
                                    <span className="w-6 h-6 rounded-full bg-white/95 shadow-sm flex items-center justify-center">
                                      <span className="w-4 h-4 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin" />
                                    </span>
                                  </motion.div>
                                )}

                                {status === 'done' && (
                                  <motion.div
                                    initial={shouldReduceMotion ? false : { scale: 0.55, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                    aria-label={`${item.alt} subida`}
                                    className="absolute inset-0 bg-slate-950/10 flex items-center justify-center pointer-events-none"
                                  >
                                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white ring-2 ring-white shadow-[0_2px_8px_rgba(16,185,129,0.45)] flex items-center justify-center">
                                      <Check className="w-3.5 h-3.5 stroke-[2.75]" aria-hidden="true" />
                                    </span>
                                  </motion.div>
                                )}

                                {status === 'error' && (
                                  <div
                                    aria-label={`Error al subir ${item.alt}`}
                                    className="absolute inset-0 bg-slate-950/20 flex items-center justify-center pointer-events-none"
                                  >
                                    <span className="w-6 h-6 rounded-full bg-rose-500 text-white ring-2 ring-white flex items-center justify-center">
                                      <X className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                                    </span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {/* Card 4: Automatic "Recibiendo" box — stacked from top inside fixed card height (max 10) */}
                  {showReceiveBox && (
                    <motion.div
                      ref={receiveCardRef}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageReceivingTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageReceivingTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(16,185,129,0.08)] p-2.5 overflow-hidden"
                      >
                        <ul className="w-full h-full flex flex-col justify-start gap-[2.5px] overflow-hidden">
                          {images.slice(0, 10).map((item) => {
                            const status = receiveStatuses[item.id] ?? 'waiting';
                            const received = compressionResults[item.id];
                            const displayUrl = received?.cleanUrl ?? item.cleanUrl;

                            return (
                              <li
                                key={`receive-row-${item.id}`}
                                className="h-5 shrink-0 w-full min-w-0 flex items-center gap-2 px-1 overflow-hidden select-none"
                              >
                                <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                                  {status === 'waiting' && (
                                    <span
                                      aria-label={`Recibiendo URL de ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin [animation-duration:500ms]"
                                    />
                                  )}

                                  {status === 'received' && (
                                    <motion.span
                                      initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                      aria-label={`URL recibida para ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                                    >
                                      <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                                    </motion.span>
                                  )}

                                  {status === 'error' && (
                                    <span
                                      aria-label={`Error al recibir ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"
                                    >
                                      <X className="w-2.5 h-2.5 stroke-[2.5]" aria-hidden="true" />
                                    </span>
                                  )}
                                </div>

                                {status === 'received' ? (
                                  <motion.span
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex-1 min-w-0 font-mono text-[10.5px] leading-none text-slate-800 truncate tabular-nums"
                                  >
                                    {displayUrl}
                                  </motion.span>
                                ) : status === 'error' ? (
                                  <span className="flex-1 min-w-0 text-[10.5px] leading-none text-rose-500 truncate">
                                    {t.pipeline.couldNotReceive}
                                  </span>
                                ) : (
                                  <span className="h-2 w-2/3 rounded-full bg-slate-100 animate-pulse" />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    </motion.div>
                  )}
                  {/* Card 5: Automatic "Renderizar y mapear" box — Gemini Vision JSON mapping per image */}
                  {showMapBox && (
                    <motion.div
                      ref={mapCardRef}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageMappingTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageMappingTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.08)] p-2.5 overflow-hidden"
                      >
                        <ul className="w-full h-full flex flex-col justify-start gap-[2.5px] overflow-hidden">
                          {images.slice(0, 10).map((item) => {
                            const status = mapStatuses[item.id] ?? 'waiting';
                            const mapped = mappedResults[item.id];

                            return (
                              <li
                                key={`map-row-${item.id}`}
                                className="h-5 shrink-0 w-full min-w-0 flex items-center gap-2 px-1 overflow-hidden select-none"
                              >
                                <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                                  {status === 'waiting' && (
                                    <span
                                      aria-label={`En espera para mapear ${item.alt}`}
                                      className="w-2 h-2 rounded-full bg-slate-300"
                                    />
                                  )}

                                  {status === 'mapping' && (
                                    <span
                                      aria-label={`Renderizando y mapeando ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin [animation-duration:550ms]"
                                    />
                                  )}

                                  {status === 'mapped' && (
                                    <motion.span
                                      initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                      aria-label={`Mapeado completo para ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                                    >
                                      <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                                    </motion.span>
                                  )}

                                  {status === 'error' && (
                                    <span
                                      aria-label={`Error al mapear ${item.alt}`}
                                      className="w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"
                                    >
                                      <X className="w-2.5 h-2.5 stroke-[2.5]" aria-hidden="true" />
                                    </span>
                                  )}
                                </div>

                                {status === 'mapped' && mapped ? (
                                  <motion.span
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex-1 min-w-0 text-[11px] leading-none text-slate-800 truncate"
                                  >
                                    <span className="font-medium text-slate-900">
                                      {mapped.nombre}
                                    </span>
                                    <span className="text-slate-400"> · {mapped.categoria}</span>
                                  </motion.span>
                                ) : status === 'error' ? (
                                  <span className="flex-1 min-w-0 text-[10.5px] leading-none text-rose-500 truncate">
                                    {t.pipeline.couldNotMap}
                                  </span>
                                ) : (
                                  <span className="h-2 w-3/4 rounded-full bg-slate-100 animate-pulse" />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    </motion.div>
                  )}

                  {/* Card 6: Automatic "Ciclo de vida" box — 2s after mapping completes */}
                  {showLifecycleBox && (
                    <motion.div
                      ref={lifecycleCardRef}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageLifecycleTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageLifecycleTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.08)] p-4 flex flex-col justify-between overflow-hidden"
                      >
                        <p className="text-[13px] leading-relaxed text-slate-700">
                          <span aria-hidden="true" className="mr-1.5">
                            🎉
                          </span>
                          <span className="font-semibold text-slate-950">
                            {t.pipeline.congratsTitleMobile}
                          </span>{' '}
                          {t.pipeline.congratsBodyMobile(processedCount)}
                        </p>

                        <div className="pt-3 border-t border-slate-200/75 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={handleOpenViewApi}
                            className="w-full py-1.5 text-left text-[13px] font-semibold text-blue-600 hover:text-blue-700 active:opacity-75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
                          >
                            {t.pipeline.generatedApisLink}
                          </button>

                          <button
                            type="button"
                            onClick={handleOpenViewApi}
                            className="w-full py-1.5 text-left text-[13px] font-semibold text-blue-600 hover:text-blue-700 active:opacity-75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
                          >
                            {t.pipeline.generatedEndpointLink}
                          </button>
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {/* Card 7: "Ver tu API" box — opens automatically 2s after Ciclo de vida */}
                  {showViewApiBox && (
                    <motion.div
                      ref={viewApiCardRef}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageViewApiTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageViewApiTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.08)] p-4 flex flex-col justify-between overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12.5px] font-semibold text-slate-950">
                              {t.pipeline.credentialsReadyTitle}
                            </p>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              Search Link Core
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {t.pipeline.credentialsReadyHint}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200/85 bg-slate-50/75 divide-y divide-slate-200/75">
                          <div className="h-10 px-3 flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"
                              />
                              <span className="font-mono text-xs font-medium text-slate-800 truncate">
                                {serviceCredentials?.apiKey || t.pipeline.generatingApiKey}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={!serviceCredentials?.apiKey}
                              onClick={() =>
                                serviceCredentials?.apiKey &&
                                void handleCopyMetadataUrl(
                                  'mobile-api',
                                  serviceCredentials.apiKey,
                                )
                              }
                              aria-label={t.pipeline.copyApiAria}
                              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 active:bg-white transition-colors cursor-pointer disabled:opacity-40"
                            >
                              {copiedMetadataId === 'mobile-api' ? (
                                <Check
                                  className="w-3.5 h-3.5 text-emerald-600 stroke-[2.75]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          <div className="h-10 px-3 flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"
                              />
                              <span className="font-mono text-xs font-medium text-slate-800 truncate">
                                {serviceCredentials?.endpointUrl || t.pipeline.generatingEndpoint}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={!serviceCredentials?.endpointUrl}
                              onClick={() =>
                                serviceCredentials?.endpointUrl &&
                                void handleCopyMetadataUrl(
                                  'mobile-endpoint',
                                  serviceCredentials.endpointUrl,
                                )
                              }
                              aria-label={t.pipeline.copyEndpointAria}
                              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 active:bg-white transition-colors cursor-pointer disabled:opacity-40"
                            >
                              {copiedMetadataId === 'mobile-endpoint' ? (
                                <Check
                                  className="w-3.5 h-3.5 text-emerald-600 stroke-[2.75]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        {onOpenOrganization && (
                          <button
                            type="button"
                            onClick={onOpenOrganization}
                            className="w-full pt-1 text-left text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 active:opacity-75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
                          >
                            {t.pipeline.viewYourOrg}
                          </button>
                        )}
                      </section>
                    </motion.div>
                  )}

                  {/* Card 8: "Productividad" box — sits right next to "Ver tu API" for swipe access (no auto-scroll) */}
                  {showViewApiBox && (
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="w-[78vw] max-w-[308px] shrink-0 snap-start flex flex-col"
                    >
                      <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                        {t.pipeline.stageProductivityTitle}
                      </h2>

                      <section
                        aria-label={t.pipeline.stageProductivityTitle}
                        className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.08)] px-4 py-3 flex flex-col justify-center overflow-y-auto"
                      >
                        <ul className="divide-y divide-slate-100/90">
                          {(
                            [
                              { kind: 'json', label: t.pipeline.pdfActions.json },
                              { kind: 'images', label: t.pipeline.pdfActions.images },
                              { kind: 'urls', label: t.pipeline.pdfActions.urls },
                              { kind: 'metadata', label: t.pipeline.pdfActions.metadata },
                              { kind: 'all', label: t.pipeline.pdfActions.all },
                            ] as const
                          ).map((action) => {
                            const isGenerating = exportingPdfKind === action.kind;
                            return (
                              <li key={action.kind}>
                                <button
                                  type="button"
                                  disabled={exportingPdfKind !== null}
                                  onClick={() => void handleExportPdf(action.kind)}
                                  className="w-full py-2 text-left text-[13px] font-normal text-blue-600 active:opacity-65 transition-opacity cursor-pointer flex items-center justify-between gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:underline"
                                >
                                  <span>{action.label}</span>
                                  {isGenerating && (
                                    <Loader2
                                      className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              </li>
                            );
                          })}

                          <li>
                            <button
                              type="button"
                              onClick={() => setIsJsonEditorOpen(true)}
                              className="w-full py-2 text-left text-[13px] font-normal text-blue-600 active:opacity-65 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:underline"
                            >
                              {t.pipeline.pdfActions.openEditor}
                            </button>
                          </li>
                        </ul>
                      </section>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Dynamic step swipe indicator */}
              <div
                aria-hidden="true"
                className="flex items-center justify-center gap-1.5 mt-0.5"
              >
                {(showViewApiBox
                  ? [0, 1, 2, 3, 4, 5, 6, 7]
                  : showLifecycleBox
                    ? [0, 1, 2, 3, 4, 5]
                    : showMapBox
                      ? [0, 1, 2, 3, 4]
                      : showReceiveBox
                        ? [0, 1, 2, 3]
                        : showUploadBox
                          ? [0, 1, 2]
                          : [0, 1]
                ).map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      activeCompressionCard === step
                        ? 'w-5 bg-slate-900'
                        : 'w-1.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[14px] font-semibold text-slate-950 tracking-[-0.015em] mb-2 pl-1">
                {t.pipeline.stageImagesTitle}
              </h2>

              <section
                aria-label={t.pipeline.stageImagesTitle}
                className="h-[min(42dvh,310px)] min-h-[245px] w-full rounded-[20px] bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-[0_16px_42px_-12px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(37,99,235,0.06)] p-2.5 overflow-hidden"
              >
                {isExtracting ? (
                  <ExtractingPlaceholder />
                ) : extractError && (!hasExtractedResults || images.length === 0) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                    <ImageIcon className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
                    <p className="text-xs text-slate-500 leading-relaxed">{extractError}</p>
                  </div>
                ) : (
                  <div
                    className="w-full h-full grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))`,
                    }}
                  >
                    {images.map((item) => {
                      const hasError = Boolean(failedIds[item.id]);

                      return (
                        <button
                          key={`unified-thumb-${item.id}`}
                          type="button"
                          onClick={() => setFullscreenImage(item)}
                          aria-label={t.pipeline.viewProductAria(item.alt)}
                          className="relative w-full h-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-inset ring-black/[0.04] active:scale-[0.96] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                        >
                          {hasError ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                              <ImageIcon className="w-4 h-4" aria-hidden="true" />
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
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Clean unboxed metadata/URLs or "Renderizado y mapeado" JSON stacked vertically directly over the moving light background */}
          {!isExtracting && (hasExtractedResults || !extractError) && images.length > 0 && (
            <motion.section
              key={allMappedComplete ? 'mapped-json-list' : 'raw-metadata-list'}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              aria-label={
                allMappedComplete
                  ? t.pipeline.stageMappedDoneTitle
                  : t.pipeline.stageMetadataTitle
              }
              className="mt-5 px-1 pb-6"
            >
              <h2 className="text-[13.5px] font-semibold text-slate-950 tracking-[-0.015em] mb-2">
                {allMappedComplete
                  ? t.pipeline.stageMappedDoneTitle
                  : t.pipeline.stageMetadataTitle}
              </h2>

              {allMappedComplete ? (
                <ul className="divide-y divide-slate-900/12">
                  {images.map((item) => {
                    const mapped = mappedResults[item.id];
                    const isExpanded = Boolean(expandedMappedIds[item.id]);
                    const isCopied = copiedMetadataId === `json-${item.id}`;

                    if (!mapped) {
                      return (
                        <li
                          key={`mapped-error-${item.id}`}
                          className="py-3 flex items-center gap-2.5 min-w-0"
                        >
                          <span
                            aria-hidden="true"
                            className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"
                          >
                            <X className="w-2.5 h-2.5 stroke-[2.75]" />
                          </span>
                          <span className="text-xs text-rose-600/90 truncate">
                            {t.pipeline.couldNotMap}
                          </span>
                        </li>
                      );
                    }

                    const jsonText = JSON.stringify(
                      {
                        nombre: mapped.nombre,
                        categoria: mapped.categoria,
                        descripcion: mapped.descripcion,
                        ...(mapped.analisis_visual
                          ? { analisis_visual: mapped.analisis_visual }
                          : {}),
                        url: mapped.url,
                      },
                      null,
                      2,
                    );

                    return (
                      <li key={`mapped-json-${item.id}`} className="min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMappedIds((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
                          aria-expanded={isExpanded}
                          aria-label={t.pipeline.showJsonAria(isExpanded, mapped.nombre)}
                          className="w-full py-3 flex items-center justify-between gap-2.5 text-left active:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-md"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              aria-hidden="true"
                              className="w-4 h-4 rounded-full bg-emerald-500 text-white shadow-[0_1px_4px_rgba(16,185,129,0.3)] flex items-center justify-center shrink-0"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                            <span className="text-[13px] font-medium text-slate-900 truncate">
                              {mapped.nombre}
                            </span>
                          </div>

                          <ChevronDown
                            aria-hidden="true"
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-slate-700' : ''
                            }`}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={
                                shouldReduceMotion
                                  ? false
                                  : { height: 0, opacity: 0 }
                              }
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={
                                shouldReduceMotion
                                  ? { opacity: 0 }
                                  : { height: 0, opacity: 0 }
                              }
                              transition={{
                                duration: shouldReduceMotion ? 0 : 0.22,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="overflow-hidden"
                            >
                              <div className="pb-3.5 pl-6.5 pr-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyMetadataUrl(`json-${item.id}`, jsonText)
                                  }
                                  aria-label={t.pipeline.copyJsonOfAria(mapped.nombre)}
                                  className="w-full rounded-xl bg-white/75 border border-slate-900/10 p-3 text-left active:opacity-75 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[10.5px] font-medium text-slate-500">
                                      {t.pipeline.productJsonLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-600">
                                      {isCopied ? (
                                        <>
                                          <Check
                                            className="w-3 h-3 text-emerald-600 stroke-[2.75]"
                                            aria-hidden="true"
                                          />
                                          <span className="text-emerald-600">{t.common.copied}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" aria-hidden="true" />
                                          <span>{t.common.copy}</span>
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <pre className="font-mono text-[11px] leading-[1.55] text-slate-800 whitespace-pre-wrap break-all">
                                    {jsonText}
                                  </pre>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="divide-y divide-slate-900/[0.06]">
                  {images.map((item) => {
                    const compressed = compressionResults[item.id];
                    const displayUrl = compressed?.cleanUrl ?? item.cleanUrl;
                    const copyableUrl = compressed?.url
                      ? compressed.url
                      : /^https?:\/\//i.test(item.sourcePageUrl || '')
                        ? item.sourcePageUrl!
                        : /^https?:\/\//i.test(displayUrl)
                          ? displayUrl
                          : null;
                    const isCopied = copiedMetadataId === item.id;

                    return (
                      <li
                        key={`unified-url-${item.id}`}
                        className="min-w-0 select-none"
                      >
                        {copyableUrl ? (
                          <button
                            type="button"
                            onClick={() => handleCopyMetadataUrl(item.id, copyableUrl)}
                            aria-label={t.pipeline.copyUrlOfAria(displayUrl)}
                            className="w-full flex items-center justify-between gap-2.5 py-2.5 min-w-0 text-left active:opacity-65 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-md"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isCopied ? (
                                <Check
                                  className="w-3.5 h-3.5 shrink-0 text-emerald-600 stroke-[2.75]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Eye
                                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                    compressed ? 'text-emerald-600' : 'text-blue-600/80'
                                  }`}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-mono text-[11.5px] leading-snug text-slate-800 truncate tabular-nums">
                                {displayUrl}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCopied && (
                                <span className="text-[10.5px] font-medium text-emerald-600">
                                  {t.common.copied}
                                </span>
                              )}
                              {compressed && compressed.savedPercent > 0 && (
                                <span className="text-[10.5px] font-semibold text-emerald-600 tabular-nums">
                                  -{compressed.savedPercent}%
                                </span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2.5 py-2.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Eye
                                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                  compressed ? 'text-emerald-600' : 'text-blue-600/80'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="font-mono text-[11.5px] leading-snug text-slate-800 truncate tabular-nums">
                                {displayUrl}
                              </span>
                            </div>

                            {compressed && compressed.savedPercent > 0 && (
                              <span className="text-[10.5px] font-semibold text-emerald-600 tabular-nums shrink-0">
                                -{compressed.savedPercent}%
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.section>
          )}
        </div>
      )}

      {/* Mobile fullscreen image viewer with swipe-down to dismiss */}
      <AnimatePresence>
        {fullscreenImage && (
          <MobileFullscreenViewer
            key={`mobile-viewer-${fullscreenImage.id}`}
            item={fullscreenImage}
            reduceMotion={Boolean(shouldReduceMotion)}
            onClose={() => setFullscreenImage(null)}
          />
        )}
      </AnimatePresence>

      {/* Mobile fullscreen read-only syntax-highlighted JSON code editor */}
      <AnimatePresence>
        {isJsonEditorOpen && (
          <MobileJsonEditorModal
            jsonText={fullMappedJsonText}
            onClose={() => setIsJsonEditorOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ExtractingPlaceholder() {
  const { t } = useI18n();
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-full h-full opacity-55">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-slate-100 animate-pulse"
            style={{ animationDelay: `${idx * 70}ms` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 backdrop-blur-[2px]">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" aria-hidden="true" />
        <span className="text-xs font-medium text-slate-700">
          {t.pipeline.searchingImages}
        </span>
      </div>
    </div>
  );
}

interface MobileFullscreenViewerProps {
  item: CatalogImageItem;
  reduceMotion: boolean;
  onClose: () => void;
}

function MobileFullscreenViewer({
  item,
  reduceMotion,
  onClose,
}: MobileFullscreenViewerProps) {
  const { t } = useI18n();
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [0, 260], [1, 0.25]);
  const ambientOpacity = useTransform(dragY, [0, 260], [0.35, 0.08]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 85 || info.velocity.y > 380) {
      onClose();
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      className="fixed inset-0 z-50 lg:hidden flex items-center justify-center overflow-hidden touch-none"
    >
      {/* Backdrop that subtly fades as the user swipes down */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: backdropOpacity }}
        className="absolute inset-0 bg-slate-950"
      />

      {/* Ambient blurred edge-to-edge atmosphere */}
      <motion.img
        src={item.url}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        decoding="sync"
        style={{ opacity: ambientOpacity }}
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover blur-3xl scale-110"
      />

      {/* Top swipe-down indicator */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-3 inset-x-0 z-20 flex justify-center"
      >
        <div className="w-10 h-1 rounded-full bg-white/40" />
      </div>

      {/* Draggable image surface: swipe down to close */}
      <motion.div
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.7 }}
        onDragEnd={handleDragEnd}
        style={{ y: dragY }}
        initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { y: 120, opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <img
          src={item.url}
          alt={item.alt}
          referrerPolicy="no-referrer"
          decoding="sync"
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />
      </motion.div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t.pipeline.closeImageAria}
        className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
