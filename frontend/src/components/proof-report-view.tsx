import { CheckCircle2, AlertTriangle, GitCommit, XCircle, CircleDashed, HelpCircle } from 'lucide-react';
import type { ProofReport } from '@/lib/api';

const outcomeIcon = {
  pass: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
  fail: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
  untested: <CircleDashed className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
};

const healthIcon = {
  pass: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
  fail: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  unknown: <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />,
};

export default function ProofReportView({ report }: { report: ProofReport }) {
  const { verification } = report;
  const tests = verification.testsRun ?? [];
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.length - passed;
  const outcomes = verification.outcomesChecked ?? [];
  const health = verification.healthMetricsChecked ?? [];
  const violations = verification.scopeViolations ?? [];

  return (
    <div className="space-y-6">
      <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-brand-teal" />
          Commit Readiness
        </h3>

        {report.commitReady ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-emerald-900 dark:text-emerald-400">Ready to Commit</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-500/80 mt-1">{report.summary}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-400">Blocked</h4>
              <p className="text-sm text-red-700 dark:text-red-500/80 mt-1">{report.summary}</p>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Verified {new Date(report.timestamp * 1000).toLocaleString()}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Related Tests</h4>
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-500">{passed}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Passed</div>
            </div>
            <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-500">{failed}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Failed</div>
            </div>
          </div>
          {tests.length > 0 && (
            <ul className="mt-4 space-y-1">
              {tests.map(t => (
                <li key={t.file} className="text-xs font-mono text-slate-600 dark:text-slate-400 flex items-start gap-2 break-all">
                  {t.passed ? outcomeIcon.pass : outcomeIcon.fail} {t.file}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Scope Violations</h4>
          {violations.length > 0 ? (
            <ul className="space-y-2">
              {violations.map(v => (
                <li key={v} className="text-sm text-red-600 flex items-start gap-2 font-mono break-all">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {v}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No violations detected.
            </div>
          )}
        </div>
      </div>

      <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <h4 className="font-medium mb-4">Outcomes</h4>
        {outcomes.length > 0 ? (
          <ul className="space-y-3">
            {outcomes.map((o, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                {outcomeIcon[o.status]}
                <div className="min-w-0">
                  <span className="text-slate-800 dark:text-slate-200">{o.outcome}</span>
                  <span className="ml-2 text-xs uppercase font-semibold text-slate-500">{o.status}</span>
                  {o.testFile && <div className="text-xs font-mono text-slate-500 break-all">{o.testFile}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-slate-500 italic">The spec defines no outcomes.</div>
        )}
      </div>

      {health.length > 0 && (
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Health Metrics</h4>
          <ul className="space-y-3">
            {health.map((h, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                {healthIcon[h.status]}
                <div>
                  <span className="text-slate-800 dark:text-slate-200">{h.metric}</span>
                  {h.details && <div className="text-xs text-slate-500">{h.details}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
