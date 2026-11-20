import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Calendar, Check, Loader2, Mail, User as UserIcon, X } from 'lucide-react';

import {
  DesktopOrganizationView,
  type OrganizationProfile,
  type OrganizationServiceItem,
} from './DesktopOrganizationView';
import { DesktopStoreView } from './DesktopStoreView';
import {
  formatCreationDate,
  LANGUAGE_OPTIONS,
  useI18n,
  type SupportedLocale,
} from '../lib/i18n';

interface DesktopAccountMenuProps {
  open: boolean;
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
  onClose: () => void;
  onSignOut: () => Promise<void>;
}

type DesktopMenuView =
  | 'menu'
  | 'google-account'
  | 'organization'
  | 'store'
  | 'language';

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

export function DesktopAccountMenu({
  open,
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
  onClose,
  onSignOut,
}: DesktopAccountMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const { locale, source, countryCode, setManualLocale, t } = useI18n();
  const [view, setView] = useState<DesktopMenuView>('menu');
  const [selectedStoreServiceId, setSelectedStoreServiceId] = useState<string | null>(
    null,
  );
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const info = getUserDisplayInfo(
    user,
    t.common.userFallback,
    locale,
    t.menu.dateUnavailable,
  );

  useEffect(() => {
    setImgFailed(false);
  }, [info.photoUrl]);

  useEffect(() => {
    if (!open) {
      setView('menu');
      setSelectedStoreServiceId(null);
      setConfirmSignOut(false);
      setSigningOut(false);
      setSignOutError(null);
    }
  }, [open]);

  const selectedStoreService =
    services.find((srv) => srv.id === selectedStoreServiceId) ?? services[0] ?? null;

  const isExpandedPanelView =
    view === 'google-account' ||
    view === 'organization' ||
    view === 'store' ||
    view === 'language';
  const topTitle =
    view === 'google-account'
      ? t.menu.googleAccount
      : view === 'organization'
        ? t.menu.organization
        : view === 'store'
          ? t.menu.myStore
          : view === 'language'
            ? t.menu.language
            : t.menu.account;

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
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          aria-label={
            view === 'google-account'
              ? t.menu.googleAccountDetailsAria
              : view === 'organization'
                ? t.menu.organization
                : view === 'store'
                  ? t.menu.myStore
                  : view === 'language'
                    ? t.menu.languagesTitle
                    : t.menu.accountMenuAria
          }
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  width: isExpandedPanelView ? '50%' : '25%',
                  opacity: 1,
                  borderTopLeftRadius: isExpandedPanelView ? 28 : 0,
                  borderBottomLeftRadius: isExpandedPanelView ? 28 : 0,
                }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  width: 0,
                  opacity: 0.9,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
          }
          className="hidden lg:flex shrink-0 h-dvh sticky top-0 overflow-hidden z-20 bg-white/95 backdrop-blur-xl border-l border-slate-200/85 shadow-[-18px_0_48px_-18px_rgba(15,23,42,0.24)] flex-col"
        >
          <div className="w-full min-w-[270px] h-full flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200/75 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {isExpandedPanelView && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmSignOut(false);
                      setSignOutError(null);
                      setView(view === 'store' ? 'organization' : 'menu');
                    }}
                    aria-label={
                      view === 'store'
                        ? t.menu.backToOrgAria
                        : t.menu.backToMenuAria
                    }
                    className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <span className="text-sm font-semibold tracking-tight text-slate-950 truncate">
                  {topTitle}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.menu.closeMenuAria}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {view === 'menu' ? (
                <motion.nav
                  key="desktop-menu-list"
                  aria-label={t.menu.accountOptionsAria}
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex-1 overflow-y-auto px-6 py-4"
                >
                  <ul className="divide-y divide-slate-200/75">
                    <li>
                      <button
                        type="button"
                        onClick={() => setView('google-account')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.googleAccount}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setView('organization')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.organization}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setView('language')}
                        className="w-full py-3 text-left text-[14px] font-medium text-slate-800 hover:text-slate-950 transition-colors duration-150 focus-visible:outline-none focus-visible:text-slate-950 cursor-pointer"
                      >
                        {t.menu.language}
                      </button>
                    </li>
                  </ul>
                </motion.nav>
              ) : view === 'organization' ? (
                <motion.div
                  key="desktop-organization-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <DesktopOrganizationView
                    orgProfile={orgProfile}
                    googlePhotoUrl={info.photoUrl}
                    googleInitialLetter={info.initialLetter}
                    services={services}
                    onSaveOrgProfile={onSaveOrgProfile}
                    onRenameService={onRenameService}
                    onNewProduct={onNewProduct}
                    onOpenStore={(service) => {
                      setSelectedStoreServiceId(service.id);
                      setView('store');
                    }}
                    onViewServiceHistory={onViewServiceHistory}
                    onOpenServiceChat={onOpenServiceChat}
                    onRotateServiceKey={onRotateServiceKey}
                    onToggleServiceActive={onToggleServiceActive}
                  />
                </motion.div>
              ) : view === 'store' && selectedStoreService ? (
                <motion.div
                  key="desktop-store-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <DesktopStoreView
                    service={selectedStoreService}
                    organizationName={orgProfile.name}
                    organizationLogoUrl={orgProfile.logoUrl || info.photoUrl}
                  />
                </motion.div>
              ) : view === 'language' ? (
                <motion.div
                  key="desktop-language-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 overflow-y-auto px-8 py-7 flex flex-col justify-between"
                >
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                        {t.menu.languagesTitle}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {t.menu.languageSectionPrompt}
                      </p>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label={t.menu.languageOptionsAria}
                      className="rounded-2xl border border-slate-200/85 bg-slate-50/70 divide-y divide-slate-200/75 overflow-hidden"
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
                            className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-white text-slate-950'
                                : 'text-slate-700 hover:bg-white/75 hover:text-slate-950'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950 truncate">
                                {option.nativeLabel}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {option.regionLabel}
                              </p>
                            </div>

                            {isSelected && (
                              <Check
                                className="w-4 h-4 text-slate-950 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 mt-8 border-t border-slate-200/75 space-y-1">
                    <p className="text-xs font-medium text-slate-700">
                      {source === 'manual'
                        ? t.menu.languageManualSavedNote
                        : t.menu.languageAutoDetectedNote(countryCode)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.menu.languageLocalStorageHint}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="desktop-google-account-view"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 overflow-y-auto px-8 py-7 flex flex-col justify-between"
                >
                  <div className="space-y-6">
                    {/* Profile header */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full border border-slate-200/90 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                        {info.photoUrl && !imgFailed ? (
                          <img
                            src={info.photoUrl}
                            alt={info.fullName}
                            referrerPolicy="no-referrer"
                            onError={() => setImgFailed(true)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-semibold text-slate-800">
                            {info.initialLetter}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight text-slate-950 truncate">
                          {info.fullName}
                        </h2>
                        {info.email && (
                          <p className="text-sm text-slate-500 truncate mt-0.5">
                            {info.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Account details */}
                    <div className="rounded-2xl border border-slate-200/85 bg-slate-50/70 divide-y divide-slate-200/75">
                      <div className="px-4 py-3.5 flex items-start gap-3">
                        <UserIcon
                          className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">
                            {t.menu.usernameLabel}
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5 break-words">
                            {info.fullName}
                          </p>
                        </div>
                      </div>

                      {info.email && (
                        <div className="px-4 py-3.5 flex items-start gap-3">
                          <Mail
                            className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-slate-400">
                              {t.menu.googleAccountLabel}
                            </p>
                            <p className="text-sm font-medium text-slate-900 mt-0.5 break-all">
                              {info.email}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="px-4 py-3.5 flex items-start gap-3">
                        <Calendar
                          className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">
                            {t.menu.createdAtLabel}
                          </p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">
                            {t.menu.accountCreatedOn(info.createdAtFormatted)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Sign-out text action + small confirmation box directly above */}
                  <div className="relative pt-6 mt-8 border-t border-slate-200/75">
                    <AnimatePresence>
                      {confirmSignOut && (
                        <motion.div
                          role="alertdialog"
                          aria-label={t.menu.confirmSignOutAria}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 8, scale: 0.97 }
                          }
                          animate={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 1, y: 0, scale: 1 }
                          }
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 6, scale: 0.97 }
                          }
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          className="mb-3 rounded-2xl border border-slate-200/95 bg-white p-4 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.18)]"
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {t.menu.confirmSignOutTitle}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t.menu.confirmSignOutDescDesktop}
                          </p>

                          {signOutError && (
                            <p className="text-xs text-rose-600 mt-2">{signOutError}</p>
                          )}

                          <div className="mt-3.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={signingOut}
                              onClick={() => {
                                setConfirmSignOut(false);
                                setSignOutError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {t.common.cancel}
                            </button>
                            <button
                              type="button"
                              disabled={signingOut}
                              onClick={() => void handleConfirmSignOut()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {signingOut && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
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
                      className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors duration-150 focus-visible:outline-none focus-visible:underline cursor-pointer"
                    >
                      {t.menu.signOut}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
