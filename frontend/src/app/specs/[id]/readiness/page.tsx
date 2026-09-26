import { getSpecById } from '@/lib/api';
import GateChecklist from '@/components/gate-checklist';
import ReadinessGauge from '@/components/readiness-gauge';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = await getSpecById(id);
  if (!spec) notFound();

  // Mocked gate data based on IntentGuard logic
  const gates = [
    { id: 'g1', name: 'Has Valid Objective', status: 'pass' as const },
    { id: 'g2', name: 'Has Measurable Outcomes', status: 'pass' as const },
    { id: 'g3', name: 'Scope Boundaries Defined', status: 'warn' as const, message: 'Consider adding explicit out-of-scope boundaries.' },
    { id: 'g4', name: 'Evidence Backed', status: 'pass' as const },
    { id: 'g5', name: 'Constraints Identified', status: 'fail' as const, message: 'No technical constraints provided.' },
    { id: 'g6', name: 'Verification Strategy', status: 'pass' as const }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href={`/specs/${spec.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Spec
      </Link>

      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-brand-teal" />
            Readiness Audit
          </h1>
          <p className="text-slate-500 mt-2 font-mono text-sm">{spec.id}</p>
        </div>
        <ReadinessGauge score={80} size="md" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold mb-6">6-Gate Validation</h2>
        <GateChecklist gates={gates} />
      </div>
    </div>
  );
}
