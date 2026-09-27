'use client';

import { useEffect, useState } from 'react';
import { getSpecById, getProofReport, runVerify, type Spec } from '@/lib/api';
import ProofReportView from '@/components/proof-report-view';
import Link from 'next/link';
import { ArrowLeft, Activity, Loader2, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { use } from 'react';

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [report, setReport] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const fetchReport = () =>
    Promise.all([getSpecById(id), getProofReport(id)])
      .then(([s, r]) => { setSpec(s); setReport(r); })
      .finally(() => setLoading(false));

  useEffect(() => { fetchReport(); }, [id]);

  const handleVerify = async () => {
    if (!spec) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const fresh = await runVerify(spec.id);
      setReport(fresh);
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </Link>
        <p className="text-slate-500">Spec not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href={`/specs/${spec.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Spec
      </Link>

      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="w-8 h-8 text-brand-teal" />
              Proof Report
            </h1>
            <p className="text-slate-500 mt-2 font-mono text-sm">{spec.id}</p>
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-brand-teal hover:bg-brand-dark text-white disabled:opacity-50 transition-all"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {verifying ? 'Verifying…' : 'Re-run verify'}
          </button>
        </div>
        {verifyError && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {verifyError}
          </div>
        )}
      </div>

      {report ? (
        <ProofReportView report={report} />
      ) : (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <p className="text-sm text-slate-500">
            No proof report exists yet for this spec. Click <strong>Re-run verify</strong> above or run{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">intent verify</code> from the CLI.
          </p>
          {verifyError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {verifyError}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            After running, the report will appear here automatically.
          </div>
        </div>
      )}
    </div>
  );
}
