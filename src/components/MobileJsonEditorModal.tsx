import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Copy, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface MobileJsonEditorModalProps {
  jsonText: string;
  onClose: () => void;
}

export type JsonTokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation';

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

export function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const regex =
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'punctuation',
        text: line.slice(lastIndex, match.index),
      });
    }

    const token = match[0];
    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        const colonIdx = token.lastIndexOf(':');
        tokens.push({ type: 'key', text: token.slice(0, colonIdx) });
        tokens.push({ type: 'punctuation', text: token.slice(colonIdx) });
      } else {
        tokens.push({ type: 'string', text: token });
      }
    } else if (token === 'true' || token === 'false') {
      tokens.push({ type: 'boolean', text: token });
    } else if (token === 'null') {
      tokens.push({ type: 'null', text: token });
    } else if (/^-?\d/.test(token)) {
      tokens.push({ type: 'number', text: token });
    } else {
      tokens.push({ type: 'punctuation', text: token });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'punctuation', text: line.slice(lastIndex) });
  }

  return tokens;
}

export const LIGHT_TOKEN_CLASSES: Record<JsonTokenType, string> = {
  key: 'text-[#0550ae]',
  string: 'text-[#116329]',
  number: 'text-[#953800]',
  boolean: 'text-[#8250df]',
  null: 'text-[#cf222e]',
  punctuation: 'text-slate-500',
};

export function MobileJsonEditorModal({
  jsonText,
  onClose,
}: MobileJsonEditorModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => jsonText.split('\n'), [jsonText]);
  const tokenizedLines = useMemo(
    () => lines.map((line) => tokenizeJsonLine(line)),
    [lines],
  );

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

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label={t.pipeline.readOnlyEditorAria}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 lg:hidden bg-white text-slate-900 flex flex-col"
    >
      {/* Bare Copy & Close icons top-right directly over the white canvas — no bar or box */}
      <div className="fixed top-3.5 right-4 z-10 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleCopyAll()}
          aria-label={t.pipeline.copyAllJsonAria}
          title={t.pipeline.copyJsonTitle}
          className="p-1 text-slate-400 hover:text-slate-800 active:opacity-60 transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={t.pipeline.closeEditorTitle}
          className="p-1 text-slate-500 hover:text-slate-950 active:opacity-60 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Pure white read-only syntax-highlighted JSON canvas */}
      <div
        aria-readonly="true"
        className="flex-1 min-h-0 overflow-auto pt-4 pb-8 px-2 pr-16 font-mono text-[12px] leading-[1.65] select-text"
      >
        <div className="min-w-max">
          {tokenizedLines.map((tokens, idx) => (
            <div key={`code-line-${idx}`} className="flex items-start px-1.5">
              <span
                aria-hidden="true"
                className="w-8 pr-3 text-right text-[11px] text-slate-300 select-none shrink-0 tabular-nums"
              >
                {idx + 1}
              </span>
              <pre className="whitespace-pre font-mono">
                {tokens.length === 0 ? (
                  <span>{' '}</span>
                ) : (
                  tokens.map((tok, tIdx) => (
                    <span
                      key={`tok-${idx}-${tIdx}`}
                      className={LIGHT_TOKEN_CLASSES[tok.type]}
                    >
                      {tok.text}
                    </span>
                  ))
                )}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
