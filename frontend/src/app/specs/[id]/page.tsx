'use client';

import { useEffect, useState } from 'react';
import { getSpecById, activateSpec, getSpecQuestions, type Spec, type SpecQuestion } from '@/lib/api';
import ScopeTree from '@/components/scope-tree';
import EvidencePanel from '@/components/evidence-panel';
import Link from 'next/link';
import { use } from 'react';
import { ArrowLeft, Target, ShieldAlert, CheckCircle2, ShieldCheck, Activity, AlertTriangle, FileCheck2, Zap, Loader2, Star, HelpCircle } from 'lucide-react';

export default function SpecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<SpecQuestion[]>([]);

  useEffect(() => {
    getSpecById(id).then(s => {
      if (!s) setNotFound(true);
      else setSpec(s);
    });
  }, [id]);

  useEffect(() => {
    if (!spec) return;
    if (spec.status !== 'draft') { setPendingQuestions([]); return; }
    getSpecQuestions(spec.id).then(setPendingQuestions).catch(() => {});
  }, [spec]);

  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </Link>
        <p className="text-slate-500">Spec not found.</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const handleActivate = async () => {
    setActivating(true);
    try {
      await activateSpec(spec.id);
      setActivated(true);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </Link>
        <button
          onClick={handleActivate}
          disabled={activating || activated || spec.active}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-teal hover:bg-brand-dark text-white disabled:opacity-50 transition-colors"
          title={spec.active ? 'Already the active spec' : 'Set as active spec for the agent'}
        >
          {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
          {spec.active || activated ? 'Active' : 'Set Active'}
        </button>
      </div>

      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full">{spec.id}</span>
          <span className="text-sm font-medium capitalize px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{spec.status}</span>
          {(spec.active || activated) && (
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full">Active</span>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight">{spec.objective}</h1>
        {spec.userGoal && <p className="text-slate-500">{spec.userGoal}</p>}
      </header>

      {pendingQuestions.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {pendingQuestions.length} clarification question{pendingQuestions.length > 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              This spec is in Draft because the readiness gate hasn't passed yet. Answer the questions below to advance it to Approved.
            </p>
            <ul className="mt-2 space-y-1">
              {pendingQuestions.map(q => (
                <li key={q.id} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <span className={`font-semibold uppercase shrink-0 ${q.severity === 'critical' ? 'text-red-500' : 'text-amber-600'}`}>[{q.severity}]</span>
                  <span>{q.question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <Link href={`/specs/${spec.id}/readiness`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-teal transition-all flex items-center gap-3 group">
          <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
          <div className="font-medium">Gate Audit</div>
        </Link>
        <Link href={`/specs/${spec.id}/report`} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-teal transition-all flex items-center gap-3 group">
          <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/40 rounded-lg"><Activity className="w-5 h-5" /></div>
          <div className="font-medium">Proof Report</div>
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

        {spec.constraints && spec.constraints.length > 0 && (
          <section>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Constraints
            </h2>
            <ul className="space-y-2">
              {spec.constraints.map((c, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg text-sm text-slate-800 dark:text-slate-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {spec.edgeCases && spec.edgeCases.length > 0 && (
          <section>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <Zap className="w-5 h-5 text-purple-500" /> Edge Cases
            </h2>
            <div className="space-y-3">
              {spec.edgeCases.map((ec, i) => (
                <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="font-medium text-sm mb-1">{ec.scenario}</div>
                  <div className="text-sm text-slate-500">{ec.expectedBehavior}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {spec.verification && spec.verification.length > 0 && (
          <section>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <FileCheck2 className="w-5 h-5 text-blue-500" /> Verification Steps
            </h2>
            <ul className="space-y-2">
              {spec.verification.map((v, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg text-sm text-slate-800 dark:text-slate-200">
                  <FileCheck2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  {v}
                </li>
              ))}
            </ul>
          </section>
        )}

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
