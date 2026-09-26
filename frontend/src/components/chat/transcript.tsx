import { Bot, User, Loader2, CheckCircle2, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TranscriptItem =
  | { kind: 'user'; text: string }
  | { kind: 'agent'; text: string }
  | { kind: 'tool'; id: string; name: string; target: string; status: 'running' | 'ok' | 'error' | 'blocked'; summary?: string; blocked?: string }
  | { kind: 'notice'; tone: 'info' | 'success' | 'error'; text: string };

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
                'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words',
                isUser ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-sm'
              )}
            >
              {item.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
