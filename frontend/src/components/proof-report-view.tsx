import { CheckCircle2, AlertTriangle, GitCommit, XCircle } from 'lucide-react';

export default function ProofReportView({ report }: { report: any }) {
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
              <p className="text-sm text-emerald-700 dark:text-emerald-500/80 mt-1">All tests passed and no scope violations detected. The code aligns with the active IntentSpec.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-400">Blocked</h4>
              <p className="text-sm text-red-700 dark:text-red-500/80 mt-1">Please review the test failures or scope violations before committing.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Test Results</h4>
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-500">{report.testsPassed}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Passed</div>
            </div>
            <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-500">{report.testsFailed}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Failed</div>
            </div>
          </div>
        </div>

        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Scope Violations</h4>
          {report.scopeViolations?.length > 0 ? (
            <ul className="space-y-2">
              {report.scopeViolations.map((v: string, i: number) => (
                <li key={i} className="text-sm text-red-600 flex items-start gap-2">
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
    </div>
  );
}
