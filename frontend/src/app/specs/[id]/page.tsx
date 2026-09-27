'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSpecById, activateSpec, getSpecQuestions, getSpecReadiness, updateSpecAnswers,
  type Spec, type SpecQuestion,
} from '@/lib/api';
import ScopeTree from '@/components/scope-tree';
import EvidencePanel from '@/components/evidence-panel';
import Link from 'next/link';
import { use } from 'react';
import {
  ArrowLeft, Target, ShieldAlert, CheckCircle2, ShieldCheck, Activity,
  AlertTriangle, FileCheck2, Zap, Loader2, Star, HelpCircle,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';

// ─── Question wizard (same logic as specs/page.tsx, embedded inline) ─────────

const SECTION_TO_FIELD: Record<string, string> = {
  objective: 'objective', outcomes: 'outcomes', scope: 'inScope',
  edgeCases: 'edgeCases', verification: 'verification',
  constraints: 'constraints', healthMetrics: 'healthMetrics', evidence: 'evidence',
};

const SEVERITY_RING: Record<SpecQuestion['severity'], string> = {
  critical:       'border-red-500/60 bg-red-950/20',
  important:      'border-amber-500/50 bg-amber-950/10',
  'nice-to-have': 'border-slate-600 bg-slate-800/30',
};
const SEVERITY_LABEL: Record<SpecQuestion['severity'], string> = {
  critical:       'text-red-400 bg-red-950/40 border-red-500/40',
  important:      'text-amber-400 bg-amber-950/40 border-amber-500/40',
  'nice-to-have': 'text-slate-400 bg-slate-800 border-slate-700',
};

function buildPayload(questions: SpecQuestion[], answers: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const listFields = new Set(['outcomes', 'verification', 'constraints', 'healthMetrics', 'inScope', 'outOfScope']);
  for (const q of questions) {
    const answer = answers[q.id]?.trim();
    if (!answer) continue;
    const field = SECTION_TO_FIELD[q.section] ?? q.section;
    if (listFields.has(field)) {
      const lines = answer.split('\n').map(l => l.trim()).filter(Boolean);
      payload[field] = [...((payload[field] as string[] | undefined) ?? []), ...lines];
    } else if (field === 'edgeCases') {
      const cases = answer.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
        const sep = line.indexOf(':');
        return sep > 0
          ? { scenario: line.slice(0, sep).trim(), expectedBehavior: line.slice(sep + 1).trim() }
          : { scenario: line, expectedBehavior: 'TBD' };
      });
      payload.edgeCases = [...((payload.edgeCases as unknown[]) ?? []), ...cases];
    } else {
      payload[field] = answer;
    }
  }
  return payload;
}

function InlineQuestionsWizard({
  specId,
  initialQuestions,
  onDone,
}: {
  specId: string;
  initialQuestions: SpecQuestion[];
  onDone: () => void;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(initialQuestions.map(q => [q.id, '']))
  );
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (expanded) textareaRef.current?.focus(); }, [current, expanded]);

  const q = questions[current];
  const total = questions.length;
  const progress = (current / total) * 100;

  const go = (dir: 1 | -1) => setCurrent(c => Math.max(0, Math.min(total - 1, c + dir)));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(questions, answers);
      if (Object.keys(payload).length === 0) { onDone(); return; }
      await updateSpecAnswers(specId, payload);

      setChecking(true);
      const readiness = await getSpecReadiness(specId);
      setScore(readiness?.score ?? null);

      if (readiness?.ready) {
        setTimeout(onDone, 900);
        return;
      }

      const remaining = await getSpecQuestions(specId);
      if (remaining.length === 0) { setTimeout(onDone, 900); return; }

      setRound(r => r + 1);
      setQuestions(remaining);
      setAnswers(Object.fromEntries(remaining.map(rq => [rq.id, ''])));
      setCurrent(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setChecking(false);
    }
  };

  if (!q) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-slate-900/80 overflow-hidden">
      {/* Banner header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-amber-400">
            {total} clarification question{total > 1 ? 's' : ''} remaining
            <span className="ml-2 text-xs font-normal text-slate-400">— Round {round} · answer to advance to Approved</span>
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Wizard body */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-800 space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">{current + 1} / {total}</span>
          </div>

          {/* Readiness badge after first submit */}
          {score !== null && (
            <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-xs font-semibold ${
              score >= 70
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                : 'border-amber-500/40 bg-amber-950/20 text-amber-400'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Readiness: {score}/100
              {score < 70 && <span className="text-slate-400 font-normal ml-1">— a few more to go</span>}
            </div>
          )}

          {/* Question card */}
          <div className={`rounded-xl border p-4 ${SEVERITY_RING[q.severity]}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${SEVERITY_LABEL[q.severity]}`}>
                {q.severity}
              </span>
            </div>
            <p className="text-sm font-semibold text-white leading-snug mb-1">{q.question}</p>
            {q.context && <p className="text-xs text-slate-400 italic mb-2">{q.context}</p>}
            <textarea
              ref={textareaRef}
              value={answers[q.id] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              rows={3}
              placeholder="Your answer…"
              className="w-full p-3 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 resize-none mt-2"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/20 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => go(-1)} disabled={current === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-700/50 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              {current < total - 1 && (
                <button onClick={() => go(1)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/60 transition-colors">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {current === total - 1 && (
              <button onClick={handleSubmit} disabled={submitting || checking}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold disabled:opacity-50 transition-all shadow-sm">
                {submitting || checking
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                {checking ? 'Checking…' : submitting ? 'Saving…' : 'Submit Answers'}
              </button>
            )}

            {/* Dot indicators */}
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-4 bg-amber-400' : answers[questions[i].id]?.trim() ? 'w-1.5 bg-emerald-500/60' : 'w-1.5 bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spec detail page ─────────────────────────────────────────────────────────

export default function SpecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<SpecQuestion[]>([]);

  const refresh = useCallback(() => {
    getSpecById(id).then(s => {
      if (!s) setNotFound(true);
      else setSpec(s);
    });
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!spec) return;
    if (spec.status !== 'draft') { setPendingQuestions([]); return; }
    getSpecQuestions(spec.id).then(setPendingQuestions).catch(() => {});
  }, [spec]);

  const handleAnswersDone = useCallback(() => {
    // Re-fetch spec + questions after submission so status badge + banner update
    refresh();
    setPendingQuestions([]);
  }, [refresh]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await activateSpec(spec!.id);
      setActivated(true);
    } finally {
      setActivating(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors">
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </Link>
        <button
          onClick={handleActivate}
          disabled={activating || activated || spec.active}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-brand-teal hover:bg-brand-dark text-white disabled:opacity-50 transition-all shadow-sm shadow-brand-teal/20"
          title={spec.active ? 'Already the active spec' : 'Set as active spec for the agent'}
        >
          {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
          {spec.active || activated ? 'Active' : 'Set Active'}
        </button>
      </div>

      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full border border-brand-teal/20">{spec.id}</span>
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
            spec.status === 'approved' ? 'text-purple-400 bg-purple-950/40 border-purple-700/50' :
            spec.status === 'verified' ? 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50' :
            'text-slate-400 bg-slate-800/80 border-slate-700'
          }`}>{spec.status}</span>
          {(spec.active || activated) && (
            <span className="text-xs font-bold px-2 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-700/50 rounded-full">Active</span>
          )}
        </div>
        <h1 className="text-3xl font-black text-white leading-tight">{spec.objective}</h1>
        {spec.userGoal && <p className="text-slate-400">{spec.userGoal}</p>}
      </header>

      {/* ── Inline questions wizard ── */}
      {pendingQuestions.length > 0 && (
        <InlineQuestionsWizard
          specId={spec.id}
          initialQuestions={pendingQuestions}
          onDone={handleAnswersDone}
        />
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={`/specs/${spec.id}/readiness`}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-brand-teal/50 transition-all flex items-center gap-3">
          <div className="p-2 bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-700/30"><ShieldCheck className="w-5 h-5" /></div>
          <div className="font-semibold text-slate-200">Gate Audit</div>
        </Link>
        <Link href={`/specs/${spec.id}/report`}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-brand-teal/50 transition-all flex items-center gap-3">
          <div className="p-2 bg-blue-950/40 text-blue-400 rounded-lg border border-blue-700/30"><Activity className="w-5 h-5" /></div>
          <div className="font-semibold text-slate-200">Proof Report</div>
        </Link>
      </div>

      {/* Content sections */}
      <div className="space-y-10">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
            <Target className="w-4 h-4 text-brand-teal" /> Measurable Outcomes
          </h2>
          {spec.outcomes.length > 0 ? (
            <ul className="space-y-3">
              {spec.outcomes.map((outcome, i) => (
                <li key={i} className="flex items-start gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-slate-200 text-sm">{outcome}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm italic">No outcomes defined yet.</p>
          )}
        </section>

        {spec.constraints && spec.constraints.length > 0 && (
          <section>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> Constraints
            </h2>
            <ul className="space-y-2">
              {spec.constraints.map((c, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg text-sm text-slate-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {spec.edgeCases && spec.edgeCases.length > 0 && (
          <section>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
              <Zap className="w-4 h-4 text-purple-400" /> Edge Cases
            </h2>
            <div className="space-y-3">
              {spec.edgeCases.map((ec, i) => (
                <div key={i} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="font-semibold text-sm text-white mb-1">{ec.scenario}</div>
                  <div className="text-sm text-slate-400">{ec.expectedBehavior}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {spec.verification && spec.verification.length > 0 && (
          <section>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
              <FileCheck2 className="w-4 h-4 text-blue-400" /> Verification Steps
            </h2>
            <ul className="space-y-2">
              {spec.verification.map((v, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg text-sm text-slate-200">
                  <FileCheck2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> {v}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
            <ShieldAlert className="w-4 h-4 text-brand-teal" /> Scope Fence
          </h2>
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl">
            <ScopeTree inScope={spec.scope?.inScope} outOfScope={spec.scope?.outOfScope} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 text-white">
            Evidence Board
          </h2>
          <EvidencePanel evidence={spec.evidence || []} />
        </section>
      </div>
    </div>
  );
}
