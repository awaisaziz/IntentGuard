import { getSpecById, getReadiness, getProofReport } from '@/lib/api';
import ScopeTree from '@/components/scope-tree';
import EvidencePanel from '@/components/evidence-panel';
import ReadinessGauge from '@/components/readiness-gauge';
import { statusColors } from '@/components/spec-card';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Target,
  ShieldAlert,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Lock,
  AlertTriangle,
  HeartPulse,
  ClipboardCheck,
  FileSearch,
  MessageSquareQuote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Section({ icon: Icon, title, count, children }: { icon: typeof Target; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-brand-teal" /> {title}
        {count !== undefined && <span className="ml-auto text-xs font-semibold text-slate-400 tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function List({ items, icon: Icon, tone, empty }: { items?: string[]; icon: typeof Target; tone: string; empty: string }) {
  if (!items?.length) return <p className="text-sm text-slate-500 italic">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', tone)} />
          <span className="text-slate-800 dark:text-slate-200">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function SpecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spec, readiness, report] = await Promise.all([getSpecById(id), getReadiness(id), getProofReport(id)]);

  if (!spec) {
    notFound();
  }
  const score = Math.round(readiness?.score ?? 0);

  return (
    <div className="space-y-6">
      <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Specs
      </Link>

      <header className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 md:items-center">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full">{spec.id}</span>
            <span className={cn('text-xs font-semibold capitalize px-3 py-1 rounded-full border', statusColors[spec.status])}>{spec.status}</span>
            {spec.problemSeverity && <span className="text-xs text-slate-500 capitalize">{spec.problemSeverity} severity</span>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug">{spec.objective}</h1>
          {spec.userGoal && (
            <p className="text-sm text-slate-500">
              <span className="font-semibold">User goal:</span> {spec.userGoal}
            </p>
          )}
          {spec.rawRequest && spec.rawRequest !== spec.objective && (
            <p className="text-sm text-slate-500 flex items-start gap-2">
              <MessageSquareQuote className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="italic line-clamp-3">&ldquo;{spec.rawRequest}&rdquo;</span>
            </p>
          )}
        </div>
        <div className="flex md:flex-col items-center gap-4 shrink-0">
          <ReadinessGauge score={score} size="md" />
          <div className="flex md:flex-col gap-2">
            <Link
              href={`/specs/${spec.id}/readiness`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-medium hover:border-brand-teal"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Gate audit
            </Link>
            <Link
              href={`/specs/${spec.id}/report`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-medium hover:border-brand-teal"
            >
              <Activity className="w-4 h-4 text-blue-600" /> {report ? (report.commitReady ? 'Proof: passed' : 'Proof: blocked') : 'Proof report'}
            </Link>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section icon={Target} title="Outcomes" count={spec.outcomes?.length ?? 0}>
          <List items={spec.outcomes} icon={CheckCircle2} tone="text-emerald-500" empty="No measurable outcomes defined." />
        </Section>

        <Section icon={Lock} title="Constraints" count={spec.constraints?.length ?? 0}>
          <List items={spec.constraints} icon={Lock} tone="text-slate-400" empty="No constraints defined." />
        </Section>
      </div>

      <Section icon={ShieldAlert} title="Scope fence">
        <ScopeTree inScope={spec.scope?.inScope} outOfScope={spec.scope?.outOfScope} />
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section icon={AlertTriangle} title="Edge cases" count={spec.edgeCases?.length ?? 0}>
          {spec.edgeCases?.length ? (
            <ul className="space-y-3">
              {spec.edgeCases.map((edge, i) => (
                <li key={edge.id ?? i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm">
                  <div className="font-medium text-slate-800 dark:text-slate-200">{edge.scenario}</div>
                  <div className="mt-1 text-slate-500">{edge.expectedBehavior}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic">No edge cases defined.</p>
          )}
        </Section>

        <div className="space-y-6">
          <Section icon={HeartPulse} title="Health metrics" count={spec.healthMetrics?.length ?? 0}>
            <List items={spec.healthMetrics} icon={HeartPulse} tone="text-rose-400" empty="No health metrics defined." />
          </Section>
          <Section icon={ClipboardCheck} title="Verification" count={spec.verification?.length ?? 0}>
            <List items={spec.verification} icon={ClipboardCheck} tone="text-blue-500" empty="No verification steps defined." />
          </Section>
        </div>
      </div>

      <Section icon={FileSearch} title="Evidence" count={spec.evidence?.length ?? 0}>
        <EvidencePanel evidence={spec.evidence || []} />
      </Section>
    </div>
  );
}
