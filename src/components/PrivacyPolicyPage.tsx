import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { PRIVACY_POLICY_CONTENT } from '../data/privacyPolicyContent';
import { useI18n, type SupportedLocale } from '../lib/i18n';
import { SearchLinkLogo } from './SearchLinkLogo';

interface PrivacyPolicyPageProps {
  onBack: () => void;
}

const LOCALE_SHORT_LABELS: Array<{ code: SupportedLocale; label: string }> = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];

export function PrivacyPolicyPage({ onBack }: PrivacyPolicyPageProps) {
  const { locale, setManualLocale } = useI18n();
  const doc = PRIVACY_POLICY_CONTENT[locale];
  const [activeSectionId, setActiveSectionId] = useState<string>(
    doc.sections[0]?.id ?? '',
  );
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  useEffect(() => {
    setActiveSectionId(doc.sections[0]?.id ?? '');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [locale, doc.sections]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${doc.documentTitle} — Search Link`;
    return () => {
      document.title = previousTitle;
    };
  }, [doc.documentTitle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sectionElements = doc.sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-96px 0px -60% 0px',
        threshold: 0.05,
      },
    );

    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [doc.sections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setMobileTocOpen(false);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-dvh w-full bg-white text-black antialiased selection:bg-neutral-900 selection:text-white">
      {/* ============================================================
          DESKTOP HEADER & INSTITUTIONAL NAVIGATION BAR (lg+)
         ============================================================ */}
      <header className="hidden lg:block sticky top-0 z-30 bg-white/96 backdrop-blur-sm border-b border-neutral-200">
        <div className="max-w-[1140px] mx-auto px-10 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-black transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{doc.backLabel}</span>
            </button>
            <span className="h-4 w-px bg-neutral-200 shrink-0" aria-hidden="true" />
            <SearchLinkLogo size="sm" />
          </div>

          <div
            role="group"
            aria-label="Language"
            className="flex items-center divide-x divide-neutral-200 border border-neutral-200 bg-white"
          >
            {LOCALE_SHORT_LABELS.map((item) => {
              const active = locale === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setManualLocale(item.code)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                    active
                      ? 'bg-black text-white'
                      : 'bg-white text-neutral-600 hover:text-black hover:bg-neutral-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ============================================================
          MOBILE STICKY COMPACT TOP BAR & SECTION DRAWER (< lg)
         ============================================================ */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label={doc.backLabel}
              className="w-10 h-10 -ml-2 flex items-center justify-center text-black hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <SearchLinkLogo size="sm" />
          </div>

          <div
            role="group"
            aria-label="Language"
            className="flex items-center divide-x divide-neutral-200 border border-neutral-200 bg-white shrink-0"
          >
            {LOCALE_SHORT_LABELS.map((item) => {
              const active = locale === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setManualLocale(item.code)}
                  aria-pressed={active}
                  className={`min-w-[36px] min-h-[32px] px-2.5 text-[11px] font-medium tracking-wide transition-colors cursor-pointer ${
                    active
                      ? 'bg-black text-white'
                      : 'bg-white text-neutral-600 hover:text-black'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Mobile Chapter Selector */}
        <div className="border-t border-neutral-200 bg-neutral-50/60">
          <button
            type="button"
            onClick={() => setMobileTocOpen((prev) => !prev)}
            aria-expanded={mobileTocOpen}
            className="w-full min-h-[44px] px-4 flex items-center justify-between gap-3 text-left text-xs font-medium text-black cursor-pointer"
          >
            <span>{doc.mobileTocToggleLabel}</span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${
                mobileTocOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {mobileTocOpen && (
            <nav
              aria-label={doc.tocHeading}
              className="max-h-[55dvh] overflow-y-auto border-t border-neutral-200 bg-white px-4 py-2 divide-y divide-neutral-100"
            >
              {doc.sections.map((section) => {
                const isActive = activeSectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full min-h-[44px] py-2.5 flex items-baseline gap-3 text-left text-[13px] transition-colors cursor-pointer ${
                      isActive ? 'font-semibold text-black' : 'text-neutral-600'
                    }`}
                  >
                    <span className="font-mono text-[11px] tabular-nums text-neutral-400 shrink-0">
                      {section.number}
                    </span>
                    <span className="leading-snug">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* ============================================================
          MAIN CONTENT: TWO-COLUMN ON DESKTOP, SINGLE-COLUMN ON MOBILE
         ============================================================ */}
      <main className="max-w-[1140px] mx-auto px-5 pt-7 pb-16 lg:px-10 lg:pt-12 lg:pb-24">
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14 items-start">
          {/* Desktop Sticky Left Index Rail */}
          <aside className="hidden lg:block sticky top-24 self-start border-r border-neutral-200 pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              {doc.tocHeading}
            </p>

            <nav aria-label={doc.tocHeading} className="mt-4">
              <ul className="space-y-1">
                {doc.sections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          scrollToSection(section.id);
                        }}
                        className={`group flex items-baseline gap-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                          isActive
                            ? 'font-semibold text-black'
                            : 'text-neutral-500 hover:text-black'
                        }`}
                      >
                        <span
                          className={`font-mono text-[11px] tabular-nums shrink-0 ${
                            isActive
                              ? 'text-black'
                              : 'text-neutral-400 group-hover:text-neutral-700'
                          }`}
                        >
                          {section.number}
                        </span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <dl className="mt-8 pt-6 border-t border-neutral-200 space-y-3 text-xs">
              <div>
                <dt className="text-neutral-400">{doc.effectiveLabel}</dt>
                <dd className="font-medium text-black mt-0.5 tabular-nums">
                  {doc.effectiveDate}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">{doc.versionLabel}</dt>
                <dd className="font-medium text-black mt-0.5 tabular-nums">
                  {doc.version}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">{doc.appliesToLabel}</dt>
                <dd className="font-medium text-neutral-800 mt-0.5 leading-relaxed">
                  {doc.appliesTo}
                </dd>
              </div>
            </dl>
          </aside>

          {/* Editorial Legal Document Body */}
          <article className="min-w-0 max-w-[72ch]">
            {/* Title Block — Strictly Crisp Black Typography on Pure White */}
            <header className="pb-7 border-b border-neutral-200">
              <p className="text-xs font-medium tracking-wide text-neutral-500">
                {doc.documentCategory}
              </p>

              <h1 className="mt-3 text-[1.8rem] sm:text-[2.15rem] lg:text-[2.4rem] font-semibold tracking-[-0.025em] leading-[1.15] text-black">
                {doc.documentTitle}
              </h1>

              {/* Mobile Metadata Strip (hidden on desktop where left rail shows it) */}
              <dl className="mt-5 py-3.5 border-y border-neutral-200 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs lg:hidden">
                <div>
                  <dt className="text-neutral-400">{doc.effectiveLabel}</dt>
                  <dd className="font-medium text-black mt-0.5 tabular-nums">
                    {doc.effectiveDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-400">{doc.versionLabel}</dt>
                  <dd className="font-medium text-black mt-0.5 tabular-nums">
                    {doc.version}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-neutral-400">{doc.appliesToLabel}</dt>
                  <dd className="font-medium text-neutral-800 mt-0.5">
                    {doc.appliesTo}
                  </dd>
                </div>
              </dl>

              <p className="mt-6 text-[15.5px] lg:text-[16.5px] leading-[1.7] text-neutral-800">
                {doc.leadSummary}
              </p>
            </header>

            {/* Numbered Sections — Every Subtitle in Solid Black */}
            <div className="divide-y divide-neutral-200">
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="py-8 lg:py-9 scroll-mt-24"
                >
                  <h2 className="text-lg lg:text-[1.25rem] font-semibold tracking-[-0.015em] leading-snug text-black flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold tabular-nums text-black shrink-0">
                      {section.number}.
                    </span>
                    <span className="text-black">{section.title}</span>
                  </h2>

                  <div className="mt-4 space-y-4 text-[15px] lg:text-[15.5px] leading-[1.72] text-neutral-700">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
                      {section.bullets.map((bullet, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-[14.5px] lg:text-[15px] leading-[1.68] text-neutral-700"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.62em] w-1.5 h-1.5 bg-black shrink-0"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.table && (
                    <div className="mt-6">
                      {/* Desktop structured hairline table */}
                      <div className="hidden lg:block border border-neutral-200">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/70">
                              {section.table.headers.map((header, idx) => (
                                <th
                                  key={idx}
                                  scope="col"
                                  className="px-4 py-3 text-xs font-semibold text-black align-top"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 text-[13.5px] leading-relaxed">
                            {section.table.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="bg-white">
                                <td className="px-4 py-3 font-medium text-black align-top">
                                  {row.category}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top">
                                  {row.collectedData}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top">
                                  {row.processor}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top tabular-nums">
                                  {row.retention}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile stacked hairline cards (prevents cramped horizontal scrolling) */}
                      <div className="lg:hidden border border-neutral-200 divide-y divide-neutral-200">
                        {section.table.rows.map((row, rIdx) => (
                          <div key={rIdx} className="p-4 bg-white space-y-2 text-[13.5px]">
                            <p className="font-semibold text-black">{row.category}</p>
                            <dl className="space-y-1.5 text-neutral-700">
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[1]}
                                </dt>
                                <dd className="leading-snug">{row.collectedData}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[2]}
                                </dt>
                                <dd className="leading-snug">{row.processor}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[3]}
                                </dt>
                                <dd className="leading-snug tabular-nums">
                                  {row.retention}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            <footer className="mt-4 pt-7 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs leading-relaxed text-neutral-500 max-w-[54ch]">
                {doc.footerNote}
              </p>
              <button
                type="button"
                onClick={onBack}
                className="self-start sm:self-auto inline-flex items-center gap-2 border border-neutral-300 bg-white hover:bg-neutral-50 hover:border-black px-4 py-2 text-xs font-medium text-black transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{doc.backLabel}</span>
              </button>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
