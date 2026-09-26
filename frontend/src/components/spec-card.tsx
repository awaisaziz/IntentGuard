import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Spec } from '@/lib/api';

const statusColors = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  validated: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  approved: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  shipped: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
};

export default function SpecCard({ spec }: { spec: Spec }) {
  const outcomeCount = spec.outcomes?.length || 0;
  const evidenceCount = spec.evidence?.length || 0;

  return (
    <Link href={`/specs/${spec.id}`} className="block group">
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-teal transition-all shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div className="font-mono text-sm font-semibold text-slate-500">{spec.id}</div>
          <div className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border capitalize", statusColors[spec.status])}>
            {spec.status}
          </div>
        </div>
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4 line-clamp-2">
          {spec.objective}
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{outcomeCount} {outcomeCount === 1 ? 'Outcome' : 'Outcomes'}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>{evidenceCount} Evidence</span>
        </div>
      </div>
    </Link>
  );
}
