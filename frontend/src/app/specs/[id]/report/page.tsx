import { getProofReport, getSpecById } from '@/lib/api';
import ProofReportView from '@/components/proof-report-view';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = await getSpecById(id);
  const report = await getProofReport(id);

  if (!spec || !report) notFound();

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

      <ProofReportView report={report} />
    </div>
  );
}
