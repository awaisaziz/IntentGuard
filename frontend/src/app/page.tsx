import Link from 'next/link';
import { ArrowRight, Activity, ShieldCheck, Layers, Gauge, CheckCircle2, MessageSquare, GitCommit } from 'lucide-react';
import { getActiveSpec, getAllSpecs, getWorkspaces, repoLabel, type Spec } from '@/lib/api';
import IntentFlow from '@/components/intent-flow';
import SpecCard, { statusColors } from '@/components/spec-card';
import ReadinessGauge from '@/components/readiness-gauge';
import RepoConnect from '@/components/repo-connect';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STEP_BY_STATUS = { draft: 2, validated: 2, approved: 3, shipped: 4, verified: 5 } as const;
const STATUSES = ['draft', 'validated', 'approved', 'shipped', 'verified'] as const;
const STATUS_BAR: Record<Spec['status'], string> = {
  draft: 'bg-slate-400',
  validated: 'bg-blue-500',
  approved: 'bg-purple-500',
  shipped: 'bg-amber-500',
  verified: 'bg-emerald-500',
};

export default async function HomePage() {
  const [active, allSpecs, workspaces] = await Promise.all([getActiveSpec(), getAllSpecs(), getWorkspaces()]);
  // The list carries the live readiness score; the active endpoint returns the stored spec
  const activeSpec = active ? (allSpecs.find(s => s.id === active.id) ?? active) : null;
  const score = Math.round(activeSpec?.readinessScore ?? 0);

  const total = allSpecs.length;
  const ready = allSpecs.filter(s => (s.readinessScore ?? 0) >= 70).length;
  const average = total ? Math.round(allSpecs.reduce((sum, s) => sum + (s.readinessScore ?? 0), 0) / total) : 0;
  const delivered = allSpecs.filter(s => s.status === 'shipped' || s.status === 'verified').length;
  const counts = Object.fromEntries(STATUSES.map(status => [status, allSpecs.filter(s => s.status === status).length])) as Record<
    Spec['status'],
    number
  >;

  const stats = [
    { label: 'Specs', value: total, icon: Layers, hint: 'in .intent/specs' },
    { label: 'Ready to code', value: ready, icon: CheckCircle2, hint: 'readiness 70 or more' },
    { label: 'Average readiness', value: `${average}%`, icon: Gauge, hint: 'across all specs' },
    { label: 'Delivered', value: delivered, icon: GitCommit, hint: 'shipped or verified' },
  ];

  return (
    <div className="space-y-8">
      <section className="grid lg:grid-cols-5 gap-6 items-stretch">
        <div className="lg:col-span-2 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">
            {workspaces ? repoLabel(workspaces.current) : 'IntentGuard'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mt-1">Intent dashboard</h1>
          <p className="text-slate-500 mt-2 max-w-xl">
            Every change starts as an IntentSpec, passes a readiness gate, stays inside its scope, and ends with proof.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal hover:bg-brand-dark text-white text-sm font-medium shadow-sm"
            >
              <MessageSquare className="w-4 h-4" /> Start a change
            </Link>
            <Link
              href="/specs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium hover:border-brand-teal"
            >
              <Layers className="w-4 h-4" /> Browse specs
            </Link>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, hint }) => (
            <div key={label} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
                <Icon className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
              <div className="mt-1 text-xs text-slate-500">{hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Where the active change stands</h2>
          <span className="text-xs text-slate-500">Request → Intent → Code → Proof → Commit</span>
        </div>
        <IntentFlow currentStep={activeSpec ? STEP_BY_STATUS[activeSpec.status] : 1} />
      </section>

      <section className="grid lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-teal" />
              Active specification
            </h2>
            {activeSpec && (
              <Link href={`/specs/${activeSpec.id}`} className="text-sm font-medium text-brand-teal hover:underline flex items-center gap-1">
                View details <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {activeSpec ? (
            <div className="flex flex-col sm:flex-row gap-6 flex-1">
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-500">{activeSpec.id}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border capitalize', statusColors[activeSpec.status])}>
                    {activeSpec.status}
                  </span>
                </div>
                <p className="text-base leading-relaxed line-clamp-5">{activeSpec.objective}</p>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ['Outcomes', activeSpec.outcomes?.length ?? 0],
                    ['In-scope rules', activeSpec.scope?.inScope?.length ?? 0],
                    ['Edge cases', activeSpec.edgeCases?.length ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                      <dt className="text-xs text-slate-500">{label}</dt>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 sm:w-48 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-6">
                <ReadinessGauge score={score} size="lg" />
                <div className="text-center">
                  <div className="text-sm font-semibold">Readiness</div>
                  <div className={cn('text-xs', score >= 70 ? 'text-emerald-600' : 'text-red-600')}>
                    {score >= 70 ? 'Passes the gate' : 'Blocked below 70'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-500">
              <p>No active specification in this repository yet.</p>
              <Link href="/chat" className="mt-3 text-sm font-medium text-brand-teal hover:underline">
                Describe a change in Agent Chat to draft one
              </Link>
            </div>
          )}
        </div>

        {workspaces && <RepoConnect state={workspaces} />}
      </section>

      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Progress by status</h2>
        {total > 0 ? (
          <>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              {STATUSES.filter(status => counts[status] > 0).map(status => (
                <div
                  key={status}
                  className={STATUS_BAR[status]}
                  style={{ width: `${(counts[status] / total) * 100}%` }}
                  title={`${counts[status]} ${status}`}
                />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STATUSES.map(status => (
                <li key={status} className="flex items-center gap-2 text-sm">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', STATUS_BAR[status])} />
                  <span className="capitalize text-slate-600 dark:text-slate-400">{status}</span>
                  <span className="ml-auto font-semibold tabular-nums">{counts[status]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-500">Progress appears here once the first spec is drafted.</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            Recent specs
          </h2>
          <Link href="/specs" className="text-sm font-medium text-slate-600 hover:text-brand-teal hover:underline">
            View all {total}
          </Link>
        </div>
        {total > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {allSpecs.slice(0, 4).map(spec => (
              <SpecCard key={spec.id} spec={spec} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No specs yet.</div>
        )}
      </section>
    </div>
  );
}
