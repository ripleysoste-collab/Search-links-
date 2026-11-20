import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Calendar, Check, Loader2, Mail, User as UserIcon, X } from 'lucide-react';
import type {
  OrganizationProfile,
  OrganizationServiceItem,
} from './DesktopOrganizationView';
import { MobileOrganizationView } from './MobileOrganizationView';
import { MobileStoreView } from './MobileStoreView';
import {
  formatCreationDate,
  LANGUAGE_OPTIONS,
  useI18n,
  type SupportedLocale,
} from '../lib/i18n';

interface MobileAccountMenuProps {
  menuOpen: boolean;
  accountModalOpen: boolean;
  languageModalOpen: boolean;
  panelOpen: boolean;
  user: User;
  orgProfile: OrganizationProfile;
  services: OrganizationServiceItem[];
  onSaveOrgProfile: (next: OrganizationProfile) => void;
  onRenameService: (serviceId: string, nextName: string) => void;
  onNewProduct: () => void;
  onViewServiceHistory: (service: OrganizationServiceItem) => void;
  onOpenServiceChat?: (service: OrganizationServiceItem) => void;
  onRotateServiceKey?: (serviceId: string) => Promise<string | null>;
  onToggleServiceActive?: (serviceId: string, nextActive: boolean) => Promise<void>;
  onCloseMenu: () => void;
  onOpenAccountModal: () => void;
  onCloseAccountModal: () => void;
  onOpenLanguageModal: () => void;
  onCloseLanguageModal: () => void;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  onSignOut: () => Promise<void>;
}

function getUserDisplayInfo(
  user: User,
  userFallback: string,
  locale: SupportedLocale,
  dateUnavailable: string,
) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    user.email?.split('@')[0] ||
    userFallback;
  const photoUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    null;

  return {
    fullName,
    email: user.email || '',
    photoUrl,
    createdAtFormatted: formatCreationDate(user.created_at, locale, dateUnavailable),
    initialLetter: fullName.trim().charAt(0).toUpperCase() || 'U',
  };
}

export function MobileAccountMenu({
  menuOpen,
  accountModalOpen,
  languageModalOpen,
  panelOpen,
  user,
  orgProfile,
  services,
  onSaveOrgProfile,
  onRenameService,
  onNewProduct,
  onViewServiceHistory,
  onOpenServiceChat,
  onRotateServiceKey,
  onToggleServiceActive,
  onCloseMenu,
  onOpenAccountModal,
  onCloseAccountModal,
  onOpenLanguageModal,
  onCloseLanguageModal,
  onOpenPanel,
  onClosePanel,
  onSignOut,
}: MobileAccountMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const { locale, source, countryCode, setManualLocale, t } = useI18n();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [panelSubView, setPanelSubView] = useState<'organization' | 'store'>(
    'organization',
  );
  const [selectedStoreServiceId, setSelectedStoreServiceId] = useState<string | null>(
    null,
  );

  const info = getUserDisplayInfo(
    user,
    t.common.userFallback,
    locale,
    t.menu.dateUnavailable,
  );

  const selectedStoreService =
    services.find((srv) => srv.id === selectedStoreServiceId) ?? services[0] ?? null;

  useEffect(() => {
    setImgFailed(false);
  }, [info.photoUrl]);

  useEffect(() => {
    if (!panelOpen) {
      setPanelSubView('organization');
      setSelectedStoreServiceId(null);
    }
  }, [panelOpen]);

  useEffect(() => {
    if (!accountModalOpen) {
      setConfirmSignOut(false);
      setSigningOut(false);
      setSignOutError(null);
    }
  }, [accountModalOpen]);

  const handleConfirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await onSignOut();
    } catch {
      setSignOutError(t.menu.signOutError);
      setSigningOut(false);
    }
  };

  return (
    <>
      {/* 1. Mobile right slide-in slim menu with dimmed backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Dimmed backdrop — tap outside to close */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
              onClick={onCloseMenu}
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            />

            {/* Slim comfortable right drawer */}
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.accountMenuAria}
              initial={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
              }
              className="absolute top-0 right-0 bottom-0 w-[62%] max-w-[248px] min-w-[208px] bg-white/96 backdrop-blur-xl border-l border-slate-200/85 shadow-[-14px_0_38px_-14px_rgba(15,23,42,0.28)] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3.5 border-b border-slate-200/75 shrink-0">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.account}
                </span>
                <button
                  type="button"
                  onClick={onCloseMenu}
                  aria-label={t.menu.closeMenuAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <nav aria-label={t.menu.accountOptionsAria} className="flex-1 overflow-y-auto px-4 py-3">
                <ul className="divide-y divide-slate-200/75">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenAccountModal();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.googleAccount}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenPanel();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.organization}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onCloseMenu();
                        onOpenLanguageModal();
                      }}
                      className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {t.menu.language}
                    </button>
                  </li>
                </ul>
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Mobile centered compact Google Account modal */}
      <AnimatePresence>
        {accountModalOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-center justify-center p-5">
            {/* Dimmed backdrop */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              onClick={() => {
                if (!signingOut) onCloseAccountModal();
              }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />

            {/* Centered compact card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.googleAccountDetailsAria}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
              }
              className="relative w-full max-w-[336px] rounded-3xl bg-white/96 backdrop-blur-xl border border-slate-200/90 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.3)] overflow-visible"
            >
              {/* Modal top bar */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-200/75">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.googleAccount}
                </span>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={onCloseAccountModal}
                  aria-label={t.menu.closeAccountModalAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Account summary + details */}
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {info.photoUrl && !imgFailed ? (
                      <img
                        src={info.photoUrl}
                        alt={info.fullName}
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-semibold text-slate-800">
                        {info.initialLetter}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-950 truncate">
                      {info.fullName}
                    </p>
                    {info.email && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {info.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 divide-y divide-slate-200/70">
                  <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                    <UserIcon
                      className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400">
                        {t.menu.usernameLabel}
                      </p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5 break-words">
                        {info.fullName}
                      </p>
                    </div>
                  </div>

                  {info.email && (
                    <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                      <Mail
                        className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-slate-400">
                          {t.menu.googleAccountLabel}
                        </p>
                        <p className="text-xs font-medium text-slate-900 mt-0.5 break-all">
                          {info.email}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                    <Calendar
                      className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400">
                        {t.menu.createdAtLabel}
                      </p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5">
                        {t.menu.accountCreatedOn(info.createdAtFormatted)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Sign Out + small confirmation dialog right above */}
              <div className="px-5 pt-3 pb-4 border-t border-slate-200/75 relative">
                <AnimatePresence>
                  {confirmSignOut && (
                    <motion.div
                      role="alertdialog"
                      aria-label={t.menu.confirmSignOutAria}
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 8, scale: 0.96 }
                      }
                      animate={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, y: 0, scale: 1 }
                      }
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 6, scale: 0.96 }
                      }
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      className="mb-3 rounded-2xl border border-slate-200/95 bg-white p-3.5 shadow-[0_14px_32px_-10px_rgba(15,23,42,0.22)]"
                    >
                      <p className="text-xs font-medium text-slate-900">
                        {t.menu.confirmSignOutTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t.menu.confirmSignOutDescMobile}
                      </p>

                      {signOutError && (
                        <p className="text-[11px] text-rose-600 mt-1.5">{signOutError}</p>
                      )}

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={signingOut}
                          onClick={() => {
                            setConfirmSignOut(false);
                            setSignOutError(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={signingOut}
                          onClick={() => void handleConfirmSignOut()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {signingOut && (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          )}
                          {t.common.accept}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setSignOutError(null);
                    setConfirmSignOut((prev) => !prev);
                  }}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  {t.menu.signOut}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Mobile full-screen Organización & Mi tienda flow */}
      <AnimatePresence>
        {panelOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={
              panelSubView === 'store' ? t.menu.myStore : t.menu.organization
            }
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 lg:hidden bg-white flex flex-col"
          >
            <header className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-2 min-w-0">
                {panelSubView === 'store' && (
                  <button
                    type="button"
                    onClick={() => setPanelSubView('organization')}
                    aria-label={t.menu.backToOrgAria}
                    className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <span className="text-[15px] font-semibold tracking-tight text-slate-950 truncate">
                  {panelSubView === 'store' ? t.menu.myStore : t.menu.organization}
                </span>
              </div>

              <button
                type="button"
                onClick={onClosePanel}
                aria-label={
                  panelSubView === 'store'
                    ? t.menu.closeStoreAria
                    : t.menu.closeOrgAria
                }
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </header>

            {panelSubView === 'store' && selectedStoreService ? (
              <MobileStoreView
                service={selectedStoreService}
                organizationName={orgProfile.name}
                organizationLogoUrl={orgProfile.logoUrl || info.photoUrl}
              />
            ) : (
              <MobileOrganizationView
                orgProfile={orgProfile}
                googlePhotoUrl={info.photoUrl}
                googleInitialLetter={info.initialLetter}
                services={services}
                onSaveOrgProfile={onSaveOrgProfile}
                onRenameService={onRenameService}
                onNewProduct={onNewProduct}
                onOpenStore={(service) => {
                  setSelectedStoreServiceId(service.id);
                  setPanelSubView('store');
                }}
                onViewServiceHistory={onViewServiceHistory}
                onOpenServiceChat={onOpenServiceChat}
                onRotateServiceKey={onRotateServiceKey}
                onToggleServiceActive={onToggleServiceActive}
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* 4. Mobile centered floating Idioma modal (exact same frame as Google Account modal) */}
      <AnimatePresence>
        {languageModalOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-center justify-center p-5">
            {/* Dimmed backdrop */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              onClick={onCloseLanguageModal}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />

            {/* Centered compact card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t.menu.languagesTitle}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
              }
              className="relative w-full max-w-[336px] rounded-3xl bg-white/96 backdrop-blur-xl border border-slate-200/90 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.3)] overflow-visible"
            >
              {/* Modal top bar */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-slate-200/75">
                <span className="text-sm font-semibold tracking-tight text-slate-950">
                  {t.menu.language}
                </span>
                <button
                  type="button"
                  onClick={onCloseLanguageModal}
                  aria-label={t.menu.closeMenuAria}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Languages list */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500">
                  {t.menu.languagesTitle}
                </p>

                <div
                  role="radiogroup"
                  aria-label={t.menu.languageOptionsAria}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/75 divide-y divide-slate-200/70 overflow-hidden"
                >
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isSelected = locale === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setManualLocale(option.code)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white text-slate-950'
                            : 'text-slate-700 hover:bg-white/75 hover:text-slate-950'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-950 truncate">
                            {option.nativeLabel}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {option.regionLabel}
                          </p>
                        </div>
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5 text-slate-950 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom auto/manual hint */}
              <div className="px-5 pt-3 pb-4 border-t border-slate-200/75">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {source === 'manual'
                    ? t.menu.languageManualSavedNote
                    : t.menu.languageAutoDetectedNote(countryCode)}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
