import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { deleteSpec, type Spec } from '@/lib/api';
import { ShieldCheck, Clock, CheckCircle2, Package, AlertCircle, Trash2, Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft:    { label: 'Draft',    cls: 'text-slate-400 bg-slate-800/80 border-slate-700',          icon: <Clock       className="w-3 h-3" /> },
  validated:{ label: 'Validated',cls: 'text-blue-400   bg-blue-950/40  border-blue-700/50',       icon: <AlertCircle className="w-3 h-3" /> },
  approved: { label: 'Approved', cls: 'text-purple-400 bg-purple-950/40 border-purple-700/50',    icon: <ShieldCheck className="w-3 h-3" /> },
  shipped:  { label: 'Shipped',  cls: 'text-amber-400  bg-amber-950/40  border-amber-700/50',     icon: <Package     className="w-3 h-3" /> },
  verified: { label: 'Verified', cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50', icon: <CheckCircle2 className="w-3 h-3" /> },
};

function ReadinessPip({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-slate-700 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{score}%</span>
    </div>
  );
}

export default function SpecCard({
  spec,
  onDeleted,
}: {
  spec: Spec;
  onDeleted?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[spec.status] ?? STATUS_CONFIG.draft;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete spec ${spec.id}?\n\n"${spec.objective}"\n\nThis cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSpec(spec.id);
      onDeleted?.(spec.id);
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="relative group">
      <Link href={`/specs/${spec.id}`} className="block">
        <div className={cn(
          'relative overflow-hidden p-5 rounded-xl border bg-slate-900/60 transition-all duration-200',
          error ? 'border-red-500/50' : 'border-slate-800 hover:border-brand-teal/50 hover:bg-slate-800/60'
        )}>
          {/* Top glow on hover */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-teal to-transparent opacity-0 group-hover:opacity-40 transition-opacity" />

          <div className="flex justify-between items-start mb-3 gap-2">
            <span className="font-mono text-xs text-slate-500 shrink-0 pt-0.5">{spec.id}</span>
            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wider shrink-0', cfg.cls)}>
              {cfg.icon}{cfg.label}
            </span>
          </div>

          <h3 className="font-semibold text-slate-200 mb-4 line-clamp-2 leading-snug group-hover:text-white transition-colors pr-6">
            {spec.objective}
          </h3>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span>{spec.outcomes?.length ?? 0} {(spec.outcomes?.length ?? 0) === 1 ? 'outcome' : 'outcomes'}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>{spec.evidence?.length ?? 0} evidence</span>
            </div>
            {spec.readinessScore !== undefined && (
              <ReadinessPip score={spec.readinessScore} />
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> {error}
            </p>
          )}
        </div>
      </Link>

      {/* Delete button — floats top-right, visible on hover */}
      {onDeleted && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete spec"
          className={cn(
            'absolute top-3 right-3 z-10 p-1.5 rounded-lg border transition-all',
            'opacity-0 group-hover:opacity-100',
            deleting
              ? 'border-slate-700 text-slate-500 cursor-not-allowed'
              : 'border-red-500/30 bg-red-950/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/60'
          )}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
