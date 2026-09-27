import React from 'react';
import { Bot, User, Loader2, CheckCircle2, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TranscriptItem =
  | { kind: 'user'; text: string }
  | { kind: 'agent'; text: string }
  | { kind: 'tool'; id: string; name: string; target: string; status: 'running' | 'ok' | 'error' | 'blocked'; summary?: string; blocked?: string }
  | { kind: 'notice'; tone: 'info' | 'success' | 'error'; text: string };

/** Very lightweight markdown renderer — handles the patterns the agent actually emits. */
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split into fenced code blocks and everything else
  const parts = text.split(/(```[\s\S]*?```)/g);
  parts.forEach((part, pi) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3).split('\n');
      const lang = lines.shift() ?? '';
      const code = lines.join('\n').replace(/```$/, '').trimEnd();
      nodes.push(
        <pre key={`code-${pi}`} className="my-2 p-3 bg-slate-900 dark:bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto border border-slate-700 whitespace-pre">
          {lang && <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{lang}</span>}
          {code}
        </pre>
      );
    } else {
      // Process line by line for lists and paragraphs
      const lines = part.split('\n');
      let listBuf: string[] = [];
      const flushList = () => {
        if (listBuf.length) {
          nodes.push(
            <ul key={`ul-${nodes.length}`} className="list-disc pl-5 space-y-0.5 my-1">
              {listBuf.map((l, i) => <li key={i}>{inlineMarkdown(l)}</li>)}
            </ul>
          );
          listBuf = [];
        }
      };
      lines.forEach((line, li) => {
        const bulletMatch = line.match(/^[-*]\s+(.*)/);
        if (bulletMatch) {
          listBuf.push(bulletMatch[1]);
        } else {
          flushList();
          const trimmed = line.trim();
          if (!trimmed) {
            // blank line — small spacer
            if (li !== 0) nodes.push(<span key={`br-${nodes.length}`} className="block h-1" />);
          } else {
            nodes.push(<span key={`line-${pi}-${li}`} className="block">{inlineMarkdown(trimmed)}</span>);
          }
        }
      });
      flushList();
    }
  });
  return nodes;
}

/** Handle **bold**, `inline code`, and plain text within a single line. */
function inlineMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // Split on **bold** and `code`
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  tokens.forEach((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      result.push(<strong key={i} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`') && tok.endsWith('`')) {
      result.push(<code key={i} className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[0.8em] font-mono">{tok.slice(1, -1)}</code>);
    } else {
      result.push(tok);
    }
  });
  return result;
}

const BLOCK_LABEL: Record<string, string> = {
  'no-spec': 'No IntentSpec',
  'not-ready': 'Readiness gate',
  'not-approved': 'Awaiting approval',
  'out-of-scope': 'Out of scope',
};

function ToolLine({ item }: { item: Extract<TranscriptItem, { kind: 'tool' }> }) {
  const icon =
    item.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> :
    item.status === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
    item.status === 'blocked' ? <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> :
    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-xs font-mono px-3 py-1.5 rounded-md',
        item.status === 'blocked' ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300' : 'text-slate-500'
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 break-words">
        {item.status === 'blocked' && <span className="font-bold uppercase mr-2">Blocked · {BLOCK_LABEL[item.blocked ?? ''] ?? item.blocked}</span>}
        <span className="font-semibold">{item.name}</span> {item.target}
        {item.summary && item.status !== 'ok' && <span className="block opacity-80">{item.summary}</span>}
      </span>
    </div>
  );
}

export default function Transcript({ items }: { items: TranscriptItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        if (item.kind === 'tool') return <ToolLine key={item.id + i} item={item} />;
        if (item.kind === 'notice') {
          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2 text-sm px-3 py-2 rounded-lg border',
                item.tone === 'error' && 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300',
                item.tone === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300',
                item.tone === 'info' && 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
              )}
            >
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{item.text}</span>
            </div>
          );
        }
        const isUser = item.kind === 'user';
        return (
          <div key={i} className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', isUser ? 'bg-slate-800 text-white' : 'bg-brand-teal text-white')}>
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
                className={cn(
                  'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm break-words',
                  isUser ? 'bg-slate-800 text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-sm'
                )}
              >
                {isUser ? item.text : renderMarkdown(item.text)}
              </div>
          </div>
        );
      })}
    </div>
  );
}
