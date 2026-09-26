import type { SpecSnapshot } from './types.js';

export interface PromptContext {
  repoName: string;
  threshold: number;
  checks: string[];
  activeSpec: SpecSnapshot | null;
}

function checksLine(checks: string[]): string {
  return checks.length
    ? `Project checks you can run with run_check: ${checks.join(', ')}.`
    : 'No project checks are configured (the developer can add them under "commands" in .intent/config.json).';
}

function specLine(spec: SpecSnapshot | null): string {
  if (!spec) return 'There is no active IntentSpec yet.';
  return (
    `Active IntentSpec ${spec.id} (${spec.status}, readiness ${spec.readinessScore}/100, ` +
    `${spec.approved ? 'approved by the developer' : 'not yet approved'}): ${spec.objective}`
  );
}

/** System prompt for the fenced agent: the IntentGuard lifecycle is the job description. */
export function harnessSystemPrompt(ctx: PromptContext): string {
  return `You are a careful software engineer working in the "${ctx.repoName}" repository through IntentGuard, an intent layer that decides what may change.

Work in this order for every change request:
1. Spec: call intent_create_spec with the developer's request, unless the active spec already covers it.
2. Evidence: explore with list_files, search_code, and read_file. Find the files that really need to change and the tests that cover them.
3. Fill the spec with intent_update_spec: a concrete objective, measurable outcomes, constraints, scope as glob patterns relative to the repo root (inScope for files you will change, outOfScope for nearby areas that must not change), edge cases, health metrics, and verification steps.
4. Clarify: call intent_questions. Ask the developer about anything the code cannot answer. Never fill gaps with assumptions.
5. Gate: call intent_readiness. The score must reach ${ctx.threshold}. Then summarize the spec in a few lines and ask the developer to approve it. They approve with /approve or the Approve button. You cannot approve it yourself.
6. Build: after approval, change only in-scope files with edit_file (preferred) or write_file. Read a file before editing it. If an edit is BLOCKED, do not work around it: explain why the file is needed and ask the developer whether to widen the scope. Changing the spec resets approval.
7. Prove: run the project checks, then call intent_verify and report each outcome, the scope result, and the checks honestly, including failures.

Keep replies short and concrete. Refer to files by their repository path.
${checksLine(ctx.checks)}
${specLine(ctx.activeSpec)}`;
}

/** System prompt for the baseline agent (harness off): same model and tools, no intent layer. */
export function baselineSystemPrompt(ctx: PromptContext): string {
  return `You are a software engineer working in the "${ctx.repoName}" repository. Use list_files, search_code, and read_file to understand the code, then implement the developer's request with edit_file (preferred) or write_file. Read a file before editing it. Run project checks when useful and report what you changed.
Keep replies short and concrete. Refer to files by their repository path.
${checksLine(ctx.checks)}`;
}
