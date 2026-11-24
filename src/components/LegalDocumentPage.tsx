import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { AGENCY_GUIDE_DOC_CONTENT } from '../data/agencyGuideDocContent';
import { AGENCY_LIABILITY_DOC_CONTENT } from '../data/agencyLiabilityDocContent';
import { AGENCY_MODE_DOC_CONTENT } from '../data/agencyModeDocContent';
import { CONTENT_POLICY_CONTENT } from '../data/contentPolicyContent';
import { COOKIE_POLICY_CONTENT } from '../data/cookiePolicyContent';
import { INTELLECTUAL_PROPERTY_DOC_CONTENT } from '../data/intellectualPropertyDocContent';
import { PRIVACY_POLICY_CONTENT } from '../data/privacyPolicyContent';
import { TERMS_AND_CONDITIONS_CONTENT } from '../data/termsContent';
import { useI18n, type SupportedLocale } from '../lib/i18n';
import { SearchLinkLogo } from './SearchLinkLogo';

export type LegalDocId =
  | 'privacy'
  | 'terms'
  | 'content'
  | 'cookies'
  | 'agency'
  | 'agency-guide'
  | 'agency-liability'
  | 'liability';

interface LegalDocumentPageProps {
  docId: LegalDocId;
  onClose: () => void;
  onNavigateDoc: (docId: LegalDocId) => void;
}

const LOCALE_SHORT_LABELS: Array<{ code: SupportedLocale; label: string }> = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];

const DOC_LINK_PHRASES: Array<{ phrase: string; docId: LegalDocId }> = [
  { phrase: 'Cosas a tener en cuenta en Modo Agencia', docId: 'agency-guide' },
  { phrase: 'Things to Keep in Mind in Agency Mode', docId: 'agency-guide' },
  { phrase: 'O que considerar no Modo Agência', docId: 'agency-guide' },
  { phrase: 'Responsabilidad y propiedad en Modo Agencia', docId: 'agency-liability' },
  { phrase: 'Agency Mode Liability and Intellectual Property', docId: 'agency-liability' },
  { phrase: 'Responsabilidade e propriedade no Modo Agência', docId: 'agency-liability' },
  { phrase: 'Propiedad intelectual, límites y responsabilidad', docId: 'liability' },
  { phrase: 'Propiedad intelectual y responsabilidad', docId: 'liability' },
  { phrase: 'Intellectual Property, Limits, and Liability', docId: 'liability' },
  { phrase: 'Intellectual Property and Liability', docId: 'liability' },
  { phrase: 'Propriedade intelectual, limites e responsabilidade', docId: 'liability' },
  { phrase: 'Propriedade intelectual e responsabilidade', docId: 'liability' },
  { phrase: 'Políticas de privacidad y uso', docId: 'privacy' },
  { phrase: 'Política de privacidad', docId: 'privacy' },
  { phrase: 'Privacy and Usage Policies', docId: 'privacy' },
  { phrase: 'Privacy Policy', docId: 'privacy' },
  { phrase: 'Políticas de privacidade e uso', docId: 'privacy' },
  { phrase: 'Política de privacidade', docId: 'privacy' },
  { phrase: 'Términos y condiciones', docId: 'terms' },
  { phrase: 'Terms and Conditions', docId: 'terms' },
  { phrase: 'Termos e condições', docId: 'terms' },
  { phrase: 'Políticas de contenido', docId: 'content' },
  { phrase: 'Política de contenido', docId: 'content' },
  { phrase: 'Content Policies', docId: 'content' },
  { phrase: 'Content Policy', docId: 'content' },
  { phrase: 'Políticas de conteúdo', docId: 'content' },
  { phrase: 'Política de conteúdo', docId: 'content' },
  { phrase: 'Políticas de cookies', docId: 'cookies' },
  { phrase: 'Política de cookies', docId: 'cookies' },
  { phrase: 'Cookie Policies', docId: 'cookies' },
  { phrase: 'Cookie Policy', docId: 'cookies' },
  { phrase: 'Modo Agencia', docId: 'agency' },
  { phrase: 'Agency Mode', docId: 'agency' },
  { phrase: 'Modo Agência', docId: 'agency' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FOOTER_TEXT_BY_LOCALE: Record<
  SupportedLocale,
  {
    allDocsHeading: string;
    creditsLine: string;
  }
> = {
  es: {
    allDocsHeading: 'Todas las documentaciones de Search Link',
    creditsLine:
      '© 2026 Search Link · Todos los derechos reservados. Plataforma de catalogación inteligente, Search Link Core API y Modo Agencia.',
  },
  en: {
    allDocsHeading: 'All Search Link Documentation',
    creditsLine:
      '© 2026 Search Link · All rights reserved. Intelligent catalog infrastructure, Search Link Core API, and Agency Mode.',
  },
  pt: {
    allDocsHeading: 'Toda a documentação do Search Link',
    creditsLine:
      '© 2026 Search Link · Todos os direitos reservados. Infraestrutura de catalogação inteligente, Search Link Core API e Modo Agência.',
  },
};

export function LegalDocumentPage({
  docId,
  onClose,
  onNavigateDoc,
}: LegalDocumentPageProps) {
  const { locale, setManualLocale, t } = useI18n();
  const doc =
    docId === 'terms'
      ? TERMS_AND_CONDITIONS_CONTENT[locale]
      : docId === 'content'
        ? CONTENT_POLICY_CONTENT[locale]
        : docId === 'cookies'
          ? COOKIE_POLICY_CONTENT[locale]
          : docId === 'agency'
            ? AGENCY_MODE_DOC_CONTENT[locale]
            : docId === 'agency-guide'
              ? AGENCY_GUIDE_DOC_CONTENT[locale]
              : docId === 'agency-liability'
                ? AGENCY_LIABILITY_DOC_CONTENT[locale]
                : docId === 'liability'
                  ? INTELLECTUAL_PROPERTY_DOC_CONTENT[locale]
                  : PRIVACY_POLICY_CONTENT[locale];

  const [activeSectionId, setActiveSectionId] = useState<string>(
    doc.sections[0]?.id ?? '',
  );
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const linkMatcher = useMemo(() => {
    const pattern = DOC_LINK_PHRASES.map((item) => escapeRegExp(item.phrase)).join('|');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu');
    const lookup = new Map<string, LegalDocId>();
    for (const entry of DOC_LINK_PHRASES) {
      lookup.set(entry.phrase.toLowerCase(), entry.docId);
    }
    return { regex, lookup };
  }, []);

  const renderLinkedText = (text: string): ReactNode => {
    if (!text) return text;
    const { regex, lookup } = linkMatcher;
    regex.lastIndex = 0;

    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchedPhrase = match[0];
      const matchStart = match.index;
      const targetDocId = lookup.get(matchedPhrase.toLowerCase());
      if (!targetDocId || targetDocId === docId) continue;

      if (matchStart > lastIndex) {
        nodes.push(
          <Fragment key={`txt-${keyCounter++}`}>
            {text.slice(lastIndex, matchStart)}
          </Fragment>,
        );
      }

      nodes.push(
        <button
          key={`lnk-${keyCounter++}`}
          type="button"
          onClick={() => onNavigateDoc(targetDocId)}
          className="inline font-medium text-blue-600 hover:text-blue-700 underline decoration-blue-600/35 hover:decoration-blue-700 underline-offset-2 cursor-pointer transition-colors text-left"
        >
          {matchedPhrase}
        </button>,
      );

      lastIndex = matchStart + matchedPhrase.length;
    }

    if (nodes.length === 0) return text;
    if (lastIndex < text.length) {
      nodes.push(
        <Fragment key={`txt-${keyCounter++}`}>{text.slice(lastIndex)}</Fragment>,
      );
    }
    return nodes;
  };

  const allDocuments: Array<{ id: LegalDocId; label: string }> = [
    { id: 'privacy', label: t.menu.privacyAndUse },
    { id: 'terms', label: t.menu.termsAndConditions },
    { id: 'content', label: t.menu.contentPolicies },
    { id: 'cookies', label: t.menu.cookiePolicies },
    { id: 'agency', label: t.menu.agencyMode },
    { id: 'agency-guide', label: t.menu.agencyModeGuide },
    { id: 'agency-liability', label: t.menu.agencyModeLiability },
    { id: 'liability', label: t.menu.intellectualPropertyAndLiability },
  ];

  const footerTexts = FOOTER_TEXT_BY_LOCALE[locale];

  useEffect(() => {
    setActiveSectionId(doc.sections[0]?.id ?? '');
    setMobileTocOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [docId, locale, doc.sections]);

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
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
          DESKTOP TOP HEADER: CLEAN LOGO LEFT, LANGUAGE + X RIGHT (lg+)
         ============================================================ */}
      <header className="hidden lg:block sticky top-0 z-30 bg-white/96 backdrop-blur-sm">
        <div className="max-w-[1140px] mx-auto px-10 h-16 flex items-center justify-between gap-6">
          <SearchLinkLogo size="sm" />

          <div className="flex items-center gap-5 shrink-0">
            <div role="group" aria-label="Language" className="flex items-center gap-1">
              {LOCALE_SHORT_LABELS.map((item) => {
                const active = locale === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setManualLocale(item.code)}
                    aria-pressed={active}
                    className={`px-2 py-1 text-xs tracking-wide transition-colors cursor-pointer ${
                      active
                        ? 'font-semibold text-black underline underline-offset-4'
                        : 'font-medium text-neutral-400 hover:text-black'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={doc.backLabel}
              className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          MOBILE TOP HEADER: CLEAN LOGO LEFT, LANGUAGE + X RIGHT (< lg)
         ============================================================ */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/96 backdrop-blur-sm">
        <div className="px-5 h-14 flex items-center justify-between gap-3">
          <SearchLinkLogo size="sm" />

          <div className="flex items-center gap-2 shrink-0">
            <div role="group" aria-label="Language" className="flex items-center gap-0.5">
              {LOCALE_SHORT_LABELS.map((item) => {
                const active = locale === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setManualLocale(item.code)}
                    aria-pressed={active}
                    className={`min-w-[30px] min-h-[32px] px-1.5 text-[11px] tracking-wide transition-colors cursor-pointer ${
                      active
                        ? 'font-semibold text-black underline underline-offset-4'
                        : 'font-medium text-neutral-400 hover:text-black'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={doc.backLabel}
              className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-black hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Section Index */}
        <div className="px-5 pb-2">
          <button
            type="button"
            onClick={() => setMobileTocOpen((prev) => !prev)}
            aria-expanded={mobileTocOpen}
            className="w-full min-h-[40px] flex items-center justify-between gap-3 text-left text-xs font-medium text-neutral-600 hover:text-black cursor-pointer"
          >
            <span>{doc.mobileTocToggleLabel}</span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${
                mobileTocOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {mobileTocOpen && (
            <nav
              aria-label={doc.tocHeading}
              className="max-h-[55dvh] overflow-y-auto bg-neutral-50/85 rounded-xl px-3.5 py-2 mb-2 space-y-0.5"
            >
              {doc.sections.map((section) => {
                const isActive = activeSectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full min-h-[42px] py-2 flex items-baseline gap-3 text-left text-[13px] transition-colors cursor-pointer ${
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
      <main className="max-w-[1140px] mx-auto px-5 pt-6 pb-16 lg:px-10 lg:pt-10 lg:pb-24">
        <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14 items-start">
          {/* Desktop Sticky Left Index Rail (clean, no divider lines) */}
          <aside className="hidden lg:block sticky top-24 self-start pr-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              {doc.tocHeading}
            </p>

            <nav aria-label={doc.tocHeading} className="mt-4">
              <ul className="space-y-1.5">
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
                        className={`group flex items-baseline gap-2.5 py-1 text-[13px] leading-snug transition-colors ${
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
          </aside>

          {/* Editorial Legal Document Body */}
          <article className="min-w-0 max-w-[70ch]">
            {/* Clean Black Title + Lead Summary (no top metadata clutter) */}
            <header className="pb-6 lg:pb-8">
              <h1 className="text-[1.8rem] sm:text-[2.15rem] lg:text-[2.45rem] font-semibold tracking-[-0.025em] leading-[1.15] text-black">
                {doc.documentTitle}
              </h1>

              <p className="mt-5 text-[15.5px] lg:text-[16.5px] leading-[1.72] text-neutral-800">
                {renderLinkedText(doc.leadSummary)}
              </p>
            </header>

            {/* Sections Separated Naturally by Generous Whitespace — Zero Lines Between Subtitles */}
            <div className="mt-4 space-y-10 lg:space-y-12">
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <h2 className="text-lg lg:text-[1.25rem] font-semibold tracking-[-0.015em] leading-snug text-black flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold tabular-nums text-black shrink-0">
                      {section.number}.
                    </span>
                    <span className="text-black">{section.title}</span>
                  </h2>

                  <div className="mt-4 space-y-4 text-[15px] lg:text-[15.5px] leading-[1.72] text-neutral-700">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index}>{renderLinkedText(paragraph)}</p>
                    ))}
                  </div>

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-5 space-y-3">
                      {section.bullets.map((bullet, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-[14.5px] lg:text-[15px] leading-[1.68] text-neutral-700"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.62em] w-1.5 h-1.5 bg-black shrink-0"
                          />
                          <span>{renderLinkedText(bullet)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.table && (
                    <div className="mt-6">
                      {/* Desktop structured table */}
                      <div className="hidden lg:block border border-neutral-200 rounded-lg overflow-hidden">
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
                                  {renderLinkedText(row.category)}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top">
                                  {renderLinkedText(row.collectedData)}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top">
                                  {renderLinkedText(row.processor)}
                                </td>
                                <td className="px-4 py-3 text-neutral-700 align-top tabular-nums">
                                  {renderLinkedText(row.retention)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile stacked cards */}
                      <div className="lg:hidden space-y-3">
                        {section.table.rows.map((row, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-4 bg-neutral-50/70 rounded-xl space-y-2 text-[13.5px]"
                          >
                            <p className="font-semibold text-black">
                              {renderLinkedText(row.category)}
                            </p>
                            <dl className="space-y-1.5 text-neutral-700">
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[1]}
                                </dt>
                                <dd className="leading-snug">
                                  {renderLinkedText(row.collectedData)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[2]}
                                </dt>
                                <dd className="leading-snug">
                                  {renderLinkedText(row.processor)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-medium text-neutral-400">
                                  {section.table!.headers[3]}
                                </dt>
                                <dd className="leading-snug tabular-nums">
                                  {renderLinkedText(row.retention)}
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

            {/* Bottom Metadata, Full Interlinked Documentation Directory & Platform Credits */}
            <footer className="mt-14 pt-8 border-t border-neutral-200 space-y-7">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
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
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-neutral-400">{doc.appliesToLabel}</dt>
                  <dd className="font-medium text-neutral-800 mt-0.5 leading-relaxed">
                    {doc.appliesTo}
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-neutral-500">
                {renderLinkedText(doc.footerNote)}
              </p>

              {/* Complete Directory of All Search Link Documentations */}
              <div className="pt-6 border-t border-neutral-200/80 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                  {footerTexts.allDocsHeading}
                </p>

                <nav aria-label={footerTexts.allDocsHeading}>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    {allDocuments.map((item) => {
                      const isCurrent = item.id === docId;
                      return (
                        <li key={item.id}>
                          {isCurrent ? (
                            <span
                              aria-current="page"
                              className="font-semibold text-black"
                            >
                              {item.label}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onNavigateDoc(item.id)}
                              className="font-medium text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 cursor-pointer transition-colors text-left"
                            >
                              {item.label}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <p className="pt-2 text-[11.5px] leading-relaxed text-neutral-500">
                  {footerTexts.creditsLine}
                </p>
              </div>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
