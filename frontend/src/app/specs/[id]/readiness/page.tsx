import { getReadiness, getSpecById } from '@/lib/api';
import GateChecklist from '@/components/gate-checklist';
import ReadinessGauge from '@/components/readiness-gauge';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spec, readiness] = await Promise.all([getSpecById(id), getReadiness(id)]);
  if (!spec || !readiness) notFound();

  const gates = readiness.gates.map(gate => ({
    id: gate.name,
    name: `${gate.name} (weight ${gate.weight})`,
    status: gate.status,
    message: gate.message,
  }));

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
        <ReadinessGauge score={Math.round(readiness.score)} size="md" />
      </div>

      <div
        className={
          readiness.ready
            ? 'p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300 text-sm'
            : 'p-4 rounded-lg border border-red-200 bg-red-50 text-red-900 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300 text-sm'
        }
      >
        {readiness.ready ? (
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Ready: the score meets the readiness threshold, so coding may start.
          </span>
        ) : (
          <div>
            <span className="flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4" /> Blocked: coding may not start until the score reaches the threshold.
            </span>
            {readiness.blockers.length > 0 && (
              <ul className="mt-2 list-disc list-inside space-y-1">
                {readiness.blockers.map(blocker => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold mb-6">6-Gate Validation</h2>
        <GateChecklist gates={gates} />
      </div>
    </div>
  );
}
