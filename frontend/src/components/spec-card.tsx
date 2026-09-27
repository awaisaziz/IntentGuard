import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Spec } from '@/lib/api';

export const statusColors = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  validated: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  approved: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  shipped: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
};

export default function SpecCard({ spec }: { spec: Spec }) {
  const outcomeCount = spec.outcomes?.length || 0;
  const evidenceCount = spec.evidence?.length || 0;
  const score = Math.round(spec.readinessScore ?? 0);
  const bar = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Link href={`/specs/${spec.id}`} className="block group h-full">
      <div className="h-full flex flex-col p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:border-brand-teal group-hover:shadow-md transition-all shadow-sm">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="font-mono text-sm font-semibold text-slate-500 truncate">
            {spec.id}
            {spec.active && <span className="ml-2 text-[10px] font-sans font-bold uppercase text-brand-teal">active</span>}
          </div>
          <div className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border capitalize shrink-0', statusColors[spec.status])}>
            {spec.status}
          </div>
        </div>
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4 line-clamp-3 flex-1">{spec.objective}</h3>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={cn('h-full rounded-full', bar)} style={{ width: `${score}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400 w-9 text-right">{score}%</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            {outcomeCount} {outcomeCount === 1 ? 'Outcome' : 'Outcomes'}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>{evidenceCount} Evidence</span>
        </div>
      </div>
    </Link>
  );
}
