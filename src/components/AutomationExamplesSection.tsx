import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CheckCheck, Package } from 'lucide-react';
import carElectricSedan from '../assets/images/car_electric_sedan_1795004872845.jpg';
import carLuxurySuv from '../assets/images/car_luxury_suv_1795004873558.jpg';
import catBurger from '../assets/images/cat_burger_1794774386629.jpg';
import catChair from '../assets/images/cat_chair_1794774388745.jpg';
import catHeadphones from '../assets/images/cat_headphones_1794774386382.jpg';
import catMug from '../assets/images/cat_mug_1794774389939.jpg';
import catPerfume from '../assets/images/cat_perfume_1794774388613.jpg';
import catPizza from '../assets/images/cat_pizza_1794774388665.jpg';
import catPlant from '../assets/images/cat_plant_1794774389702.jpg';
import catSunglasses from '../assets/images/cat_sunglasses_1794774388676.jpg';
import catWatch from '../assets/images/cat_watch_1794774386848.jpg';
import gamingKeyboardMate from '../assets/images/gaming_keyboard_mate_1795004873748.jpg';
import officeErgonomicChair from '../assets/images/office_ergonomic_chair_1795004874135.jpg';
import skincareSerumGlass from '../assets/images/skincare_serum_glass_1795004874985.jpg';
import whiteCourtSneaker from '../assets/images/white_court_sneaker_1795003832742.jpg';
import whiteRunnerSneaker from '../assets/images/white_runner_sneaker_1795003832857.jpg';
import { useI18n } from '../lib/i18n';

const WHATSAPP_WALLPAPER_URL =
  '/assets/aistudio/IMG_20261118_070436_08aaef60.jpg';

interface AutomationExamplesSectionProps {
  visible: boolean;
}

type PlatformKey =
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'messenger'
  | 'web'
  | 'discord'
  | 'slack'
  | 'line';

interface ExampleProductCard {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
}

interface AutomationExampleConfig {
  id: PlatformKey;
  companyName: string;
  timestamp1: string;
  timestamp2: string;
  products: [
    { id: string; imageUrl: string },
    { id: string; imageUrl: string },
  ];
}

const AUTOMATION_EXAMPLE_META: AutomationExampleConfig[] = [
  {
    id: 'whatsapp',
    companyName: 'Veloce Calzado',
    timestamp1: '10:42',
    timestamp2: '10:43',
    products: [
      { id: 'wa-court', imageUrl: whiteCourtSneaker },
      { id: 'wa-runner', imageUrl: whiteRunnerSneaker },
    ],
  },
  {
    id: 'telegram',
    companyName: 'Apex Motors',
    timestamp1: '11:05',
    timestamp2: '11:05',
    products: [
      { id: 'tg-sedan', imageUrl: carElectricSedan },
      { id: 'tg-suv', imageUrl: carLuxurySuv },
    ],
  },
  {
    id: 'instagram',
    companyName: 'Núa Studio',
    timestamp1: '14:18',
    timestamp2: '14:18',
    products: [
      { id: 'ig-watch', imageUrl: catWatch },
      { id: 'ig-glasses', imageUrl: catSunglasses },
    ],
  },
  {
    id: 'messenger',
    companyName: 'Casa Nórdica',
    timestamp1: '16:20',
    timestamp2: '16:21',
    products: [
      { id: 'ms-chair', imageUrl: catChair },
      { id: 'ms-plant', imageUrl: catPlant },
    ],
  },
  {
    id: 'web',
    companyName: 'Bistro Brasa',
    timestamp1: '19:40',
    timestamp2: '19:40',
    products: [
      { id: 'web-burger', imageUrl: catBurger },
      { id: 'web-pizza', imageUrl: catPizza },
    ],
  },
  {
    id: 'discord',
    companyName: 'Pulse Gear',
    timestamp1: '21:10',
    timestamp2: '21:10',
    products: [
      { id: 'dc-audio', imageUrl: catHeadphones },
      { id: 'dc-kb', imageUrl: gamingKeyboardMate },
    ],
  },
  {
    id: 'slack',
    companyName: 'WorkCraft B2B',
    timestamp1: '09:15',
    timestamp2: '09:15',
    products: [
      { id: 'sl-chair', imageUrl: officeErgonomicChair },
      { id: 'sl-mug', imageUrl: catMug },
    ],
  },
  {
    id: 'line',
    companyName: 'Sora Botanics',
    timestamp1: '13:30',
    timestamp2: '13:31',
    products: [
      { id: 'ln-serum', imageUrl: skincareSerumGlass },
      { id: 'ln-perfume', imageUrl: catPerfume },
    ],
  },
];

interface ResolvedAutomationExample {
  id: PlatformKey;
  bottomLabel: string;
  companyName: string;
  accountType: string;
  headerSubline: string;
  userGreeting: string;
  botGreeting: string;
  userRequest: string;
  botResultText: string;
  timestamp1: string;
  timestamp2: string;
  products: [ExampleProductCard, ExampleProductCard];
}

type ConversationStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TIMINGS_MS: Array<{ step: ConversationStep; delay: number }> = [
  { step: 1, delay: 400 },
  { step: 2, delay: 1250 },
  { step: 3, delay: 2100 },
  { step: 4, delay: 3500 },
  { step: 5, delay: 4400 },
  { step: 6, delay: 5300 },
];

const LOOP_RESET_DELAY_MS = 10800;

export function AutomationExamplesSection({
  visible,
}: AutomationExamplesSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
  }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    dragStateRef.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDown) return;
    const el = trackRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStateRef.current.startX) * 1.25;
    el.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };

  const stopDragging = () => {
    if (!dragStateRef.current.isDown) return;
    dragStateRef.current.isDown = false;
    setIsDragging(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          key="desktop-automation-examples"
          aria-label={t.examples.sectionAria}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 hidden lg:block w-full max-w-[1360px] mx-auto mt-14 pb-8"
        >
          {/* Clean heading & subtitle without extra action buttons */}
          <div className="mb-5 px-1">
            <h2 className="text-xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] text-balance">
              {t.examples.sectionTitle}
            </h2>
            <p className="mt-1 text-sm text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.6)]">
              {t.examples.sectionSubtitle}
            </p>
          </div>

          {/* Single horizontal scrollable row: 5 uniform cards fit side-by-side on desktop; slide horizontally for all 8 */}
          <div
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            className={`flex flex-nowrap gap-4 overflow-x-auto pb-4 select-none [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.35)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/35 hover:[&::-webkit-scrollbar-thumb]:bg-white/55 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {AUTOMATION_EXAMPLE_META.map((meta, index) => {
              const localized = t.examples.items[meta.id];
              const resolvedExample: ResolvedAutomationExample = {
                id: meta.id,
                companyName: meta.companyName,
                timestamp1: meta.timestamp1,
                timestamp2: meta.timestamp2,
                bottomLabel: localized.bottomLabel,
                accountType: localized.accountType,
                headerSubline: localized.headerSubline,
                userGreeting: localized.userGreeting,
                botGreeting: localized.botGreeting,
                userRequest: localized.userRequest,
                botResultText: localized.botResultText,
                products: [
                  {
                    id: meta.products[0].id,
                    imageUrl: meta.products[0].imageUrl,
                    name: localized.products[0].name,
                    subtitle: localized.products[0].subtitle,
                  },
                  {
                    id: meta.products[1].id,
                    imageUrl: meta.products[1].imageUrl,
                    name: localized.products[1].name,
                    subtitle: localized.products[1].subtitle,
                  },
                ],
              };

              return (
                <PlatformChatCard
                  key={meta.id}
                  example={resolvedExample}
                  visitorName={t.examples.visitorName}
                  cardAria={t.examples.cardAria(localized.bottomLabel)}
                  staggerMs={index * 450}
                  visible={visible}
                  shouldReduceMotion={Boolean(shouldReduceMotion)}
                />
              );
            })}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

interface PlatformChatCardProps {
  example: ResolvedAutomationExample;
  visitorName: string;
  cardAria: string;
  staggerMs: number;
  visible: boolean;
  shouldReduceMotion: boolean;
}

function PlatformChatCard({
  example,
  visitorName,
  cardAria,
  staggerMs,
  visible,
  shouldReduceMotion,
}: PlatformChatCardProps) {
  const [step, setStep] = useState<ConversationStep>(
    shouldReduceMotion ? 6 : 1,
  );
  const [cycleId, setCycleId] = useState(0);
  const [wallpaperFailed, setWallpaperFailed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) return;
    if (shouldReduceMotion) {
      setStep(6);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    const startTimer = window.setTimeout(
      () => {
        if (cancelled) return;
        setStep(1);

        for (const item of STEP_TIMINGS_MS) {
          if (item.step === 1) continue;
          timers.push(
            window.setTimeout(() => {
              if (!cancelled) setStep(item.step);
            }, item.delay),
          );
        }

        timers.push(
          window.setTimeout(() => {
            if (!cancelled) setCycleId((prev) => prev + 1);
          }, LOOP_RESET_DELAY_MS),
        );
      },
      cycleId === 0 ? staggerMs : 0,
    );

    timers.push(startTimer);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [visible, shouldReduceMotion, cycleId, staggerMs]);

  const isDiscord = example.id === 'discord';
  const theme = getPlatformVisualTheme(example.id);

  return (
    <div className="w-[258px] shrink-0 flex flex-col items-start">
      <article
        aria-label={cardAria}
        className={`w-full rounded-3xl overflow-hidden flex flex-col border shadow-[0_18px_44px_-14px_rgba(0,0,0,0.48)] ${
          isDiscord
            ? 'bg-[#2B2D31] border-white/15'
            : 'bg-white border-white/85'
        }`}
      >
        {/* Fixed-height platform header with fictional brand emblem + account label */}
        <header
          className={`h-[52px] px-3 flex items-center gap-2.5 shrink-0 border-b ${theme.headerClass}`}
        >
          <PlatformBrandEmblem platform={example.id} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`text-[12px] font-semibold tracking-tight truncate ${theme.titleClass}`}
              >
                {example.companyName}
              </span>
              <span
                aria-hidden="true"
                className={`text-[10px] shrink-0 ${theme.sepClass}`}
              >
                ·
              </span>
              <span
                className={`text-[10.5px] font-semibold whitespace-nowrap shrink-0 ${theme.roleClass}`}
              >
                {example.accountType}
              </span>
            </div>
            <p className={`text-[10px] truncate ${theme.sublineClass}`}>
              {example.headerSubline}
            </p>
          </div>
        </header>

        {/* Platform-authentic chat canvas: always top-down (justify-start) */}
        <div
          className={`relative h-[332px] px-2.5 py-3 overflow-hidden flex flex-col justify-start ${theme.canvasClass}`}
        >
          {/* WhatsApp authentic wallpaper */}
          {example.id === 'whatsapp' && !wallpaperFailed && (
            <>
              <img
                src={WHATSAPP_WALLPAPER_URL}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                onError={() => setWallpaperFailed(true)}
                className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-85"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#EFEAE2]/15"
              />
            </>
          )}

          {/* Telegram subtle classic pattern overlay */}
          {example.id === 'telegram' && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.65) 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.55) 1.5px, transparent 2px)',
                backgroundSize: '36px 36px',
              }}
            />
          )}

          <div
            key={`${example.id}-cycle-${cycleId}`}
            className="relative z-10 flex flex-col gap-2 w-full"
          >
            {/* Turn 1: User outgoing message */}
            {step >= 1 && (
              <motion.div
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={isDiscord ? 'flex justify-start' : 'flex justify-end'}
              >
                <div
                  className={`max-w-[84%] px-2.5 py-1.5 ${theme.userBubbleClass}`}
                >
                  {isDiscord && (
                    <p className="text-[10px] font-semibold text-white mb-0.5">
                      {visitorName}
                    </p>
                  )}
                  <div className="flex items-end gap-1.5">
                    <p className="text-[11.5px] leading-snug">
                      {example.userGreeting}
                    </p>
                    <BubbleTimestamp
                      time={example.timestamp1}
                      outgoing
                      platform={example.id}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Turn 2: Bot typing indicator */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className={`px-3 py-2 flex items-center gap-1 ${theme.typingBubbleClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.2s] ${theme.typingDotClass}`} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.1s] ${theme.typingDotClass}`} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${theme.typingDotClass}`} />
                </div>
              </motion.div>
            )}

            {/* Turn 2: Bot greeting reply */}
            {step >= 3 && (
              <motion.div
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-start"
              >
                <div
                  className={`max-w-[88%] px-2.5 py-1.5 ${theme.botBubbleClass}`}
                >
                  {isDiscord && (
                    <p className="text-[10px] font-semibold text-[#949CF7] mb-0.5">
                      {example.companyName}
                    </p>
                  )}
                  <div className="flex items-end gap-1.5">
                    <p className="text-[11.5px] leading-snug">
                      {example.botGreeting}
                    </p>
                    <BubbleTimestamp
                      time={example.timestamp1}
                      outgoing={false}
                      platform={example.id}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Turn 3: User product catalog request */}
            {step >= 4 && (
              <motion.div
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={isDiscord ? 'flex justify-start' : 'flex justify-end'}
              >
                <div
                  className={`max-w-[88%] px-2.5 py-1.5 ${theme.userBubbleClass}`}
                >
                  {isDiscord && (
                    <p className="text-[10px] font-semibold text-white mb-0.5">
                      {visitorName}
                    </p>
                  )}
                  <div className="flex items-end gap-1.5">
                    <p className="text-[11.5px] leading-snug">
                      {example.userRequest}
                    </p>
                    <BubbleTimestamp
                      time={example.timestamp1}
                      outgoing
                      platform={example.id}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Turn 4: Bot typing indicator while querying Search Link Core */}
            {step === 5 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className={`px-3 py-2 flex items-center gap-1 ${theme.typingBubbleClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.2s] ${theme.typingDotClass}`} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.1s] ${theme.typingDotClass}`} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${theme.typingDotClass}`} />
                </div>
              </motion.div>
            )}

            {/* Turn 4: 2 rounded product cards FIRST + friendly reply text directly below */}
            {step >= 6 && (
              <motion.div
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-start"
              >
                <div className={`w-full max-w-[97%] p-1.5 ${theme.botCatalogBubbleClass}`}>
                  {isDiscord && (
                    <p className="text-[10px] font-semibold text-[#949CF7] mb-1 px-0.5">
                      {example.companyName}
                    </p>
                  )}

                  {/* Two rounded product image cards */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {example.products.map((prod, idx) => {
                      const broken = Boolean(failedImages[prod.id]);
                      return (
                        <motion.div
                          key={prod.id}
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, y: 5 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.2,
                            delay: shouldReduceMotion ? 0 : idx * 0.06,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`rounded-lg border overflow-hidden ${theme.productCardClass}`}
                        >
                          <div
                            className={`aspect-[4/3] overflow-hidden flex items-center justify-center ${
                              isDiscord ? 'bg-[#1E1F22]' : 'bg-slate-100'
                            }`}
                          >
                            {!broken ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedImages((prev) => ({
                                    ...prev,
                                    [prod.id]: true,
                                  }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package
                                className="w-4 h-4 text-slate-400"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className={`px-1.5 py-1 ${theme.productMetaBgClass}`}>
                            <p
                              className={`text-[10px] font-semibold truncate ${theme.productTitleClass}`}
                            >
                              {prod.name}
                            </p>
                            <p
                              className={`text-[9px] truncate ${theme.productSubClass}`}
                            >
                              {prod.subtitle}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Reply text right below the two product images */}
                  <div className="mt-1.5 px-0.5 flex items-end justify-between gap-1.5">
                    <p className={`text-[11px] leading-snug ${theme.catalogCaptionClass}`}>
                      {example.botResultText}
                    </p>
                    <BubbleTimestamp
                      time={example.timestamp2}
                      outgoing={false}
                      platform={example.id}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </article>

      {/* Clean platform descriptor directly below the card */}
      <p className="mt-2.5 pl-1 text-xs font-medium text-white tracking-tight drop-shadow-[0_1px_10px_rgba(0,0,0,0.65)]">
        {example.bottomLabel}
      </p>
    </div>
  );
}

function BubbleTimestamp({
  time,
  outgoing,
  platform,
}: {
  time: string;
  outgoing: boolean;
  platform: PlatformKey;
}) {
  if (platform === 'instagram' || platform === 'messenger' || platform === 'web') {
    return null;
  }

  const timeColor =
    platform === 'discord'
      ? 'text-[#949BA4]'
      : platform === 'line' && outgoing
        ? 'text-[#2D5E1E]'
        : platform === 'telegram' && outgoing
          ? 'text-[#4FAE4E]'
          : 'text-[#667781]';

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] tabular-nums shrink-0 translate-y-0.5 ${timeColor}`}
    >
      {time}
      {outgoing && platform === 'whatsapp' && (
        <CheckCheck className="w-2.5 h-2.5 text-[#53BDEB]" aria-hidden="true" />
      )}
      {outgoing && platform === 'telegram' && (
        <CheckCheck className="w-2.5 h-2.5 text-[#4FAE4E]" aria-hidden="true" />
      )}
      {outgoing && platform === 'line' && (
        <Check className="w-2.5 h-2.5 text-[#2D5E1E]" aria-hidden="true" />
      )}
    </span>
  );
}

function PlatformBrandEmblem({ platform }: { platform: PlatformKey }) {
  switch (platform) {
    case 'whatsapp':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 28 28" className="w-4 h-4" fill="none">
            <path
              d="M5.5 8.5L13.4 20.5L22.5 8.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 8.5L14.2 13.4L17.4 8.5"
              stroke="#34D399"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case 'telegram':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-[#2AABEE] text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path
              d="M4 15L8.5 9H16.5L20 15H4Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="16.5" r="1.4" fill="currentColor" />
            <circle cx="16" cy="16.5" r="1.4" fill="currentColor" />
          </svg>
        </div>
      );
    case 'instagram':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] shrink-0"
        >
          <div className="w-full h-full rounded-full bg-slate-950 text-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7V17" stroke="#F472B6" strokeWidth="1.8" />
            </svg>
          </div>
        </div>
      );
    case 'messenger':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-[#0084FF] text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path
              d="M4.5 11.5L12 5.5L19.5 11.5V19H4.5V11.5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case 'web':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8.5 12H15.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    case 'discord':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-[#5865F2] text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path
              d="M6.5 9.5L12 6L17.5 9.5V14.5L12 18L6.5 14.5V9.5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case 'slack':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-lg bg-[#4A154B] text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <rect
              x="5.5"
              y="5.5"
              width="5"
              height="5"
              rx="1.2"
              fill="#36C5F0"
            />
            <rect
              x="13.5"
              y="5.5"
              width="5"
              height="5"
              rx="1.2"
              fill="#2EB67D"
            />
            <rect
              x="5.5"
              y="13.5"
              width="5"
              height="5"
              rx="1.2"
              fill="#ECB22E"
            />
            <rect
              x="13.5"
              y="13.5"
              width="5"
              height="5"
              rx="1.2"
              fill="#E01E5A"
            />
          </svg>
        </div>
      );
    case 'line':
      return (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path
              d="M12 5C15.5 8 17.5 11 17.5 14C17.5 17 15 19 12 19C9 19 6.5 17 6.5 14C6.5 11 8.5 8 12 5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
  }
}

function getPlatformVisualTheme(platform: PlatformKey) {
  switch (platform) {
    case 'whatsapp':
      return {
        headerClass: 'bg-white border-slate-200/80',
        titleClass: 'text-slate-950',
        sepClass: 'text-slate-300',
        roleClass: 'text-emerald-700',
        sublineClass: 'text-slate-500',
        canvasClass: 'bg-[#EFEAE2]',
        userBubbleClass:
          'rounded-2xl rounded-tr-sm bg-[#D9FDD3] text-[#111B21] shadow-[0_1px_2px_rgba(11,20,26,0.13)]',
        botBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white text-[#111B21] shadow-[0_1px_2px_rgba(11,20,26,0.13)]',
        botCatalogBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white text-[#111B21] shadow-[0_1px_2px_rgba(11,20,26,0.14)]',
        typingBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white shadow-[0_1px_2px_rgba(11,20,26,0.13)]',
        typingDotClass: 'bg-slate-400',
        productCardClass: 'border-slate-200/85 bg-slate-50/50',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-[#111B21]',
      };
    case 'telegram':
      return {
        headerClass: 'bg-white border-slate-200/80',
        titleClass: 'text-slate-950',
        sepClass: 'text-slate-300',
        roleClass: 'text-[#2AABEE]',
        sublineClass: 'text-slate-500',
        canvasClass:
          'bg-gradient-to-br from-[#D7EAC8] via-[#C3DFCB] to-[#9FC8DE]',
        userBubbleClass:
          'rounded-2xl rounded-br-sm bg-[#EEFFDE] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.12)]',
        botBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.12)]',
        botCatalogBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.14)]',
        typingBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white shadow-[0_1px_2px_rgba(15,23,42,0.12)]',
        typingDotClass: 'bg-[#2AABEE]/70',
        productCardClass: 'border-slate-200/85 bg-slate-50/60',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-slate-900',
      };
    case 'instagram':
      return {
        headerClass: 'bg-white border-slate-200/80',
        titleClass: 'text-slate-950',
        sepClass: 'text-slate-300',
        roleClass: 'text-[#DD2A7B]',
        sublineClass: 'text-slate-500',
        canvasClass: 'bg-white',
        userBubbleClass:
          'rounded-2xl rounded-br-sm bg-gradient-to-br from-[#5851DB] to-[#833AB4] text-white',
        botBubbleClass: 'rounded-2xl rounded-bl-sm bg-[#EFEFEF] text-slate-900',
        botCatalogBubbleClass:
          'rounded-2xl rounded-bl-sm bg-[#F5F5F7] border border-slate-200/75 text-slate-900',
        typingBubbleClass: 'rounded-2xl rounded-bl-sm bg-[#EFEFEF]',
        typingDotClass: 'bg-slate-400',
        productCardClass: 'border-slate-200/90 bg-white',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-slate-800',
      };
    case 'messenger':
      return {
        headerClass: 'bg-white border-slate-200/80',
        titleClass: 'text-slate-950',
        sepClass: 'text-slate-300',
        roleClass: 'text-[#0084FF]',
        sublineClass: 'text-slate-500',
        canvasClass: 'bg-white',
        userBubbleClass:
          'rounded-2xl rounded-br-sm bg-[#0084FF] text-white',
        botBubbleClass: 'rounded-2xl rounded-bl-sm bg-[#F0F2F5] text-[#050505]',
        botCatalogBubbleClass:
          'rounded-2xl rounded-bl-sm bg-[#F0F2F5] text-[#050505]',
        typingBubbleClass: 'rounded-2xl rounded-bl-sm bg-[#F0F2F5]',
        typingDotClass: 'bg-slate-400',
        productCardClass: 'border-slate-200/85 bg-white',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-[#050505]',
      };
    case 'web':
      return {
        headerClass: 'bg-slate-950 border-slate-800',
        titleClass: 'text-white',
        sepClass: 'text-slate-600',
        roleClass: 'text-amber-400',
        sublineClass: 'text-slate-400',
        canvasClass: 'bg-[#F8FAFC]',
        userBubbleClass:
          'rounded-2xl rounded-br-sm bg-slate-900 text-white shadow-xs',
        botBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white border border-slate-200/85 text-slate-900',
        botCatalogBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white border border-slate-200/85 text-slate-900 shadow-xs',
        typingBubbleClass:
          'rounded-2xl rounded-bl-sm bg-white border border-slate-200/85',
        typingDotClass: 'bg-slate-400',
        productCardClass: 'border-slate-200/85 bg-slate-50',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-slate-800',
      };
    case 'discord':
      return {
        headerClass: 'bg-[#2B2D31] border-[#1E1F22]',
        titleClass: 'text-white',
        sepClass: 'text-slate-500',
        roleClass: 'text-[#949CF7]',
        sublineClass: 'text-[#949BA4]',
        canvasClass: 'bg-[#313338]',
        userBubbleClass:
          'rounded-xl bg-[#383A40] border border-white/[0.06] text-[#DBDEE1]',
        botBubbleClass:
          'rounded-xl bg-[#2B2D31] border border-white/[0.08] text-[#DBDEE1]',
        botCatalogBubbleClass:
          'rounded-xl bg-[#2B2D31] border border-[#5865F2]/40 text-[#DBDEE1]',
        typingBubbleClass:
          'rounded-xl bg-[#2B2D31] border border-white/[0.08]',
        typingDotClass: 'bg-[#949CF7]',
        productCardClass: 'border-white/10 bg-[#1E1F22]',
        productMetaBgClass: 'bg-[#1E1F22]',
        productTitleClass: 'text-white',
        productSubClass: 'text-[#949BA4]',
        catalogCaptionClass: 'text-[#DBDEE1]',
      };
    case 'slack':
      return {
        headerClass: 'bg-[#4A154B] border-[#3B0F3C]',
        titleClass: 'text-white',
        sepClass: 'text-white/40',
        roleClass: 'text-[#ECB22E]',
        sublineClass: 'text-white/75',
        canvasClass: 'bg-white',
        userBubbleClass:
          'rounded-xl bg-[#F4EDE4] border border-[#4A154B]/10 text-[#1D1C1D]',
        botBubbleClass:
          'rounded-xl bg-[#F8F8F8] border border-slate-200 text-[#1D1C1D]',
        botCatalogBubbleClass:
          'rounded-xl bg-[#F8F8F8] border border-slate-200/90 text-[#1D1C1D]',
        typingBubbleClass: 'rounded-xl bg-[#F8F8F8] border border-slate-200',
        typingDotClass: 'bg-[#4A154B]/70',
        productCardClass: 'border-slate-200/90 bg-white',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-[#1D1C1D]',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-[#1D1C1D]',
      };
    case 'line':
      return {
        headerClass: 'bg-[#253041] border-slate-700/60',
        titleClass: 'text-white',
        sepClass: 'text-slate-500',
        roleClass: 'text-[#06C755]',
        sublineClass: 'text-slate-300',
        canvasClass: 'bg-[#7A9AC7]',
        userBubbleClass:
          'rounded-2xl rounded-tr-sm bg-[#8DE055] text-[#111B21] shadow-[0_1px_2px_rgba(15,23,42,0.14)]',
        botBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white text-[#111B21] shadow-[0_1px_2px_rgba(15,23,42,0.14)]',
        botCatalogBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white text-[#111B21] shadow-[0_1px_2px_rgba(15,23,42,0.15)]',
        typingBubbleClass:
          'rounded-2xl rounded-tl-sm bg-white shadow-[0_1px_2px_rgba(15,23,42,0.14)]',
        typingDotClass: 'bg-[#06C755]',
        productCardClass: 'border-slate-200/90 bg-slate-50/50',
        productMetaBgClass: 'bg-white',
        productTitleClass: 'text-slate-900',
        productSubClass: 'text-slate-500',
        catalogCaptionClass: 'text-[#111B21]',
      };
  }
}
