import { getProofReport, getSpecById } from '@/lib/api';
import ProofReportView from '@/components/proof-report-view';
import Link from 'next/link';
import { ArrowLeft, Activity, FileQuestion } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spec, report] = await Promise.all([getSpecById(id), getProofReport(id)]);
  if (!spec) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href={`/specs/${spec.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Spec
      </Link>

      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="w-8 h-8 text-brand-teal" />
          Proof Report
        </h1>
        <p className="text-slate-500 mt-2 font-mono text-sm">{spec.id}</p>
      </div>

      {report ? (
        <ProofReportView report={report} />
      ) : (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="font-semibold flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-slate-400" /> No proof report yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            A report is written when the change is verified against this spec. Ask the agent in Agent Chat to verify, or run:
          </p>
          <pre className="mt-3 p-3 rounded-lg bg-slate-950 text-slate-200 text-sm font-mono overflow-x-auto">{`pnpm run cli -- report ${spec.id}`}</pre>
        </div>
      )}
    </div>
  );
}
