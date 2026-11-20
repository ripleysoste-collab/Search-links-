import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useI18n } from '../lib/i18n';
import type { OrganizationServiceItem } from './DesktopOrganizationView';

interface DesktopStoreViewProps {
  service: OrganizationServiceItem;
  organizationName: string;
  organizationLogoUrl: string | null;
}

export function DesktopStoreView({
  service,
  organizationName,
  organizationLogoUrl,
}: DesktopStoreViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  const products = service.products ?? [];

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Authentic Search Link luminous radiant backdrop (matching mobile interface) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, #eef6ff 0%, #f8fbff 42%, #ffffff 70%, #f2fbf6 100%)',
        }}
      >
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [-14, 22, -8, -14],
                  y: [-10, 18, 8, -10],
                  scale: [1, 1.07, 0.96, 1],
                }
          }
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-20 -left-16 w-[75%] h-[42%] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(59, 130, 246, 0.26) 0%, rgba(96, 165, 250, 0.13) 55%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [16, -20, 12, 16],
                  y: [8, -14, 18, 8],
                  scale: [1.02, 0.95, 1.06, 1.02],
                }
          }
          transition={{
            duration: 21,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-12 -right-20 w-[72%] h-[40%] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(234, 67, 53, 0.18) 0%, rgba(245, 158, 11, 0.14) 50%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [-14, 18, -16, -14],
                  y: [14, -16, 6, 14],
                  scale: [0.98, 1.06, 1, 0.98],
                }
          }
          transition={{
            duration: 23,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[38%] -left-16 w-[74%] h-[40%] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(59, 130, 246, 0.11) 55%, transparent 76%)',
          }}
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [12, -22, 10, 12],
                  y: [-12, 16, -6, -12],
                  scale: [1, 1.08, 0.97, 1],
                }
          }
          transition={{
            duration: 19,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -bottom-20 -right-14 w-[78%] h-[44%] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.20) 0%, rgba(59, 130, 246, 0.14) 52%, transparent 76%)',
          }}
        />
      </div>

      {/* Scrollable Store Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Store identity bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {organizationLogoUrl && (
              <div className="w-8 h-8 rounded-full border border-white/90 bg-white overflow-hidden shrink-0 shadow-xs">
                <img
                  src={organizationLogoUrl}
                  alt={organizationName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-950 truncate">
                {service.name}
              </p>
              {organizationName && organizationName !== 'Sin nombre' && (
                <p className="text-[11px] text-slate-500 truncate">
                  {organizationName}
                </p>
              )}
            </div>
          </div>

          <span className="text-[11px] font-medium text-slate-500 tabular-nums shrink-0">
            {t.org.productCount(products.length)}
          </span>
        </div>

        {/* 3-per-row rounded product grid */}
        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/90 bg-white/75 backdrop-blur-md px-5 py-10 text-center shadow-xs">
            <p className="text-sm font-medium text-slate-800">
              {t.store.emptyTitle}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {t.store.emptyDescDesktop}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {products.map((product) => {
              const isNameExpanded = expandedProductId === product.id;
              const imgBroken = Boolean(failedImageIds[product.id]);

              return (
                <article
                  key={product.id}
                  className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/95 ring-1 ring-slate-900/[0.04] shadow-[0_8px_24px_-10px_rgba(15,23,42,0.12)] p-2 flex flex-col transition-shadow hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.18)]"
                >
                  {/* Small rounded product visual box */}
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-slate-100/80">
                    {!imgBroken && product.url ? (
                      <img
                        src={product.url}
                        alt={product.nombre}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImageIds((prev) => ({
                            ...prev,
                            [product.id]: true,
                          }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                        {t.store.noImage}
                      </div>
                    )}
                  </div>

                  {/* AI product name (tap to expand full name) + smaller category below */}
                  <div className="pt-2 px-0.5 space-y-0.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProductId((prev) =>
                          prev === product.id ? null : product.id,
                        )
                      }
                      title={
                        isNameExpanded
                          ? t.store.tapToCollapse
                          : t.store.tapToExpandFull(
                              product.nombre || t.store.unnamedProduct,
                            )
                      }
                      className="w-full text-left focus-visible:outline-none focus-visible:underline cursor-pointer"
                    >
                      <p
                        className={`text-[12px] font-semibold text-slate-900 leading-snug ${
                          isNameExpanded ? 'whitespace-normal break-words' : 'truncate'
                        }`}
                      >
                        {product.nombre || t.store.unnamedProduct}
                      </p>
                    </button>

                    <p className="text-[10.5px] font-medium text-slate-500 truncate">
                      {product.categoria || t.common.generalCategory}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
