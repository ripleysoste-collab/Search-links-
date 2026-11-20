import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Database,
  KeyRound,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useI18n, type TranslationDictionary } from '../lib/i18n';
import { SearchLinkLogo } from './SearchLinkLogo';

interface AuthDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDrawer({ open, onClose }: AuthDrawerProps) {
  const { t } = useI18n();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsHighlight, setTermsHighlight] = useState(false);
  const [oauthFallbackUrl, setOauthFallbackUrl] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const applyOAuthPayload = async (hash: string, search: string) => {
      if (!supabase) return;
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(search.replace(/^\?/, ''));

      const oauthError =
        hashParams.get('error_description') ||
        queryParams.get('error_description') ||
        hashParams.get('error') ||
        queryParams.get('error');

      if (oauthError) {
        setGoogleLoading(false);
        setAuthError(translateSupabaseAuthError(oauthError, t));
        return;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const authCode = queryParams.get('code');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setAuthError(translateSupabaseAuthError(error.message, t));
          } else {
            setAuthSuccess(t.auth.googleSignedInSuccess);
            setOauthFallbackUrl(null);
          }
        } else if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) {
            setAuthError(translateSupabaseAuthError(error.message, t));
          } else {
            setAuthSuccess(t.auth.googleSignedInSuccess);
            setOauthFallbackUrl(null);
          }
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { type?: string; hash?: string; search?: string }
        | undefined;
      if (data?.type === 'SEARCHLINK_OAUTH_RESULT') {
        void applyOAuthPayload(data.hash || '', data.search || '');
      }
    };

    window.addEventListener('message', handleWindowMessage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('searchlink-oauth');
        channel.onmessage = (event: MessageEvent) => {
          const data = event.data as
            | { type?: string; hash?: string; search?: string }
            | undefined;
          if (data?.type === 'SEARCHLINK_OAUTH_RESULT') {
            void applyOAuthPayload(data.hash || '', data.search || '');
          }
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      channel?.close();
    };
  }, [t]);

  useEffect(() => {
    if (!open) {
      setAcceptedTerms(false);
      setTermsHighlight(false);
      setAuthError(null);
      setAuthSuccess(null);
      setGoogleLoading(false);
      setOauthFallbackUrl(null);
    }
  }, [open]);

  const handleGoogleSignIn = async () => {
    if (!acceptedTerms) {
      setTermsHighlight(true);
      setAuthError(t.auth.termsError);
      return;
    }

    if (!supabase) {
      setAuthError(t.auth.supabaseMissingError);
      return;
    }

    setAuthError(null);
    setAuthSuccess(null);
    setOauthFallbackUrl(null);
    setGoogleLoading(true);

    const isInsideIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    try {
      if (!isInsideIframe) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) {
          setGoogleLoading(false);
          setAuthError(translateSupabaseAuthError(error.message, t));
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        setGoogleLoading(false);
        setAuthError(
          error
            ? translateSupabaseAuthError(error.message, t)
            : t.auth.googleLinkError,
        );
        return;
      }

      const width = 520;
      const height = 650;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

      const popup = window.open(
        data.url,
        'searchlink_google_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no`,
      );

      if (!popup) {
        setGoogleLoading(false);
        setOauthFallbackUrl(data.url);
        setAuthError(t.auth.popupBlockedError);
        return;
      }

      const closeWatcher = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(closeWatcher);
          setGoogleLoading(false);
        }
      }, 500);
    } catch (err) {
      setGoogleLoading(false);
      setAuthError(
        err instanceof Error
          ? translateSupabaseAuthError(err.message, t)
          : t.auth.googleSignInError,
      );
    }
  };

  const panelInitial = shouldReduceMotion
    ? { opacity: 0 }
    : isDesktop
      ? { x: '100%' }
      : { opacity: 0, y: 18 };

  const panelAnimate = shouldReduceMotion
    ? { opacity: 1 }
    : isDesktop
      ? { x: 0 }
      : { opacity: 1, y: 0 };

  const panelExit = shouldReduceMotion
    ? { opacity: 0 }
    : isDesktop
      ? { x: '100%' }
      : { opacity: 0, y: 14 };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch lg:justify-end">
          {/* Desktop blurred backdrop covering left half; mobile uses full-screen /login */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
            onClick={onClose}
            className="hidden lg:block fixed inset-0 bg-slate-950/40 backdrop-blur-md"
          />

          {/* Full-screen /login on mobile (same luminous phone background), right half-screen drawer on desktop */}
          <motion.section
            key={isDesktop ? 'desktop-auth-panel' : 'mobile-login-route'}
            role="dialog"
            aria-modal="true"
            aria-label={t.auth.drawerAriaGuest}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: isDesktop ? 0.36 : 0.26, ease: [0.22, 1, 0.36, 1] }
            }
            className="relative z-10 w-full h-dvh lg:w-1/2 lg:h-full bg-[#f8fbff] lg:bg-white lg:shadow-[-24px_0_80px_-16px_rgba(15,23,42,0.35)] lg:border-l lg:border-slate-200/80 flex flex-col overflow-hidden"
          >
            {/* Mobile-only matching phone background */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 lg:hidden overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, #eef6ff 0%, #f8fbff 42%, #ffffff 70%, #f2fbf6 100%)',
              }}
            >
              <div
                className="absolute -top-24 -left-20 w-[92vw] h-[46vh] rounded-full blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(59, 130, 246, 0.24) 0%, rgba(96, 165, 250, 0.12) 55%, transparent 76%)',
                }}
              />
              <div
                className="absolute -bottom-24 -right-16 w-[96vw] h-[48vh] rounded-full blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(59, 130, 246, 0.12) 52%, transparent 76%)',
                }}
              />
            </div>

            {/* Desktop-only subtle architectural dot pattern */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 hidden lg:block"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(15, 23, 42, 0.11) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                maskImage:
                  'radial-gradient(ellipse 85% 80% at 50% 45%, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.25) 100%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 85% 80% at 50% 45%, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.25) 100%)',
              }}
            />

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between px-5 sm:px-8 lg:px-10 pt-4 lg:pt-6 pb-3 shrink-0">
              <SearchLinkLogo size="sm" onDarkBackground={false} />

              <button
                type="button"
                onClick={onClose}
                aria-label={t.auth.closePanelAria}
                className="w-10 h-10 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <X className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            </div>

            {/* Google-only authentication */}
            <div className="relative z-10 flex-1 overflow-y-auto flex items-center justify-center px-6 sm:px-10 lg:px-12 py-8">
              <div className="w-full max-w-[400px] lg:rounded-[28px] lg:border lg:border-slate-200/85 lg:bg-white/95 lg:backdrop-blur-sm lg:p-8 lg:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.16)]">
                <div className="mb-7">
                  <h2 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-slate-950 leading-[1.15] text-balance">
                    {t.auth.loginHeading}
                  </h2>
                  <p className="mt-2.5 text-sm text-slate-600 lg:text-slate-500 leading-relaxed">
                    {t.auth.loginSubtitle}
                  </p>
                </div>

                <label
                  htmlFor="accept-legal-terms"
                  className={`mb-4 flex items-start gap-2.5 cursor-pointer select-none rounded-xl transition-colors ${
                    termsHighlight ? 'ring-2 ring-rose-400/70 bg-rose-50/40 p-2 -mx-2' : 'py-1'
                  }`}
                >
                  <input
                    id="accept-legal-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAcceptedTerms(checked);
                      if (checked) {
                        setTermsHighlight(false);
                        setAuthError((prev) =>
                          prev === t.auth.termsError ? null : prev,
                        );
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-slate-400 shrink-0 cursor-pointer"
                  />
                  <span className="text-[13px] font-normal text-slate-700 leading-snug">
                    {t.auth.acceptTermsLabel}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={googleLoading}
                  aria-disabled={!acceptedTerms}
                  className={`w-full h-13 rounded-full bg-white border border-slate-200/95 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.09)] px-5 flex items-center justify-center gap-3 text-[15px] font-medium text-slate-800 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer ${
                    acceptedTerms
                      ? 'hover:border-slate-300 hover:bg-slate-50/85 active:scale-[0.99] opacity-100'
                      : 'opacity-60'
                  }`}
                >
                  {googleLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-slate-600 shrink-0" />
                  ) : (
                    <GoogleLogoIcon />
                  )}
                  <span>
                    {googleLoading
                      ? t.auth.connectingGoogle
                      : t.auth.continueWithGoogle}
                  </span>
                </button>

                {oauthFallbackUrl && (
                  <a
                    href={oauthFallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 w-full h-10 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 flex items-center justify-center transition-colors"
                  >
                    {t.auth.openGoogleNewTab}
                  </a>
                )}

                {authError && (
                  <p role="alert" className="mt-3 text-xs font-medium text-rose-600">
                    {authError}
                  </p>
                )}

                {authSuccess && (
                  <p role="status" className="mt-3 text-xs font-medium text-emerald-700">
                    {authSuccess}
                  </p>
                )}

                <div className="my-6 border-t border-slate-200/80" />

                <ul className="space-y-3 text-[13px] text-slate-600">
                  <li className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-slate-800 shrink-0" aria-hidden="true" />
                    <span>{t.auth.bullet1}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-slate-800 shrink-0" aria-hidden="true" />
                    <span>{t.auth.bullet2}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <KeyRound className="w-4 h-4 text-slate-800 shrink-0" aria-hidden="true" />
                    <span>{t.auth.bullet3}</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function translateSupabaseAuthError(
  message: string,
  t: TranslationDictionary,
): string {
  const lower = message.toLowerCase();
  if (lower.includes('provider is not enabled')) {
    return t.auth.errProviderNotEnabled;
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return t.auth.errRateLimit;
  }
  return message;
}

function GoogleLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.3 0 6.08-1.09 8.105-2.96l-3.88-3.05c-1.09.73-2.48 1.16-4.225 1.16-3.25 0-6.01-2.19-6.995-5.14H1.01v3.14C3.03 21.16 7.2 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.005 14.01a7.21 7.21 0 0 1 0-4.62V6.25H1.01a11.997 11.997 0 0 0 0 10.9l3.995-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.795 0 3.41.62 4.68 1.835l3.51-3.51C18.075 1.09 15.295 0 12 0 7.2 0 3.03 2.84 1.01 6.25l3.995 3.14c.985-2.95 3.745-5.14 6.995-5.14Z"
      />
    </svg>
  );
}
