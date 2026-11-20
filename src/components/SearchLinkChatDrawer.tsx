import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, Loader2, Package, RotateCcw, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { resolveApiUrl } from '../lib/apiConfig';
import { getSupabaseAccessToken } from '../lib/supabaseClient';
import type { OrganizationServiceItem } from './DesktopOrganizationView';

interface ChatProductCard {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  imagen_url: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: ChatProductCard[];
  streaming?: boolean;
  error?: boolean;
}

interface SearchLinkChatDrawerProps {
  service: OrganizationServiceItem | null;
  organizationName: string;
  userId?: string;
  onClose: () => void;
}

export function SearchLinkChatDrawer({
  service,
  organizationName,
  userId,
  onClose,
}: SearchLinkChatDrawerProps) {
  const { locale, t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [messagesByService, setMessagesByService] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dailyLimitUsed, setDailyLimitUsed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeMessages = service ? messagesByService[service.id] ?? [] : [];

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `searchlink_ia_daily_${userId || 'anon'}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { day?: string; used?: number };
        if (
          parsed.day === today &&
          typeof parsed.used === 'number' &&
          parsed.used >= 5
        ) {
          setDailyLimitUsed(true);
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    setDailyLimitUsed(false);
  }, [userId, service?.id]);

  useEffect(() => {
    if (!service || dailyLimitUsed) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [service?.id, dailyLimitUsed]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages, isSending]);

  const handleResetChat = () => {
    if (!service || isSending) return;
    setMessagesByService((prev) => ({
      ...prev,
      [service.id]: [],
    }));
    if (!dailyLimitUsed) {
      inputRef.current?.focus();
    }
  };

  const updateAssistantMessage = (
    serviceId: string,
    msgId: string,
    updater: (prevMsg: ChatMessage) => ChatMessage,
  ) => {
    setMessagesByService((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).map((m) =>
        m.id === msgId ? updater(m) : m,
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!service || isSending || dailyLimitUsed) return;

    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const currentServiceId = service.id;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
    };
    const botMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const placeholderBotMsg: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      text: '',
      products: [],
      streaming: true,
    };

    const currentHistory = (messagesByService[currentServiceId] ?? [])
      .filter((m) => !m.error && m.text.trim().length > 0)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessagesByService((prev) => ({
      ...prev,
      [currentServiceId]: [
        ...(prev[currentServiceId] ?? []),
        userMsg,
        placeholderBotMsg,
      ],
    }));
    setInputValue('');
    setIsSending(true);

    try {
      const accessToken = await getSupabaseAccessToken();
      const res = await fetch(resolveApiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          history: currentHistory,
          serviceSlug: service.slug,
          apiKey: service.apiKey,
          serviceName: service.name,
          organizationName,
          userId,
          locale,
          fallbackProducts: (service.products ?? []).map((prod) => ({
            id: prod.id,
            nombre: prod.nombre,
            categoria: prod.categoria,
            descripcion: prod.descripcion,
            imagen_url: prod.url,
            url: prod.url,
          })),
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('text/event-stream') || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          reply?: string;
          products?: ChatProductCard[];
          dailyLimitReached?: boolean;
          used?: number;
          limit?: number;
          day?: string;
          error?: string;
        };

        if (res.status === 429 || data.dailyLimitReached) {
          setDailyLimitUsed(true);
          try {
            window.localStorage.setItem(
              `searchlink_ia_daily_${userId || 'anon'}`,
              JSON.stringify({
                day: data.day || new Date().toISOString().slice(0, 10),
                used: data.used ?? data.limit ?? 5,
              }),
            );
          } catch {
            // Ignore storage errors
          }
        }

        if (!res.ok || !data.ok) {
          updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
            ...m,
            streaming: false,
            error: true,
            text: data.error || t.chat.defaultRequestError,
          }));
          return;
        }

        updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
          ...m,
          streaming: false,
          products: Array.isArray(data.products) ? data.products : [],
          text: data.reply || t.chat.defaultSuccessReply,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        let boundaryIdx = sseBuffer.indexOf('\n\n');
        while (boundaryIdx !== -1) {
          const rawBlock = sseBuffer.slice(0, boundaryIdx);
          sseBuffer = sseBuffer.slice(boundaryIdx + 2);

          const dataLine = rawBlock
            .split('\n')
            .find((line) => line.startsWith('data:'));

          if (dataLine) {
            try {
              const evt = JSON.parse(dataLine.slice(5).trim()) as
                | { type: 'products'; products: ChatProductCard[] }
                | { type: 'delta'; text: string }
                | {
                    type: 'done';
                    dailyLimit?: { used: number; limit: number; day: string };
                  }
                | { type: 'error'; error: string };

              if (evt.type === 'products') {
                updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
                  ...m,
                  products: Array.isArray(evt.products) ? evt.products : [],
                }));
              } else if (evt.type === 'delta' && evt.text) {
                updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
                  ...m,
                  text: m.text + evt.text,
                }));
              } else if (evt.type === 'done') {
                if (evt.dailyLimit) {
                  try {
                    window.localStorage.setItem(
                      `searchlink_ia_daily_${userId || 'anon'}`,
                      JSON.stringify({
                        day: evt.dailyLimit.day,
                        used: evt.dailyLimit.used,
                      }),
                    );
                  } catch {
                    // Ignore storage errors
                  }
                  if (evt.dailyLimit.used >= evt.dailyLimit.limit) {
                    setDailyLimitUsed(true);
                  }
                }
                updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
                  ...m,
                  streaming: false,
                }));
              } else if (evt.type === 'error') {
                updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
                  ...m,
                  streaming: false,
                  error: true,
                  text: evt.error || t.chat.defaultStreamError,
                }));
              }
            } catch {
              // Ignore malformed SSE event payload
            }
          }

          boundaryIdx = sseBuffer.indexOf('\n\n');
        }
      }

      updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
        ...m,
        streaming: false,
      }));
    } catch {
      updateAssistantMessage(currentServiceId, botMsgId, (m) => ({
        ...m,
        streaming: false,
        error: true,
        text: t.chat.networkError,
      }));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {service && (
        <motion.aside
          role="dialog"
          aria-modal="true"
          aria-label={`Search Link IA - ${service.name}`}
          initial={
            shouldReduceMotion ? { opacity: 0 } : { x: '-100%', opacity: 0.96 }
          }
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
          exit={
            shouldReduceMotion ? { opacity: 0 } : { x: '-100%', opacity: 0.96 }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
          }
          className="fixed inset-0 lg:inset-y-0 lg:left-0 lg:right-auto lg:w-1/2 z-[60] lg:z-40 bg-white lg:border-r lg:border-slate-200/85 lg:shadow-[18px_0_48px_-18px_rgba(15,23,42,0.2)] flex flex-col"
        >
          {/* Minimal Top Bar: X on the top-left corner + Search Link IA title */}
          <header className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label={t.chat.closeAria}
                className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-950 whitespace-nowrap shrink-0">
                  Search Link IA
                </h2>
                <span
                  aria-hidden="true"
                  className="text-slate-300 text-xs shrink-0"
                >
                  ·
                </span>
                <span className="text-xs font-normal text-slate-500 truncate">
                  {service.name}
                </span>
              </div>
            </div>

            {activeMessages.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                disabled={isSending}
                aria-label={t.chat.clearConversation}
                title={t.chat.clearConversation}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 disabled:opacity-45"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{t.chat.clearShort}</span>
              </button>
            )}
          </header>

          {/* Pure White Conversation Surface */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 bg-white flex flex-col"
          >
            {activeMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 select-none">
                <div className="max-w-sm space-y-2">
                  <p className="text-lg font-semibold tracking-tight text-slate-950">
                    Search Link IA
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {organizationName !== 'Sin nombre'
                      ? `${organizationName} · `
                      : ''}
                    {service.name} · {t.chat.liveProducts(service.itemCount)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-w-2xl w-full mx-auto">
                {activeMessages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-br-md bg-slate-900 text-white px-4 py-2.5 text-[13.5px] leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="space-y-3">
                      {/* 1. IMAGES FIRST so the user sees results in milliseconds */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {msg.products.map((prod) => {
                            const imgBroken = failedImages[prod.id];
                            return (
                              <div
                                key={`${msg.id}-${prod.id}`}
                                className="rounded-xl border border-slate-200/85 bg-white overflow-hidden"
                              >
                                <div className="aspect-[4/3] bg-slate-50 overflow-hidden flex items-center justify-center">
                                  {prod.imagen_url && !imgBroken ? (
                                    <img
                                      src={prod.imagen_url}
                                      alt={prod.nombre}
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
                                      className="w-5 h-5 text-slate-300"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="p-2 space-y-0.5">
                                  <p className="text-[11.5px] font-semibold text-slate-900 line-clamp-1">
                                    {prod.nombre}
                                  </p>
                                  <p className="text-[10.5px] text-slate-500 line-clamp-1">
                                    {prod.categoria}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. SHORT FRIENDLY TEXT BELOW IMAGES */}
                      {msg.text ? (
                        <div
                          className={`text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                            msg.error
                              ? 'rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-rose-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {msg.text}
                        </div>
                      ) : (
                        msg.streaming && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2
                              className="w-3.5 h-3.5 animate-spin text-slate-400"
                              aria-hidden="true"
                            />
                            <span>
                              {msg.products && msg.products.length > 0
                                ? t.chat.preparingReply
                                : t.chat.queryingCatalog}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Minimal Bottom Chat Input + 5/day limit notice */}
          <div className="px-4 sm:px-6 pb-5 pt-3 border-t border-slate-100 bg-white shrink-0 space-y-2">
            {dailyLimitUsed && (
              <p className="text-center text-[11.5px] font-medium text-rose-600">
                {t.chat.dailyLimitNotice}
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              className={`max-w-2xl mx-auto flex items-center gap-2 rounded-full border pl-4 pr-1.5 py-1.5 transition-colors ${
                dailyLimitUsed
                  ? 'border-slate-200/80 bg-slate-50/70'
                  : 'border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] focus-within:border-slate-400'
              }`}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isSending || dailyLimitUsed}
                placeholder={
                  dailyLimitUsed
                    ? t.chat.dailyLimitPlaceholder
                    : t.chat.inputPlaceholder
                }
                aria-label={t.chat.inputAria}
                className="flex-1 min-w-0 bg-transparent text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSending || dailyLimitUsed || !inputValue.trim()}
                aria-label={t.chat.sendAria}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </form>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
