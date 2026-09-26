import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import ReadinessGauge from '@/components/readiness-gauge';
import type { SpecSnapshot } from '@/lib/chat-client';

interface SpecPanelProps {
  spec: SpecSnapshot | null;
  harness: boolean;
  approving: boolean;
  disabled: boolean;
  onApprove: () => void;
}

export default function SpecPanel({ spec, harness, approving, disabled, onApprove }: SpecPanelProps) {
  if (!harness) {
    return (
      <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-900 dark:text-amber-200">
        <div className="font-semibold mb-1">Baseline run</div>
        The intent layer is off: no spec, no readiness gate, no scope fence. Use this run as the &ldquo;before&rdquo; in an A/B comparison.
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
      <h2 className="font-bold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-brand-teal" /> IntentSpec
      </h2>
      {!spec ? (
        <p className="text-sm text-slate-500">No active spec. Describe a change and the agent will draft one before touching code.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <ReadinessGauge score={spec.readinessScore} size="md" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-xs text-slate-500">{spec.id}</div>
              <div className="text-sm font-medium mt-1 line-clamp-3">{spec.objective}</div>
              <div className="text-xs mt-1 capitalize">
                {spec.approved ? (
                  <span className="text-emerald-600 font-semibold">Approved</span>
                ) : spec.ready ? (
                  <span className="text-amber-600 font-semibold">Ready for approval</span>
                ) : (
                  <span className="text-red-600 font-semibold">Blocked below {spec.threshold}</span>
                )}
              </div>
            </div>
          </div>

          {!spec.approved && (
            <button
              onClick={onApprove}
              disabled={!spec.ready || approving || disabled}
              className="w-full flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
              title={spec.ready ? 'Approve this spec so the agent may edit in-scope files' : 'The spec must pass the readiness gate first'}
            >
              {approving && <Loader2 className="w-4 h-4 animate-spin" />} Approve spec
            </button>
          )}

          {!spec.ready && spec.blockers.length > 0 && (
            <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
              {spec.blockers.map(b => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          )}

          {(spec.inScope.length > 0 || spec.outOfScope.length > 0) && (
            <div className="space-y-2 text-xs font-mono">
              {spec.inScope.map(p => (
                <div key={`in-${p}`} className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {p}
                </div>
              ))}
              {spec.outOfScope.map(p => (
                <div key={`out-${p}`} className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> {p}
                </div>
              ))}
            </div>
          )}

          {spec.outcomes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Outcomes</div>
              <ul className="text-sm space-y-1 list-disc pl-5">
                {spec.outcomes.map(o => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
