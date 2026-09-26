import type { IntentSpec, Question } from '../schema/intentspec.js';

const SEVERITY_ORDER: Record<Question['severity'], number> = { critical: 0, important: 1, 'nice-to-have': 2 };

/** Words that make an outcome observable even without a number ("returns", "shows", "rejects"...). */
const OBSERVABLE =
  /\d|\b(return|returns|show|shows|display|displays|reject|rejects|refuse|refuses|block|blocks|error|within|never|always|no longer|zero|exactly|at least|at most|only|must|fails?|succeeds?|redirects?|persist|persists|locked|visible|hidden)\b/i;

const quote = (s: string) => `"${s.length > 80 ? `${s.slice(0, 77)}…` : s}"`;

/**
 * Finds what the spec is missing and turns each gap into a question for the developer.
 * Questions quote the spec's own weak spots (vague outcomes, a restated request, files the
 * evidence points at) so the agent asks about this change, not generic boilerplate.
 */
export function generateQuestions(spec: IntentSpec): Question[] {
  const questions: Question[] = [];
  const add = (section: string, severity: Question['severity'], question: string, context?: string) =>
    questions.push({ id: `q-${section}-${questions.length + 1}`, section, severity, question, ...(context ? { context } : {}) });

  // Objective: missing, too short, or just the raw request repeated
  const objective = spec.objective?.trim() ?? '';
  if (!objective) {
    add('objective', 'critical', 'What problem should this change solve, for whom, and why does it matter now?');
  } else if (objective.length < 30 || objective === spec.rawRequest?.trim()) {
    add(
      'objective',
      'critical',
      `The objective ${quote(objective)} only restates the request. What user or business problem does it solve, and what happens if we do nothing?`,
      'A clear objective names the problem and its impact, not just the task.'
    );
  }

  // Outcomes: missing, or present but not observable
  const outcomes = spec.outcomes ?? [];
  if (outcomes.length === 0) {
    add('outcomes', 'critical', 'What observable result tells us this is done? For example a number, a state the user sees, or a response the API returns.');
  } else {
    const vague = outcomes.filter(o => !OBSERVABLE.test(o));
    if (vague.length) {
      add(
        'outcomes',
        'important',
        `These outcomes are not measurable yet: ${vague.map(quote).join(', ')}. What number, threshold, or observable behavior proves each one?`
      );
    }
  }

  // Scope: undefined or one-sided; point at files the evidence already names
  const inScope = spec.scope?.inScope ?? [];
  const outOfScope = spec.scope?.outOfScope ?? [];
  const sources = [...new Set((spec.evidence ?? []).map(e => e.source).filter((s): s is string => !!s))].slice(0, 5);
  const hint = sources.length ? `Evidence points at ${sources.join(', ')}.` : undefined;
  if (!inScope.length && !outOfScope.length) {
    add('scope', 'important', 'Which files or folders may this change touch, and which nearby areas must stay untouched (for example billing or auth)?', hint);
  } else if (!outOfScope.length) {
    add('scope', 'important', `Scope allows ${inScope.join(', ')}. Which nearby areas must NOT change?`);
  } else if (!inScope.length) {
    add('scope', 'important', `Scope protects ${outOfScope.join(', ')}. Which files are allowed to change?`, hint);
  }

  // Edge cases
  if (!spec.edgeCases?.length) {
    const about = outcomes.length ? ` for ${quote(outcomes[0])}` : '';
    add(
      'edgeCases',
      'important',
      `What should happen when things go wrong${about}: invalid input, two users acting at once, empty or missing data, or missing permissions?`
    );
  }

  // Verification
  if (!spec.verification?.length) {
    add(
      'verification',
      'important',
      outcomes.length
        ? `How will we prove ${outcomes.length === 1 ? 'the outcome' : `each of the ${outcomes.length} outcomes`}: which automated tests, and which manual checks?`
        : 'How will we prove the change works: which automated tests, and which manual checks?'
    );
  }

  // Constraints and health metrics
  if (!spec.constraints?.length) {
    add('constraints', 'nice-to-have', 'Are there hard limits: APIs that must stay backward compatible, dependencies we cannot add, performance or security rules?');
  }
  if (!spec.healthMetrics?.length) {
    add('healthMetrics', 'nice-to-have', 'What must not get worse because of this change: existing tests, response times, other user flows?');
  }

  // Evidence beyond the raw request
  const realEvidence = (spec.evidence ?? []).filter(e => e.type !== 'request');
  if (realEvidence.length === 0) {
    add('evidence', 'nice-to-have', 'What prompted this work: a ticket, user feedback, a metric, or an observed bug? Where can I see it?');
  }

  return questions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
