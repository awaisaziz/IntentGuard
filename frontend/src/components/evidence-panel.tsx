import { cn } from '@/lib/utils';
import type { Spec } from '@/lib/api';

export default function EvidencePanel({ evidence = [] }: { evidence: NonNullable<Spec['evidence']> }) {
  if (evidence.length === 0) {
    return <div className="text-sm text-slate-500 italic">No evidence items logged.</div>;
  }

  return (
    <div className="grid gap-3">
      {evidence.map((item, idx) => (
        <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-4">
          <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 w-24 text-center">
            {item.type}
          </div>
          <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
            {item.description}
          </div>
          <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", 
            item.trustTier === 'backed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
            item.trustTier === 'unreviewed' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' :
            'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
          )}>
            {item.trustTier}
          </div>
        </div>
      ))}
    </div>
  );
}
