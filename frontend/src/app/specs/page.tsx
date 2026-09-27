'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAllSpecs, createSpec, getSpecQuestions, updateSpecAnswers, type Spec, type SpecQuestion } from '@/lib/api';
import SpecCard from '@/components/spec-card';
import { Search, Plus, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';

const STATUS_FILTERS = ['all', 'draft', 'approved', 'verified'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Maps a question's section to the field key(s) sent to PATCH /specs/:id */
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

const SEVERITY_COLOR: Record<SpecQuestion['severity'], string> = {
  critical: 'text-red-500 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
  important: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
  'nice-to-have': 'text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700',
};

function QuestionsStep({
  specId,
  questions,
  onDone,
  onClose,
}: {
  specId: string;
  questions: SpecQuestion[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map(q => [q.id, '']))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyAnswer = Object.values(answers).some(v => v.trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Build the patch payload: group answers by their spec field
    const payload: Record<string, unknown> = {};
    for (const q of questions) {
      const answer = answers[q.id]?.trim();
      if (!answer) continue;
      const field = SECTION_TO_FIELD[q.section] ?? q.section;
      // outcomes, verification, constraints, healthMetrics, inScope → string arrays (split by newline)
      const listFields = new Set(['outcomes', 'verification', 'constraints', 'healthMetrics', 'inScope', 'outOfScope']);
      if (listFields.has(field)) {
        const lines = answer.split('\n').map(l => l.trim()).filter(Boolean);
        const existing = (payload[field] as string[] | undefined) ?? [];
        payload[field] = [...existing, ...lines];
      } else if (field === 'edgeCases') {
        // Parse "scenario: expected" lines or treat entire answer as one edge case
        const cases = answer.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
          const sep = line.indexOf(':');
          if (sep > 0) return { scenario: line.slice(0, sep).trim(), expectedBehavior: line.slice(sep + 1).trim() };
          return { scenario: line, expectedBehavior: 'TBD' };
        });
        payload.edgeCases = [...((payload.edgeCases as unknown[]) ?? []), ...cases];
      } else {
        payload[field] = answer;
      }
    }
    try {
      await updateSpecAnswers(specId, payload);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Clarify Your Spec</h2>
          <p className="text-sm text-slate-500 mt-0.5">Answer these questions to move the spec from Draft → Approved.</p>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {questions.map(q => (
          <div key={q.id} className={`rounded-lg border p-3 space-y-2 ${SEVERITY_COLOR[q.severity]}`}>
            <div className="flex items-start gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 ${q.severity === 'critical' ? 'text-red-500' : q.severity === 'important' ? 'text-amber-600' : 'text-slate-400'}`}>
                {q.severity}
              </span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{q.question}</p>
            </div>
            {q.context && (
              <p className="text-xs text-slate-500 italic pl-0.5">{q.context}</p>
            )}
            <textarea
              value={answers[q.id]}
              onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              rows={2}
              placeholder="Your answer…"
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex justify-between items-center pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
          Skip for now
        </button>
        <button
          type="submit"
          disabled={submitting || !hasAnyAnswer}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-teal hover:bg-brand-dark text-white font-medium disabled:opacity-50 transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {submitting ? 'Submitting…' : 'Submit Answers'}
        </button>
      </div>
    </form>
  );
}

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
  // Step 2: questions
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
      // Don't call onCreated yet — that would close the modal before step 2 renders.
      // Fetch questions first, then decide.
      setLoadingQuestions(true);
      setCreatedSpec(spec);
      try {
        const qs = await getSpecQuestions(spec.id);
        if (qs.length === 0) {
          // No questions — add to list, close modal, navigate
          onCreated(spec);
          onClose();
          router.push(`/specs/${spec.id}`);
          return;
        }
        // Have questions: update the spec list in the background, stay open for step 2
        onCreated(spec);
        setQuestions(qs);
      } catch {
        // Questions fetch failed — still register the spec and navigate
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

  const handleQuestionsClose = () => {
    onClose();
  };

  const handleAnswersDone = () => {
    if (createdSpec) router.push(`/specs/${createdSpec.id}`);
    onClose();
  };

  // Step 2: show questions
  if (createdSpec && questions.length > 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) handleQuestionsClose(); }}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-6">
          <QuestionsStep
            specId={createdSpec.id}
            questions={questions}
            onDone={handleAnswersDone}
            onClose={handleQuestionsClose}
          />
        </div>
      </div>
    );
  }

  // Loading questions transition
  if (loadingQuestions) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
          <p className="text-slate-500 text-sm">Generating clarification questions…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">New Intent Spec</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Describe the change you want to make — as vague as a real ticket. IntentGuard will draft the spec.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <textarea
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder='e.g. "improve the booking flow" or "add dark mode support"'
            rows={4}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !request.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-teal hover:bg-brand-dark text-white font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'Creating…' : 'Create Spec'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SpecsPage() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSpecs();
      setSpecs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (spec: Spec) => {
    // Only add to the list — the modal controls its own closing (step 2 may still be open)
    setSpecs(prev => [spec, ...prev]);
  };

  const filtered = specs.filter(spec => {
    const matchesStatus = statusFilter === 'all' || spec.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || spec.id.toLowerCase().includes(q) || spec.objective.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <>
      {showModal && <NewSpecModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Intent Specifications</h1>
            <p className="text-slate-500 mt-1">Manage and track all your project specs.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-teal hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Spec
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search specs by ID or objective..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {STATUS_FILTERS.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize border transition-colors ${
                  statusFilter === status
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading specs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {specs.length === 0 ? (
              <>
                <p className="font-medium">No specs yet.</p>
                <p className="text-sm mt-1">Click <strong>New Spec</strong> to create your first IntentSpec.</p>
              </>
            ) : (
              <p>No specs match your search or filter.</p>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(spec => (
              <SpecCard key={spec.id} spec={spec} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
