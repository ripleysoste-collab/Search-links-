import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileArchive,
  FileCode2,
  FileJson,
  FileKey2,
  FileText,
} from 'lucide-react';
import {
  buildQuickServerFiles,
  downloadQuickServerZip,
  type QuickServerFile,
  type QuickServerFileLang,
} from '../lib/quickServerTemplate';
import { LIGHT_TOKEN_CLASSES, tokenizeJsonLine } from './MobileJsonEditorModal';
import { useI18n } from '../lib/i18n';

interface QuickServerCodeViewerProps {
  secretKey?: string;
  variant: 'desktop' | 'mobile';
  activeFileId?: string;
  onSelectFileId?: (fileId: string) => void;
  hideHeader?: boolean;
}

interface CodeToken {
  text: string;
  className: string;
}

const JS_KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'try',
  'catch',
  'throw',
  'new',
  'typeof',
  'true',
  'false',
  'null',
  'undefined',
]);

const JS_TOKEN_REGEX =
  /(\/\/.*$|`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b(?:\s*(?=\())?|[{}()[\].,:;?+-/*=<>!&|]+)/g;

function tokenizeJsLine(line: string): CodeToken[] {
  if (!line) return [];
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//')) {
    return [{ text: line, className: 'text-slate-400 italic' }];
  }

  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  JS_TOKEN_REGEX.lastIndex = 0;

  while ((match = JS_TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        className: 'text-slate-800',
      });
    }

    const raw = match[0];
    if (raw.startsWith('//')) {
      tokens.push({ text: raw, className: 'text-slate-400 italic' });
    } else if (
      raw.startsWith("'") ||
      raw.startsWith('"') ||
      raw.startsWith('`')
    ) {
      tokens.push({ text: raw, className: 'text-[#0a3069]' });
    } else if (/^\d/.test(raw)) {
      tokens.push({ text: raw, className: 'text-[#0550ae]' });
    } else if (raw.endsWith('(') || /\s$/.test(raw)) {
      const ident = raw.trim();
      if (JS_KEYWORDS.has(ident)) {
        tokens.push({ text: raw, className: 'text-[#cf222e] font-medium' });
      } else {
        tokens.push({ text: raw, className: 'text-[#8250df]' });
      }
    } else if (JS_KEYWORDS.has(raw)) {
      const isLiteral =
        raw === 'true' ||
        raw === 'false' ||
        raw === 'null' ||
        raw === 'undefined';
      tokens.push({
        text: raw,
        className: isLiteral
          ? 'text-[#0550ae] font-medium'
          : 'text-[#cf222e] font-medium',
      });
    } else if (/^[{}()[\].,:;?+\-/*=<>!&|]+$/.test(raw)) {
      tokens.push({ text: raw, className: 'text-slate-500' });
    } else if (/^[A-Z0-9_]{2,}$/.test(raw)) {
      tokens.push({ text: raw, className: 'text-[#0550ae]' });
    } else {
      tokens.push({ text: raw, className: 'text-slate-800' });
    }

    lastIndex = JS_TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({
      text: line.slice(lastIndex),
      className: 'text-slate-800',
    });
  }

  return tokens;
}

function tokenizeEnvLine(line: string): CodeToken[] {
  if (!line) return [];
  if (line.trimStart().startsWith('#')) {
    return [{ text: line, className: 'text-slate-400 italic' }];
  }
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) {
    return [{ text: line, className: 'text-slate-800' }];
  }
  return [
    { text: line.slice(0, eqIdx), className: 'text-[#0550ae] font-medium' },
    { text: '=', className: 'text-slate-500' },
    { text: line.slice(eqIdx + 1), className: 'text-[#116329]' },
  ];
}

function tokenizeMarkdownLine(line: string): CodeToken[] {
  if (!line) return [];
  if (/^#{1,6}\s/.test(line)) {
    return [{ text: line, className: 'text-[#0550ae] font-semibold' }];
  }
  if (line.trimStart().startsWith('```')) {
    return [{ text: line, className: 'text-[#8250df]' }];
  }

  const parts = line.split(/(`[^`]+`)/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`')
        ? { text: part, className: 'text-[#116329] font-medium' }
        : { text: part, className: 'text-slate-700' },
    );
}

function tokenizeCodeLine(line: string, lang: QuickServerFileLang): CodeToken[] {
  if (lang === 'json') {
    return tokenizeJsonLine(line).map((tok) => ({
      text: tok.text,
      className: LIGHT_TOKEN_CLASSES[tok.type],
    }));
  }
  if (lang === 'env') return tokenizeEnvLine(line);
  if (lang === 'md') return tokenizeMarkdownLine(line);
  return tokenizeJsLine(line);
}

function renderFileIcon(file: QuickServerFile) {
  if (file.lang === 'json') {
    return <FileJson className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (file.lang === 'env') {
    return <FileKey2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (file.lang === 'md') {
    return <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  return <FileCode2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
}

export function QuickServerCodeViewer({
  secretKey,
  variant,
  activeFileId: controlledFileId,
  onSelectFileId,
  hideHeader = false,
}: QuickServerCodeViewerProps) {
  const { t } = useI18n();
  const [internalFileId, setInternalFileId] = useState('server');
  const [copiedFile, setCopiedFile] = useState(false);

  const files = useMemo(() => buildQuickServerFiles(secretKey), [secretKey]);
  const activeId = controlledFileId || internalFileId;
  const activeFile = useMemo(
    () => files.find((file) => file.id === activeId) ?? files[0],
    [files, activeId],
  );

  const handleSelectFile = (fileId: string) => {
    setCopiedFile(false);
    if (onSelectFileId) {
      onSelectFileId(fileId);
    } else {
      setInternalFileId(fileId);
    }
  };

  const tokenizedLines = useMemo(
    () =>
      activeFile.code
        .split('\n')
        .map((line) => tokenizeCodeLine(line, activeFile.lang)),
    [activeFile],
  );

  const handleCopyFile = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopiedFile(true);
      window.setTimeout(() => setCopiedFile(false), 1600);
    } catch {
      setCopiedFile(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-white flex flex-col">
      {!hideHeader && (
        <div
          className={`flex items-center justify-between border-b border-slate-200/75 bg-white shrink-0 ${
            variant === 'desktop' ? 'px-6 py-3.5' : 'px-4 py-3'
          }`}
        >
          <span className="text-sm font-semibold tracking-tight text-slate-950 truncate">
            {t.connectServer.quickServerTitle}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyFile()}
              aria-label={t.connectServer.copyQuickServerFileAria}
              title={copiedFile ? t.common.copied : t.common.copy}
              className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-100/80 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {copiedFile ? (
                <Check
                  className="w-4 h-4 text-emerald-600 stroke-[2.5]"
                  aria-hidden="true"
                />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => downloadQuickServerZip(secretKey)}
              aria-label={t.connectServer.downloadQuickServerZipAria}
              title={t.connectServer.downloadQuickServerZipTitle}
              className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-100/80 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <FileArchive className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Clean touch-scrollable file selector strip */}
      <div
        role="tablist"
        aria-label={t.connectServer.quickServerFilesAria}
        data-no-page-swipe="true"
        className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200/75 bg-white px-3 sm:px-5 shrink-0 touch-pan-x"
      >
        {files.map((file) => {
          const isActive = file.id === activeFile.id;
          return (
            <button
              key={file.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectFile(file.id)}
              className={`relative inline-flex items-center gap-1.5 px-2.5 py-2.5 text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-slate-950 ${
                isActive
                  ? 'text-slate-950 font-semibold'
                  : 'text-slate-500 font-medium hover:text-slate-800'
              }`}
            >
              <span
                className={
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }
              >
                {renderFileIcon(file)}
              </span>
              <span>{file.name}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-2 right-2 bottom-0 h-[2px] bg-slate-950 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Pure white read-only syntax-highlighted source code viewer */}
      <div
        aria-readonly="true"
        data-code-scroller="true"
        className={`flex-1 min-h-0 overflow-auto bg-white select-text font-mono text-[12px] leading-[1.65] ${
          variant === 'desktop' ? 'py-4 px-4' : 'pt-3 pb-8 px-2'
        }`}
      >
        <div className="min-w-max">
          {tokenizedLines.map((tokens, lineIdx) => (
            <div
              key={`${activeFile.id}-line-${lineIdx}`}
              className="flex items-start px-1.5 hover:bg-slate-50/75"
            >
              <span
                aria-hidden="true"
                className="w-8 pr-3 text-right text-[11px] text-slate-300 select-none shrink-0 tabular-nums"
              >
                {lineIdx + 1}
              </span>
              <pre className="whitespace-pre font-mono">
                {tokens.length === 0 ? (
                  <span>{' '}</span>
                ) : (
                  tokens.map((tok, tokIdx) => (
                    <span
                      key={`${activeFile.id}-tok-${lineIdx}-${tokIdx}`}
                      className={tok.className}
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
    </div>
  );
}
