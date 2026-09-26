import { getSpecById } from '@/lib/api';
import ScopeTree from '@/components/scope-tree';
import EvidencePanel from '@/components/evidence-panel';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Target, ShieldAlert, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';

export default async function SpecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = await getSpecById(id);

  if (!spec) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Specs
      </Link>

      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full">{spec.id}</span>
          <span className="text-sm font-medium capitalize px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{spec.status}</span>
        </div>
        <h1 className="text-3xl font-bold leading-tight">{spec.objective}</h1>
      </header>

      <div className="grid grid-cols-4 gap-4 mt-8">
        <Link href={`/specs/${spec.id}/readiness`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-teal transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
            <div className="font-medium">Gate Audit</div>
          </div>
        </Link>
        <Link href={`/specs/${spec.id}/report`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-teal transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/40 rounded-lg"><Activity className="w-5 h-5" /></div>
            <div className="font-medium">Proof Report</div>
          </div>
        </Link>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Target className="w-5 h-5 text-brand-teal" /> Measurable Outcomes
          </h2>
          <ul className="space-y-3">
            {spec.outcomes.map((outcome, i) => (
              <li key={i} className="flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-800 dark:text-slate-200 font-medium">{outcome}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
            <ShieldAlert className="w-5 h-5 text-brand-teal" /> Scope Fence
          </h2>
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <ScopeTree inScope={spec.scope?.inScope} outOfScope={spec.scope?.outOfScope} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
            Evidence Board
          </h2>
          <EvidencePanel evidence={spec.evidence || []} />
        </section>
      </div>
    </div>
  );
}
