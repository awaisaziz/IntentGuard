import { CheckCircle2, AlertTriangle, GitCommit, XCircle } from 'lucide-react';

interface OutcomeCheck {
  outcome: string;
  status: 'pass' | 'fail' | 'untested';
  testFile?: string;
}

interface HealthCheck {
  metric: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  details?: string;
}

interface VerificationResult {
  passed: boolean;
  scopeViolations: string[];
  outcomesChecked: OutcomeCheck[];
  healthMetricsChecked: HealthCheck[];
  testsRun: { file: string; passed: boolean; output?: string }[];
}

interface ProofReport {
  specId: string;
  timestamp?: number;
  commitReady: boolean;
  summary?: string;
  verification?: VerificationResult;
  // Legacy shape kept for backward compat
  testsPassed?: number;
  testsFailed?: number;
  scopeViolations?: string[];
}

export default function ProofReportView({ report }: { report: unknown }) {
  const r = report as ProofReport;
  const ver = r.verification;

  // Derive counts from either the new verification shape or legacy fields
  const passed = ver
    ? ver.testsRun.filter(t => t.passed).length
    : (r.testsPassed ?? 0);
  const failed = ver
    ? ver.testsRun.filter(t => !t.passed).length
    : (r.testsFailed ?? 0);
  const violations: string[] = ver?.scopeViolations ?? r.scopeViolations ?? [];

  return (
    <div className="space-y-6">
      <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-brand-teal" />
          Commit Readiness
        </h3>

        {r.commitReady ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-emerald-900 dark:text-emerald-400">Ready to Commit</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-500/80 mt-1">
                {r.summary ?? 'All tests passed and no scope violations detected.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-400">Blocked</h4>
              <p className="text-sm text-red-700 dark:text-red-500/80 mt-1">
                {r.summary ?? 'Please review the test failures or scope violations before committing.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Test Results</h4>
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
        </div>

        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Scope Violations</h4>
          {violations.length > 0 ? (
            <ul className="space-y-2">
              {violations.map((v, i) => (
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

      {ver && ver.outcomesChecked.length > 0 && (
        <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <h4 className="font-medium mb-4">Outcome Checks</h4>
          <ul className="space-y-2">
            {ver.outcomesChecked.map((oc, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {oc.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : oc.status === 'fail' ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span className="text-slate-700 dark:text-slate-300">{oc.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
