import { cn } from '@/lib/utils';
import type { Evidence } from '@/lib/api';

const trustColors: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400',
  low: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
};

export default function EvidencePanel({ evidence = [] }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return <div className="text-sm text-slate-500 italic">No evidence items logged.</div>;
  }

  return (
    <div className="grid gap-3">
      {evidence.map((item, idx) => (
        <div key={item.id ?? idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-4">
          <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 w-28 text-center">
            {item.type}
          </div>
          <div className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200">
            <p className="break-words">{item.excerpt}</p>
            {item.source && <p className="mt-1 text-xs text-slate-500 font-mono break-all">{item.source}</p>}
          </div>
          {item.trust && (
            <div className={cn('px-2 py-1 rounded text-[10px] font-bold uppercase shrink-0', trustColors[item.trust])}>
              {item.trust} trust
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
