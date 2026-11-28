import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface PlansSectionProps {
  visible: boolean;
}

type PlanTierId = 'free' | 'plus' | 'plusMax';

interface PlanCardConfig {
  id: PlanTierId;
  cardAria: string;
  name: string;
  subtitle: string;
  price: string;
  features: string[];
  surfaceClass: string;
  glowStyle: string;
  headerBorderClass: string;
  titleClass: string;
  subtitleClass: string;
  priceClass: string;
  periodClass: string;
  checkClass: string;
  featureTextClass: string;
}

export function PlansSection({ visible }: PlansSectionProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  const plans: PlanCardConfig[] = [
    {
      id: 'free',
      cardAria: t.plans.free.cardAria,
      name: t.plans.free.name,
      subtitle: t.plans.free.subtitle,
      price: t.plans.free.price,
      features: t.plans.free.features,
      surfaceClass:
        'bg-gradient-to-br from-white via-[#f7fbff] to-[#eef6ff] border border-sky-200/85 lg:border-white/90 shadow-[0_14px_38px_-12px_rgba(15,23,42,0.12),0_4px_12px_-4px_rgba(37,99,235,0.08)] lg:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)]',
      glowStyle:
        'radial-gradient(circle at 92% 8%, rgba(59,130,246,0.12) 0%, transparent 56%)',
      headerBorderClass: 'border-sky-100/90',
      titleClass: 'text-slate-950',
      subtitleClass: 'text-slate-500',
      priceClass: 'text-slate-950',
      periodClass: 'text-slate-400',
      checkClass: 'text-blue-600',
      featureTextClass: 'text-slate-700',
    },
    {
      id: 'plus',
      cardAria: t.plans.plus.cardAria,
      name: t.plans.plus.name,
      subtitle: t.plans.plus.subtitle,
      price: t.plans.plus.price,
      features: t.plans.plus.features,
      surfaceClass:
        'bg-gradient-to-br from-[#eff6ff] via-[#ecfeff] to-[#ecfdf5] border border-blue-300/85 lg:border-blue-200/90 shadow-[0_16px_40px_-14px_rgba(37,99,235,0.22),0_4px_14px_-4px_rgba(16,185,129,0.14)] lg:shadow-[0_22px_52px_-12px_rgba(0,0,0,0.48)]',
      glowStyle:
        'radial-gradient(circle at 90% 10%, rgba(37,99,235,0.16) 0%, transparent 54%), radial-gradient(circle at 8% 92%, rgba(16,185,129,0.15) 0%, transparent 54%)',
      headerBorderClass: 'border-blue-200/70',
      titleClass: 'text-slate-950',
      subtitleClass: 'text-blue-700',
      priceClass: 'text-blue-950',
      periodClass: 'text-slate-500',
      checkClass: 'text-emerald-600',
      featureTextClass: 'text-slate-800',
    },
    {
      id: 'plusMax',
      cardAria: t.plans.plusMax.cardAria,
      name: t.plans.plusMax.name,
      subtitle: t.plans.plusMax.subtitle,
      price: t.plans.plusMax.price,
      features: t.plans.plusMax.features,
      surfaceClass:
        'bg-gradient-to-br from-[#0f172a] via-[#162d59] to-[#064e3b] border border-sky-300/35 ring-1 ring-inset ring-white/10 shadow-[0_18px_44px_-12px_rgba(15,23,42,0.45),0_6px_18px_-4px_rgba(16,185,129,0.20)] lg:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.60)]',
      glowStyle:
        'radial-gradient(circle at 88% 10%, rgba(56,189,248,0.22) 0%, transparent 54%), radial-gradient(circle at 12% 92%, rgba(16,185,129,0.22) 0%, transparent 56%)',
      headerBorderClass: 'border-white/15',
      titleClass: 'text-white',
      subtitleClass: 'text-sky-200/90',
      priceClass: 'text-white',
      periodClass: 'text-slate-300/80',
      checkClass: 'text-emerald-400',
      featureTextClass: 'text-slate-100',
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          key="home-plans-section"
          aria-label={t.plans.sectionAria}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[1360px] mx-auto mt-7 lg:mt-12 pb-6 lg:pb-10"
        >
          <div className="mb-3 lg:mb-5 px-1">
            <h2 className="text-[15px] sm:text-base lg:text-xl font-semibold tracking-[-0.015em] lg:tracking-tight text-slate-950 lg:text-white lg:drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
              {t.plans.sectionTitle}
            </h2>
          </div>

          <div className="-mx-4 sm:-mx-5 px-4 sm:px-5 overflow-x-auto snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-5 flex items-stretch gap-2.5 sm:gap-3.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:overflow-visible lg:pb-0 lg:grid lg:grid-cols-3 lg:gap-5 xl:gap-6 lg:max-w-[1040px]">
            {plans.map((plan) => (
              <article
                key={plan.id}
                aria-label={plan.cardAria}
                className={`relative overflow-hidden w-[43vw] min-w-[156px] max-w-[235px] shrink-0 snap-start lg:w-auto lg:min-w-0 lg:max-w-none rounded-[20px] sm:rounded-[22px] lg:rounded-3xl p-3.5 sm:p-4 lg:p-6 flex flex-col ${plan.surfaceClass}`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: plan.glowStyle }}
                />

                <header
                  className={`relative z-10 pb-3 lg:pb-4 border-b ${plan.headerBorderClass}`}
                >
                  <h3
                    className={`text-[14px] sm:text-[15px] lg:text-lg font-semibold tracking-tight ${plan.titleClass}`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-0.5 text-[10.5px] sm:text-[11.5px] lg:text-xs font-medium leading-snug ${plan.subtitleClass}`}
                  >
                    {plan.subtitle}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className={`text-[22px] sm:text-2xl lg:text-[30px] font-bold tracking-tight tabular-nums leading-none ${plan.priceClass}`}
                    >
                      {plan.price}
                    </span>
                    <span
                      className={`text-[11px] sm:text-xs lg:text-[13px] font-medium ${plan.periodClass}`}
                    >
                      {t.plans.perMonth}
                    </span>
                  </div>
                </header>

                <ul className="relative z-10 mt-3 lg:mt-4 flex flex-col gap-2 lg:gap-2.5">
                  {plan.features.map((label) => (
                    <li
                      key={label}
                      className="flex items-start gap-1.5 sm:gap-2 min-w-0"
                    >
                      <Check
                        className={`w-3.5 h-3.5 lg:w-4 lg:h-4 mt-[1px] shrink-0 stroke-[2.35] ${plan.checkClass}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`text-[11px] sm:text-[12.5px] lg:text-[13.5px] leading-snug font-medium tabular-nums ${plan.featureTextClass}`}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
