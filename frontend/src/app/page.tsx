'use client';

import { useEffect, useState } from 'react';
import { getActiveSpec, getAllSpecs, type Spec } from '@/lib/api';
import Link from 'next/link';
import { ArrowRight, Activity, ShieldCheck, Zap, GitMerge, CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.ceil(value / 20);
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

function StatusBadge({ status }: { status: Spec['status'] }) {
  const map: Record<string, string> = {
    draft:    'text-slate-400 bg-slate-800/80 border-slate-700',
    approved: 'text-purple-400 bg-purple-950/40 border-purple-700/50',
    verified: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50',
    shipped:  'text-amber-400  bg-amber-950/40  border-amber-700/50',
    validated:'text-blue-400   bg-blue-950/40   border-blue-700/50',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded border ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

function ReadinessMini({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 16, c = 2 * Math.PI * r;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="-rotate-90 w-full h-full" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{score}</span>
    </div>
  );
}

export default function HomePage() {
  const [activeSpec, setActiveSpec] = useState<Spec | null>(null);
  const [allSpecs, setAllSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getActiveSpec(), getAllSpecs()])
      .then(([a, all]) => { setActiveSpec(a); setAllSpecs(all); })
      .finally(() => setLoading(false));
  }, []);

  const total    = allSpecs.length;
  const approved = allSpecs.filter(s => s.status === 'approved').length;
  const verified = allSpecs.filter(s => s.status === 'verified').length;
  const drafts   = allSpecs.filter(s => s.status === 'draft').length;
  const recentSpecs = allSpecs.slice(0, 3);

  const currentStep =
    !activeSpec ? 1 :
    activeSpec.status === 'verified' ? 5 :
    activeSpec.status === 'shipped'  ? 4 :
    activeSpec.status === 'approved' ? 3 : 2;

  const STEPS = [
    { id: 1, label: 'Request', icon: Zap },
    { id: 2, label: 'Spec',    icon: Target },
    { id: 3, label: 'Code',    icon: GitMerge },
    { id: 4, label: 'Proof',   icon: CheckCircle2 },
    { id: 5, label: 'Commit',  icon: ShieldCheck },
  ];

  return (
    <div className="space-y-10">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 px-8 py-10"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d1f1e 50%, #0f172a 100%)' }}>
        {/* Glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-teal to-transparent opacity-40" />
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-brand-teal/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-teal">Live Dashboard</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              IntentGuard
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Any agent. Clear intent. Proven changes.</p>
          </div>

          {activeSpec ? (
            <Link href={`/specs/${activeSpec.id}`}
              className="group flex items-center gap-4 px-5 py-3 rounded-xl border border-brand-teal/30 bg-brand-teal/5 hover:bg-brand-teal/10 hover:border-brand-teal/60 transition-all">
              <ReadinessMini score={activeSpec.readinessScore ?? 0} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-brand-teal/70">{activeSpec.id}</span>
                  <StatusBadge status={activeSpec.status} />
                </div>
                <p className="text-sm font-semibold text-white truncate max-w-xs">{activeSpec.objective}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-teal group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          ) : !loading ? (
            <Link href="/specs"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-teal hover:bg-brand-dark text-white text-sm font-bold transition-all shadow-lg shadow-brand-teal/20">
              <Zap className="w-4 h-4" /> Create first spec
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Specs',  value: total,    icon: Target,      color: 'text-slate-300' },
          { label: 'Draft',        value: drafts,   icon: Clock,       color: 'text-slate-400' },
          { label: 'Approved',     value: approved, icon: ShieldCheck, color: 'text-purple-400' },
          { label: 'Verified',     value: verified, icon: CheckCircle2,color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label}
            className="relative overflow-hidden p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl bg-slate-800/80 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-3xl font-black tracking-tight ${color}`}>
                {loading ? '—' : <AnimatedNumber value={value} />}
              </div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Pipeline tracker ── */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Pipeline</h2>
        </div>
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isPast    = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    isCurrent ? 'bg-brand-teal border-brand-teal text-white shadow-lg shadow-brand-teal/30 scale-110' :
                    isPast    ? 'bg-slate-700 border-slate-600 text-slate-300' :
                                'bg-slate-800/80 border-slate-700 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-brand-teal' : 'text-slate-600'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 mb-5 rounded-full transition-all duration-500 ${
                    step.id < currentStep ? 'bg-brand-teal/50' : 'bg-slate-800'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Active spec + recent ── */}
      <section className="grid md:grid-cols-3 gap-6">
        {/* Active spec detail */}
        <div className="md:col-span-2 p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-teal" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Active Spec</h2>
            </div>
            {activeSpec && (
              <Link href={`/specs/${activeSpec.id}`}
                className="text-xs font-bold text-slate-400 hover:text-brand-teal flex items-center gap-1 transition-colors">
                View <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-slate-600 text-sm">Loading…</div>
          ) : activeSpec ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-500">{activeSpec.id}</span>
                  <StatusBadge status={activeSpec.status} />
                </div>
                <h3 className="text-lg font-semibold text-white leading-snug">{activeSpec.objective}</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Outcomes',    val: activeSpec.outcomes?.length ?? 0 },
                  { label: 'Edge Cases',  val: activeSpec.edgeCases?.length ?? 0 },
                  { label: 'Constraints', val: activeSpec.constraints?.length ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-2xl font-black text-white">{val}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center gap-3 text-slate-600">
              <Zap className="w-8 h-8 text-slate-700" />
              <span className="text-sm">No active spec —{' '}
                <Link href="/specs" className="text-brand-teal hover:underline">create one</Link>
              </span>
            </div>
          )}
        </div>

        {/* Readiness gauge */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 w-full">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Readiness</h2>
          </div>
          {activeSpec ? (
            <>
              <ReadinessMini score={activeSpec.readinessScore ?? 0} />
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    (activeSpec.readinessScore ?? 0) >= 70 ? 'bg-emerald-500' :
                    (activeSpec.readinessScore ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${activeSpec.readinessScore ?? 0}%` }}
                />
              </div>
              <p className={`text-xs text-center font-semibold ${
                (activeSpec.readinessScore ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {(activeSpec.readinessScore ?? 0) >= 70 ? '✓ Ready to implement' : 'Needs more detail'}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600 text-center">Create a spec to see readiness.</p>
          )}
        </div>
      </section>

      {/* ── Recent specs ── */}
      {recentSpecs.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Recent Specs</h2>
            </div>
            <Link href="/specs" className="text-xs font-bold text-slate-500 hover:text-brand-teal transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentSpecs.map(spec => (
              <Link key={spec.id} href={`/specs/${spec.id}`} className="group block">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-brand-teal/50 hover:bg-slate-800/60 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-slate-500">{spec.id}</span>
                    <StatusBadge status={spec.status} />
                  </div>
                  <p className="text-sm font-medium text-slate-200 line-clamp-2">{spec.objective}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                    <span>{spec.outcomes?.length ?? 0} outcomes</span>
                    <span>·</span>
                    <span>{spec.readinessScore ?? 0}% ready</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
