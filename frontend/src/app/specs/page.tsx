'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAllSpecs, createSpec, getSpecQuestions, getSpecReadiness, updateSpecAnswers, deleteSpec,
  type Spec, type SpecQuestion,
} from '@/lib/api';
import SpecCard from '@/components/spec-card';
import {
  Search, Plus, Loader2, X, ChevronRight, ChevronLeft,
  CheckCircle2, AlertCircle, Zap, ShieldCheck, Trash2,
} from 'lucide-react';

const STATUS_FILTERS = ['all', 'draft', 'approved', 'verified'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Maps a question's section to the PATCH field key */
const SECTION_TO_FIELD: Record<string, string> = {
  objective: 'objective',
  outcomes: 'outcomes',
  scope: 'inScope',
  edgeCases: 'edgeCases',
  verification: 'verification',
  constraints: 'constraints',
  healthMetrics: 'healthMetrics',
  evidence: 'evidence',
};

const SEVERITY_RING: Record<SpecQuestion['severity'], string> = {
  critical:      'border-red-500/60 bg-red-950/20',
  important:     'border-amber-500/50 bg-amber-950/10',
  'nice-to-have':'border-slate-600 bg-slate-800/30',
};
const SEVERITY_LABEL: Record<SpecQuestion['severity'], string> = {
  critical:      'text-red-400 bg-red-950/40 border-red-500/40',
  important:     'text-amber-400 bg-amber-950/40 border-amber-500/40',
  'nice-to-have':'text-slate-400 bg-slate-800 border-slate-700',
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

// ─── Sequential wizard with readiness loop ───────────────────────────────────

function QuestionsWizard({
  specId,
  initialQuestions,
  onDone,
  onSkip,
}: {
  specId: string;
  initialQuestions: SpecQuestion[];
  onDone: () => void;
  onSkip: () => void;
}) {
  const [questions, setQuestions] = useState<SpecQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(initialQuestions.map(q => [q.id, '']))
  );
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // focus the textarea whenever the current question changes
  useEffect(() => { textareaRef.current?.focus(); }, [current]);

  const q = questions[current];
  const total = questions.length;
  const progress = (current / total) * 100;
  const answered = answers[q?.id ?? '']?.trim() !== '';

  const go = (dir: 1 | -1) => setCurrent(c => Math.max(0, Math.min(total - 1, c + dir)));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(questions, answers);
      if (Object.keys(payload).length === 0) { onDone(); return; }
      await updateSpecAnswers(specId, payload);

      // Readiness re-check loop
      setChecking(true);
      const readiness = await getSpecReadiness(specId);
      setScore(readiness?.score ?? null);

      if (readiness?.ready) {
        // ✅ gate passed — done
        setTimeout(onDone, 800);
        return;
      }

      // Still not ready — fetch remaining questions for next round
      const remaining = await getSpecQuestions(specId);
      if (remaining.length === 0) { setTimeout(onDone, 800); return; }

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
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-brand-teal" />
            <span className="text-xs font-bold uppercase tracking-widest text-brand-teal">
              Clarify Spec · Round {round}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            Question {current + 1} <span className="text-slate-500">/ {total}</span>
          </h2>
        </div>
        <button onClick={onSkip} className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-brand-teal rounded-full transition-all duration-500"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      {/* Readiness score (after first submit) */}
      {score !== null && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg border flex items-center gap-3 text-sm font-medium transition-all ${
          score >= 70
            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
            : 'border-amber-500/40 bg-amber-950/20 text-amber-400'
        }`}>
          <ShieldCheck className="w-4 h-4 shrink-0" />
          Readiness score: {score}/100
          {score < 70 && <span className="text-slate-400 font-normal ml-1">— a few more questions to go</span>}
        </div>
      )}

      {/* Question card */}
      <div
        key={q.id}
        className={`rounded-xl border p-4 mb-4 transition-all ${SEVERITY_RING[q.severity]}`}
      >
        <div className="flex items-start gap-2 mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${SEVERITY_LABEL[q.severity]}`}>
            {q.severity}
          </span>
        </div>
        <p className="text-base font-semibold text-white leading-snug mb-2">{q.question}</p>
        {q.context && (
          <p className="text-xs text-slate-400 italic mb-3">{q.context}</p>
        )}
        <textarea
          ref={textareaRef}
          value={answers[q.id] ?? ''}
          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
          rows={3}
          placeholder="Your answer…"
          className="w-full p-3 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
        />
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/20 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-700/50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {current < total - 1 ? (
            <button
              onClick={() => go(1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/60 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {current === total - 1 && (
          <button
            onClick={handleSubmit}
            disabled={submitting || checking}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-brand-teal hover:bg-brand-dark text-white font-bold disabled:opacity-50 transition-all shadow-lg shadow-brand-teal/20"
          >
            {submitting || checking
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
            {checking ? 'Checking readiness…' : submitting ? 'Saving…' : 'Submit Answers'}
          </button>
        )}

        <button
          onClick={onSkip}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
        >
          Skip for now
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-4">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? 'w-5 bg-brand-teal' : answers[questions[i].id]?.trim() ? 'w-1.5 bg-emerald-500/60' : 'w-1.5 bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── New Spec Modal ───────────────────────────────────────────────────────────

function NewSpecModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spec: Spec) => void;
}) {
  const router = useRouter();
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSpec, setCreatedSpec] = useState<Spec | null>(null);
  const [questions, setQuestions] = useState<SpecQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = request.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const spec = await createSpec(text);
      setLoadingQuestions(true);
      setCreatedSpec(spec);
      try {
        const qs = await getSpecQuestions(spec.id);
        onCreated(spec);
        if (qs.length === 0) {
          onClose();
          router.push(`/specs/${spec.id}`);
          return;
        }
        setQuestions(qs);
      } catch {
        onCreated(spec);
        onClose();
        router.push(`/specs/${spec.id}`);
      } finally {
        setLoadingQuestions(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (createdSpec) router.push(`/specs/${createdSpec.id}`);
    onClose();
  };

  // Step 2 — wizard
  if (createdSpec && questions.length > 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) handleDone(); }}
      >
        <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-xl p-6 mx-4"
          style={{ boxShadow: '0 0 60px rgba(0,190,170,0.08), 0 25px 50px rgba(0,0,0,0.5)' }}>
          {/* Glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-brand-teal to-transparent opacity-60" />
          <QuestionsWizard
            specId={createdSpec.id}
            initialQuestions={questions}
            onDone={handleDone}
            onSkip={handleDone}
          />
        </div>
      </div>
    );
  }

  // Loading questions
  if (loadingQuestions) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-10 flex flex-col items-center gap-4"
          style={{ boxShadow: '0 0 60px rgba(0,190,170,0.08)' }}>
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-brand-teal/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
            </div>
            <div className="absolute inset-0 rounded-full animate-ping border border-brand-teal/20" />
          </div>
          <p className="text-slate-300 text-sm font-medium">Analysing your request…</p>
          <p className="text-slate-500 text-xs text-center">Gathering evidence and generating clarification questions</p>
        </div>
      </div>
    );
  }

  // Step 1 — request form
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 space-y-5"
        style={{ boxShadow: '0 0 60px rgba(0,190,170,0.08), 0 25px 50px rgba(0,0,0,0.5)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-brand-teal to-transparent opacity-60" />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap className="w-4 h-4 text-brand-teal" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-teal">New Intent Spec</span>
            </div>
            <h2 className="text-xl font-bold text-white">What are you building?</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-400">
          Describe the change as vague as a real ticket — IntentGuard will draft the full spec, gather evidence, and ask clarifying questions.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <textarea
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder='"improve the booking flow" or "add rate limiting to the API"'
            rows={4}
            className="w-full p-3 rounded-xl border border-slate-600 bg-slate-800/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none transition-all"
            autoFocus
          />
          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/20 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-700/60 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !request.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-brand-teal hover:bg-brand-dark text-white font-bold disabled:opacity-40 transition-all shadow-lg shadow-brand-teal/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Drafting…' : 'Create Spec'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Specs page ───────────────────────────────────────────────────────────────

export default function SpecsPage() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSpecs(await getAllSpecs()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (spec: Spec) => {
    setSpecs(prev => [spec, ...prev]);
  };

  const handleDeleted = (id: string) => {
    setSpecs(prev => prev.filter(s => s.id !== id));
  };

  const [clearingDrafts, setClearingDrafts] = useState(false);
  const handleClearDrafts = async () => {
    const drafts = specs.filter(s => s.status === 'draft');
    if (drafts.length === 0) return;
    if (!window.confirm(`Delete all ${drafts.length} draft spec${drafts.length > 1 ? 's' : ''}?\n\nThis cannot be undone.`)) return;
    setClearingDrafts(true);
    const results = await Promise.allSettled(drafts.map(s => deleteSpec(s.id)));
    const deleted = drafts.filter((_, i) => results[i].status === 'fulfilled').map(s => s.id);
    setSpecs(prev => prev.filter(s => !deleted.includes(s.id)));
    setClearingDrafts(false);
  };

  const filtered = specs.filter(spec => {
    const matchesStatus = statusFilter === 'all' || spec.status === statusFilter;
    const q = search.toLowerCase();
    return matchesStatus && (!q || spec.id.toLowerCase().includes(q) || spec.objective.toLowerCase().includes(q));
  });

  const counts = {
    all: specs.length,
    draft: specs.filter(s => s.status === 'draft').length,
    approved: specs.filter(s => s.status === 'approved').length,
    verified: specs.filter(s => s.status === 'verified').length,
  };

  return (
    <>
      {showModal && <NewSpecModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Intent Specifications</h1>
            <p className="text-slate-400 mt-1">Every change, tracked from intent to proof.</p>
          </div>
          <div className="flex items-center gap-3">
            {counts.draft > 0 && (
              <button
                onClick={handleClearDrafts}
                disabled={clearingDrafts}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 text-sm font-bold hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 transition-all"
              >
                {clearingDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear {counts.draft} draft{counts.draft > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-brand-teal hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-teal/20 hover:shadow-brand-teal/30"
            >
              <Plus className="w-4 h-4" /> New Spec
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or objective…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </div>
          <div className="flex gap-2">
            {STATUS_FILTERS.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  statusFilter === status
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm shadow-brand-teal/20'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {status} {counts[status] > 0 && <span className="ml-1 opacity-60">{counts[status]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
            <span className="text-sm">Loading specs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            {specs.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-7 h-7 text-brand-teal" />
                </div>
                <p className="text-white font-bold text-lg">No specs yet</p>
                <p className="text-slate-400 text-sm">Click <strong className="text-brand-teal">New Spec</strong> to capture your first intent.</p>
              </>
            ) : (
              <p className="text-slate-400">No specs match your search or filter.</p>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(spec => (
              <SpecCard key={spec.id} spec={spec} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
