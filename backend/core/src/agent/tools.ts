import type { ChatTool } from '../llm/chat.js';
import type { IntentConfig, IntentSpec } from '../schema/intentspec.js';
import { SpecStore } from '../store/spec-store.js';
import { computeReadiness } from '../readiness/scorer.js';
import { generateQuestions } from '../questions/generator.js';
import { checkScope } from '../scope/checker.js';
import { verify, generateProofReport } from '../verify/verifier.js';
import { draftSpec } from '../workflow/draft.js';
import { runProjectCheck } from '../workflow/checks.js';
import { EVIDENCE_TYPES, isApproved, updateSpec } from '../workflow/update.js';
import { Workspace, WorkspaceError } from './workspace.js';
import type { AgentMetrics, BlockReason, SpecSnapshot } from './types.js';

export interface ToolRuntime {
  root: string;
  workspace: Workspace;
  store: SpecStore;
  harness: boolean;
  loadConfig(): Promise<IntentConfig>;
  metrics: AgentMetrics;
  signal?: AbortSignal;
}

export interface ToolOutcome {
  /** What the model sees. */
  content: string;
  ok: boolean;
  blocked?: BlockReason;
  /** One line for the developer. */
  summary: string;
  specChanged?: boolean;
}

export function specSnapshot(spec: IntentSpec, threshold: number): SpecSnapshot {
  const readiness = computeReadiness(spec, threshold);
  return {
    id: spec.id,
    status: spec.status,
    objective: spec.objective,
    readinessScore: readiness.score,
    ready: readiness.ready,
    approved: isApproved(spec),
    threshold,
    inScope: spec.scope?.inScope ?? [],
    outOfScope: spec.scope?.outOfScope ?? [],
    blockers: readiness.blockers,
    outcomes: spec.outcomes ?? [],
  };
}

// ---------- JSON schema helpers ----------

const str = (description: string) => ({ type: 'string', description });
const int = (description: string) => ({ type: 'integer', description });
const strList = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ChatTool => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

/** Tool definitions offered to the model. The baseline (harness off) gets the repo tools only. */
export function toolDefinitions(harness: boolean, checks: string[]): ChatTool[] {
  const repoTools: ChatTool[] = [
    fn('list_files', 'List repository files under a directory (respects .gitignore).', {
      path: str('Directory relative to the repo root. Default "."'),
      depth: int('How many directory levels to include. Default 3'),
    }),
    fn('search_code', 'Case-insensitive text search across repository files. Returns file, line, and text.', {
      query: str('Text to find'),
      path: str('Directory to limit the search to. Default "."'),
    }, ['query']),
    fn('read_file', 'Read a text file. Returns up to 400 lines per call.', {
      path: str('File path relative to the repo root'),
      start_line: int('First line to read (1-based)'),
      end_line: int('Last line to read (inclusive)'),
    }, ['path']),
    fn('edit_file', 'Replace one exact occurrence of old_string with new_string in a file.' + (harness ? ' Refused unless the file is inside the approved IntentSpec scope.' : ''), {
      path: str('File path relative to the repo root'),
      old_string: str('Exact existing text, including indentation; must occur exactly once'),
      new_string: str('Replacement text'),
    }, ['path', 'old_string', 'new_string']),
    fn('write_file', 'Create a file or replace its entire content.' + (harness ? ' Refused unless the file is inside the approved IntentSpec scope.' : ''), {
      path: str('File path relative to the repo root'),
      content: str('Full file content'),
    }, ['path', 'content']),
    fn('run_check', `Run a configured project check by name and get its result. ${checks.length ? `Available: ${checks.join(', ')}.` : 'None are configured.'}`, {
      name: str('Check name, e.g. "test"'),
    }, ['name']),
  ];
  if (!harness) return repoTools;

  return [
    fn('intent_create_spec', 'Draft a new IntentSpec from the developer\'s raw request and make it the active spec.', {
      request: str('The developer\'s request, verbatim'),
    }, ['request']),
    fn('intent_get_spec', 'Return the full active IntentSpec with its readiness and approval state.'),
    fn('intent_update_spec', 'Fill in or revise sections of the active IntentSpec. Lists replace the existing section; evidence is appended. Any change resets developer approval.', {
      objective: str('What problem is being solved and why it matters'),
      userGoal: str('What the user is trying to achieve'),
      outcomes: strList('Observable, testable results'),
      constraints: strList('Hard boundaries that must be respected'),
      inScope: strList('Glob patterns of files that may change, relative to the repo root, e.g. "src/booking/**"'),
      outOfScope: strList('Glob patterns of files that must not change'),
      edgeCases: {
        type: 'array',
        items: {
          type: 'object',
          properties: { scenario: { type: 'string' }, expectedBehavior: { type: 'string' } },
          required: ['scenario', 'expectedBehavior'],
        },
        description: 'Boundary conditions and failures with their expected behavior',
      },
      healthMetrics: strList('What must not get worse'),
      verification: strList('How the outcomes will be proven (tests, checks, manual steps)'),
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: EVIDENCE_TYPES },
            excerpt: { type: 'string' },
            source: { type: 'string', description: 'File path or other source' },
          },
          required: ['type', 'excerpt'],
        },
        description: 'Facts found in the repository or given by the developer',
      },
    }),
    fn('intent_questions', 'List open questions for gaps in the active spec that need the developer\'s input.'),
    fn('intent_readiness', 'Score the active spec against the 6 readiness gates. Coding is blocked below the threshold.'),
    fn('intent_verify', 'Verify the working tree against the active spec: scope, outcomes, health metrics, and the configured test check. Saves a proof report.'),
    ...repoTools,
  ];
}

// ---------- executors ----------

function blocked(reason: BlockReason, message: string, summary: string): ToolOutcome {
  return { content: `BLOCKED: ${message}`, ok: false, blocked: reason, summary };
}

/**
 * The harness gate for file edits: an active, ready, developer-approved spec whose scope
 * allows the file.
 */
async function fence(rt: ToolRuntime, rel: string): Promise<ToolOutcome | null> {
  const spec = await rt.store.loadActive();
  if (!spec) {
    return blocked('no-spec', 'there is no active IntentSpec. Call intent_create_spec with the developer\'s request first.', `${rel}: no IntentSpec yet`);
  }
  const { readinessThreshold } = await rt.loadConfig();
  const readiness = computeReadiness(spec, readinessThreshold);
  if (!readiness.ready) {
    return blocked(
      'not-ready',
      `spec ${spec.id} scores ${readiness.score}/100, below the ${readinessThreshold} readiness threshold. Resolve: ${readiness.blockers.join('; ')}`,
      `${rel}: readiness ${readiness.score}/${readinessThreshold}`
    );
  }
  if (!isApproved(spec)) {
    return blocked(
      'not-approved',
      `the developer has not approved spec ${spec.id}. Summarize the spec and ask them to approve it (/approve).`,
      `${rel}: spec not approved yet`
    );
  }
  const scope = checkScope(rel, spec.scope ?? { inScope: [], outOfScope: [] });
  if (!scope.allowed) {
    return blocked(
      'out-of-scope',
      `${rel} is outside the approved scope (${scope.reason}${scope.matchedRule ? `: ${scope.matchedRule}` : ''}). Do not work around this. Explain why the file is needed and ask the developer whether to widen the scope.`,
      `${rel}: outside the approved scope`
    );
  }
  return null;
}

async function recordWrite(rt: ToolRuntime, rel: string): Promise<void> {
  if (!rt.metrics.filesWritten.includes(rel)) rt.metrics.filesWritten.push(rel);
  const spec = await rt.store.loadActive();
  if (spec?.scope && !checkScope(rel, spec.scope).allowed && !rt.metrics.outOfScopeWrites.includes(rel)) {
    rt.metrics.outOfScopeWrites.push(rel);
  }
}

async function activeSpecOrThrow(rt: ToolRuntime): Promise<IntentSpec> {
  const spec = await rt.store.loadActive();
  if (!spec) throw new WorkspaceError('There is no active IntentSpec. Call intent_create_spec first.');
  return spec;
}

type Executor = (args: Record<string, any>, rt: ToolRuntime) => Promise<ToolOutcome>;

const EXECUTORS: Record<string, Executor> = {
  async list_files(args, rt) {
    const { files, truncated } = await rt.workspace.listFiles(args.path ?? '.', args.depth ?? 3);
    return {
      ok: true,
      content: files.length ? files.join('\n') + (truncated ? '\n… (truncated; list a subdirectory)' : '') : 'No files found.',
      summary: `${files.length}${truncated ? '+' : ''} files under ${args.path ?? '.'}`,
    };
  },

  async search_code(args, rt) {
    const { matches, truncated } = await rt.workspace.search(args.query, args.path ?? '.');
    return {
      ok: true,
      content: matches.length
        ? matches.map(m => `${m.file}:${m.line}: ${m.text}`).join('\n') + (truncated ? '\n… (more matches; narrow the query)' : '')
        : `No matches for "${args.query}".`,
      summary: `${matches.length}${truncated ? '+' : ''} matches for "${args.query}"`,
    };
  },

  async read_file(args, rt) {
    const r = await rt.workspace.readFile(args.path, args.start_line, args.end_line);
    const more = r.to < r.totalLines ? `\n… (lines ${r.from}-${r.to} of ${r.totalLines}; read more with start_line)` : '';
    return { ok: true, content: `${r.rel} (lines ${r.from}-${r.to} of ${r.totalLines})\n${r.text}${more}`, summary: `read ${r.rel}` };
  },

  async edit_file(args, rt) {
    const { rel } = await rt.workspace.resolve(args.path, 'write');
    if (rt.harness) {
      const refusal = await fence(rt, rel);
      if (refusal) return refusal;
    }
    await rt.workspace.editFile(rel, args.old_string, args.new_string);
    await recordWrite(rt, rel);
    return { ok: true, content: `Edited ${rel}.`, summary: `edited ${rel}` };
  },

  async write_file(args, rt) {
    const { rel } = await rt.workspace.resolve(args.path, 'write');
    if (rt.harness) {
      const refusal = await fence(rt, rel);
      if (refusal) return refusal;
    }
    const { created } = await rt.workspace.writeFile(rel, args.content);
    await recordWrite(rt, rel);
    return { ok: true, content: `${created ? 'Created' : 'Wrote'} ${rel}.`, summary: `${created ? 'created' : 'wrote'} ${rel}` };
  },

  async run_check(args, rt) {
    const result = await runProjectCheck(rt.root, String(args.name ?? ''), { signal: rt.signal });
    rt.metrics.checks.push({ name: result.name, passed: result.passed });
    const status = result.timedOut ? 'TIMED OUT' : result.passed ? 'PASSED' : `FAILED (exit ${result.exitCode})`;
    return {
      ok: result.passed,
      content: `${result.name} (${result.command}): ${status} in ${Math.round(result.durationMs / 1000)}s\n${result.output}`,
      summary: `check ${result.name}: ${status}`,
    };
  },

  async intent_create_spec(args, rt) {
    if (typeof args.request !== 'string' || !args.request.trim()) throw new WorkspaceError('"request" is required.');
    const spec = await draftSpec(rt.root, args.request.trim());
    const { readinessThreshold } = await rt.loadConfig();
    return {
      ok: true,
      content: JSON.stringify({ spec, readiness: computeReadiness(spec, readinessThreshold), questions: generateQuestions(spec) }, null, 2),
      summary: `drafted spec ${spec.id}`,
      specChanged: true,
    };
  },

  async intent_get_spec(_args, rt) {
    const spec = await activeSpecOrThrow(rt);
    const { readinessThreshold } = await rt.loadConfig();
    return {
      ok: true,
      content: JSON.stringify({ spec, readiness: computeReadiness(spec, readinessThreshold), approved: isApproved(spec) }, null, 2),
      summary: `read spec ${spec.id}`,
    };
  },

  async intent_update_spec(args, rt) {
    const { spec, changed, readiness, approvalReset } = await updateSpec(rt.root, args);
    const note = approvalReset ? ' Approval was reset: ask the developer to approve the revised spec.' : '';
    return {
      ok: true,
      content: `Updated ${changed.join(', ')} of ${spec.id}. Readiness ${readiness.score}/100 (${readiness.ready ? 'ready' : 'not ready'}).${readiness.blockers.length ? ` Blockers: ${readiness.blockers.join('; ')}.` : ''}${note}`,
      summary: `updated ${changed.join(', ')}; readiness ${readiness.score}/100${approvalReset ? '; approval reset' : ''}`,
      specChanged: true,
    };
  },

  async intent_questions(_args, rt) {
    const questions = generateQuestions(await activeSpecOrThrow(rt));
    return {
      ok: true,
      content: questions.length ? JSON.stringify(questions, null, 2) : 'No open questions.',
      summary: `${questions.length} open question(s)`,
    };
  },

  async intent_readiness(_args, rt) {
    const spec = await activeSpecOrThrow(rt);
    const { readinessThreshold } = await rt.loadConfig();
    const readiness = computeReadiness(spec, readinessThreshold);
    return {
      ok: true,
      content: JSON.stringify({ ...readiness, threshold: readinessThreshold, approved: isApproved(spec) }, null, 2),
      summary: `readiness ${readiness.score}/100 (${readiness.ready ? 'ready' : 'blocked'})`,
    };
  },

  async intent_verify(_args, rt) {
    const spec = await activeSpecOrThrow(rt);
    const config = await rt.loadConfig();
    const verification = await verify(rt.root, spec);
    if (config.commands?.test) {
      const test = await runProjectCheck(rt.root, 'test', { signal: rt.signal });
      rt.metrics.checks.push({ name: 'test', passed: test.passed });
      verification.testsRun = [
        { file: `check "test" (${test.command})`, passed: test.passed, output: test.output.slice(-2000) },
        ...verification.testsRun,
      ];
      verification.passed = verification.passed && test.passed;
      // Outcomes mapped to tests cannot count as met when the test run itself failed
      if (!test.passed) {
        verification.outcomesChecked = verification.outcomesChecked.map(o => (o.status === 'pass' ? { ...o, status: 'fail' } : o));
      }
    }
    const report = generateProofReport(spec.id, verification);
    const { report: saved } = await rt.store.saveReport(report);
    const v = saved.verification;
    const lines = [
      `Proof report for ${spec.id}: ${saved.commitReady ? 'COMMIT READY' : 'NOT READY'}.`,
      `Scope violations: ${v.scopeViolations.length ? v.scopeViolations.join(', ') : 'none'}.`,
      `Tests: ${v.testsRun.length ? v.testsRun.map(t => `${t.file} ${t.passed ? 'passed' : 'FAILED'}`).join('; ') : 'none found'}.`,
      'Outcomes:',
      ...v.outcomesChecked.map(o => `- [${o.status}] ${o.outcome}`),
      'Health metrics:',
      ...v.healthMetricsChecked.map(h => `- [${h.status}] ${h.metric}${h.details ? ` (${h.details})` : ''}`),
    ];
    return { ok: saved.commitReady, content: lines.join('\n'), summary: `proof: ${saved.commitReady ? 'commit ready' : 'not ready'}` };
  },
};

/**
 * Runs one tool call. Errors become tool results so the model can recover.
 * @param allowed Names the current mode offers; anything else is refused
 */
export async function runTool(name: string, args: Record<string, unknown>, rt: ToolRuntime, allowed: Set<string>): Promise<ToolOutcome> {
  const exec = EXECUTORS[name];
  if (!exec || !allowed.has(name)) {
    return { ok: false, content: `Unknown tool "${name}". Use one of: ${[...allowed].join(', ')}.`, summary: `unknown tool ${name}` };
  }
  try {
    return await exec(args, rt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, content: `Error: ${message}`, summary: message.slice(0, 160) };
  }
}
