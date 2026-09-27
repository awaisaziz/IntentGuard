import { getActiveSpec, getAllSpecs } from '@/lib/api';
import IntentFlow from '@/components/intent-flow';
import SpecCard from '@/components/spec-card';
import ReadinessGauge from '@/components/readiness-gauge';
import Link from 'next/link';
import { ArrowRight, Activity, ShieldCheck } from 'lucide-react';

export default async function HomePage() {
  const activeSpec = await getActiveSpec();
  const allSpecs = await getAllSpecs();

  return (
    <div className="space-y-12">
      <section className="py-6">
        <h1 className="text-3xl font-bold mb-2">IntentGuard Dashboard</h1>
        <p className="text-slate-500">Monitor and enforce intent across your AI coding workflows.</p>
      </section>

      <section>
        <IntentFlow currentStep={
          !activeSpec ? 1 :
          activeSpec.status === 'verified' ? 5 :
          activeSpec.status === 'shipped' ? 4 :
          activeSpec.status === 'approved' ? 3 :
          2
        } />
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-teal" />
              Active Specification
            </h2>
            {activeSpec && (
              <Link href={`/specs/${activeSpec.id}`} className="text-sm font-medium text-brand-teal hover:underline flex items-center gap-1">
                View Details <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          
          {activeSpec ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-mono font-semibold text-slate-500 mb-2 block">{activeSpec.id}</span>
                <h3 className="text-lg font-medium">{activeSpec.objective}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">Outcomes</div>
                  <div className="text-2xl font-semibold">{activeSpec.outcomes?.length || 0}</div>
                </div>
                <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <div className="text-sm text-slate-500 mb-1">Status</div>
                  <div className="text-lg font-semibold capitalize text-brand-teal">{activeSpec.status}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No active specification found.</div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
          <h2 className="text-lg font-bold mb-6 w-full text-left">Readiness Score</h2>
          <ReadinessGauge score={activeSpec?.readinessScore ?? 0} size="lg" />
          <p className="mt-6 text-sm text-slate-500 text-center">
            {activeSpec
              ? activeSpec.readinessScore && activeSpec.readinessScore >= 70
                ? 'Spec is ready to implement.'
                : 'Spec needs more detail before coding.'
              : 'Create a spec to see readiness.'}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            Recent Specs
          </h2>
          <Link href="/specs" className="text-sm font-medium text-slate-600 hover:text-brand-teal hover:underline">
            View All
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allSpecs.slice(0, 3).map(spec => (
            <SpecCard key={spec.id} spec={spec} />
          ))}
        </div>
      </section>
    </div>
  );
}
