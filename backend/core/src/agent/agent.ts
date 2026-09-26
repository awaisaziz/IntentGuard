import fs from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage, ChatModel, ChatTool } from '../llm/chat.js';
import type { IntentSpec } from '../schema/intentspec.js';
import { SpecStore } from '../store/spec-store.js';
import { loadConfig } from '../store/config.js';
import { computeReadiness } from '../readiness/scorer.js';
import { generateTimestamp } from '../utils/id.js';
import { Workspace } from './workspace.js';
import { baselineSystemPrompt, harnessSystemPrompt } from './prompt.js';
import { runTool, specSnapshot, toolDefinitions, type ToolRuntime } from './tools.js';
import { BLOCK_REASONS, type AgentEvent, type AgentMetrics, type SpecSnapshot } from './types.js';

export interface IntentAgentOptions {
  rootDir: string;
  model: ChatModel;
  /** Run with the IntentGuard harness (default true). False gives the baseline agent for A/B runs. */
  harness?: boolean;
  /** Model calls allowed per developer message (default 30). */
  maxSteps?: number;
  /** Write a run log to `.intent/runs/` after every message (default true). */
  logRuns?: boolean;
}

/** Characters of history sent to the model; older tool output is shortened first. */
const HISTORY_BUDGET = 90_000;
const TOOL_OUTPUT_LIMIT = 12_000;

interface TimelineEntry {
  at: number;
  kind: 'message' | 'tool' | 'approval';
  tool?: string;
  path?: string;
  ok?: boolean;
  blocked?: string;
}

/**
 * A coding agent whose only way to touch the repository is through IntentGuard's tools.
 * With the harness on, edits pass the spec, readiness, approval, and scope fence; with it
 * off, the same model and tools run unfenced so the two can be compared.
 */
export class IntentAgent {
  readonly id: string;
  readonly harness: boolean;
  readonly rootDir: string;
  private readonly model: ChatModel;
  private readonly store: SpecStore;
  private readonly workspace: Workspace;
  private readonly maxSteps: number;
  private readonly logRuns: boolean;
  private readonly startedAt = Date.now();
  private messages: ChatMessage[] = [];
  private tools: ChatTool[] = [];
  private allowedTools = new Set<string>();
  private timeline: TimelineEntry[] = [];
  /** IntentGuard notices delivered with the developer's next message (e.g. approval). */
  private pendingNotes: string[] = [];
  private busy = false;
  private metrics: AgentMetrics;

  private constructor(options: IntentAgentOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.model = options.model;
    this.harness = options.harness !== false;
    this.maxSteps = options.maxSteps ?? 30;
    this.logRuns = options.logRuns !== false;
    this.store = new SpecStore(this.rootDir);
    this.workspace = new Workspace(this.rootDir);
    this.id = `run-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${Math.random().toString(36).slice(2, 6)}`;
    this.metrics = {
      harness: this.harness,
      model: this.model.id,
      turns: 0,
      llmCalls: 0,
      toolCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      elapsedMs: 0,
      filesWritten: [],
      outOfScopeWrites: [],
      blocked: Object.fromEntries(BLOCK_REASONS.map(r => [r, 0])) as AgentMetrics['blocked'],
      checks: [],
    };
  }

  static async create(options: IntentAgentOptions): Promise<IntentAgent> {
    const agent = new IntentAgent(options);
    await agent.store.init();
    const config = await loadConfig(agent.rootDir);
    const checks = Object.keys(config.commands ?? {});
    agent.tools = toolDefinitions(agent.harness, checks);
    agent.allowedTools = new Set(agent.tools.map(t => t.function.name));
    const context = {
      repoName: config.projectName ?? path.basename(agent.rootDir),
      threshold: config.readinessThreshold,
      checks,
      activeSpec: await agent.snapshot(),
    };
    agent.messages = [
      { role: 'system', content: agent.harness ? harnessSystemPrompt(context) : baselineSystemPrompt(context) },
    ];
    return agent;
  }

  get modelId(): string {
    return this.model.id;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  getMetrics(): AgentMetrics {
    return structuredClone(this.metrics);
  }

  /** The active spec as chat clients show it, or null. */
  async snapshot(): Promise<SpecSnapshot | null> {
    const spec = await this.store.loadActive();
    if (!spec) return null;
    const { readinessThreshold } = await loadConfig(this.rootDir);
    return specSnapshot(spec, readinessThreshold);
  }

  /**
   * Developer approval of the active spec. Only people approve: the model has no tool for it.
   * @throws When there is no active spec or it has not passed the readiness gate
   */
  async approve(): Promise<SpecSnapshot> {
    const spec: IntentSpec | null = await this.store.loadActive();
    if (!spec) throw new Error('There is no active IntentSpec to approve.');
    const { readinessThreshold } = await loadConfig(this.rootDir);
    const readiness = computeReadiness(spec, readinessThreshold);
    if (!readiness.ready) {
      throw new Error(`Spec ${spec.id} is not ready (${readiness.score}/${readinessThreshold}): ${readiness.blockers.join('; ')}`);
    }
    spec.status = 'approved';
    spec.updatedAt = generateTimestamp();
    const { spec: saved } = await this.store.save(spec);
    this.timeline.push({ at: Date.now(), kind: 'approval' });
    this.pendingNotes.push(
      `[IntentGuard] The developer approved IntentSpec ${saved.id}. You may now implement it, editing only files inside its scope.`
    );
    await this.writeRunLog();
    return specSnapshot(saved, readinessThreshold);
  }

  /** Keeps the request within budget by shortening the oldest tool outputs first. */
  private historyForModel(): ChatMessage[] {
    let total = this.messages.reduce((n, m) => n + (('content' in m && m.content) || '').length, 0);
    if (total <= HISTORY_BUDGET) return this.messages;
    const trimmed = this.messages.map(m => ({ ...m }) as ChatMessage);
    for (const m of trimmed) {
      if (total <= HISTORY_BUDGET) break;
      if (m.role === 'tool' && m.content.length > 300) {
        total -= m.content.length - 300;
        m.content = `${m.content.slice(0, 300)}\n… (older output trimmed)`;
      }
    }
    return trimmed;
  }

  /**
   * Handles one developer message, yielding events as the agent works.
   * @param text The developer's message
   */
  async *send(text: string, options: { signal?: AbortSignal } = {}): AsyncGenerator<AgentEvent> {
    if (this.busy) {
      yield { type: 'error', message: 'The agent is still working on the previous message.' };
      yield { type: 'done' };
      return;
    }
    this.busy = true;
    const started = Date.now();
    this.metrics.turns++;
    this.messages.push({ role: 'user', content: [...this.pendingNotes, text].join('\n\n') });
    this.pendingNotes = [];
    this.timeline.push({ at: started, kind: 'message' });

    const runtime: ToolRuntime = {
      root: this.rootDir,
      workspace: this.workspace,
      store: this.store,
      harness: this.harness,
      loadConfig: () => loadConfig(this.rootDir),
      metrics: this.metrics,
      signal: options.signal,
    };

    try {
      let finished = false;
      for (let step = 0; step < this.maxSteps && !finished; step++) {
        if (options.signal?.aborted) {
          yield { type: 'error', message: 'Stopped by the developer.' };
          break;
        }
        const response = await this.model.chat(this.historyForModel(), this.tools, { signal: options.signal });
        this.metrics.llmCalls++;
        this.metrics.promptTokens += response.usage?.promptTokens ?? 0;
        this.metrics.completionTokens += response.usage?.completionTokens ?? 0;

        const { content, tool_calls: calls } = response.message;
        this.messages.push({
          role: 'assistant',
          ...(content ? { content } : {}),
          ...(calls?.length ? { tool_calls: calls } : {}),
        });
        if (content?.trim()) yield { type: 'assistant', text: content.trim() };
        if (!calls?.length) {
          finished = true;
          break;
        }

        for (const call of calls) {
          let args: Record<string, unknown> = {};
          let outcome;
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            if (typeof args !== 'object' || args === null || Array.isArray(args)) throw new Error('arguments must be a JSON object');
          } catch (err) {
            outcome = {
              ok: false,
              content: `Error: invalid JSON arguments for ${call.function.name}: ${err instanceof Error ? err.message : String(err)}`,
              summary: 'invalid tool arguments',
            };
          }
          yield { type: 'tool_call', id: call.id, name: call.function.name, args };
          this.metrics.toolCalls++;
          outcome ??= await runTool(call.function.name, args, runtime, this.allowedTools);
          if (outcome.blocked) this.metrics.blocked[outcome.blocked]++;
          this.timeline.push({
            at: Date.now(),
            kind: 'tool',
            tool: call.function.name,
            path: typeof args.path === 'string' ? args.path : undefined,
            ok: outcome.ok,
            blocked: outcome.blocked,
          });
          const content =
            outcome.content.length > TOOL_OUTPUT_LIMIT
              ? `${outcome.content.slice(0, TOOL_OUTPUT_LIMIT)}\n… (output truncated)`
              : outcome.content;
          this.messages.push({ role: 'tool', tool_call_id: call.id, content });
          yield { type: 'tool_result', id: call.id, name: call.function.name, ok: outcome.ok, blocked: outcome.blocked, summary: outcome.summary };
          if (outcome.specChanged) yield { type: 'spec', spec: await this.snapshot() };
        }
      }
      if (!finished && !options.signal?.aborted) {
        yield { type: 'assistant', text: `Paused after ${this.maxSteps} steps. Send a message to let me continue.` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: 'error', message: options.signal?.aborted ? 'Stopped by the developer.' : message };
    } finally {
      this.metrics.elapsedMs += Date.now() - started;
      this.busy = false;
      await this.writeRunLog().catch(() => {});
    }
    yield { type: 'metrics', metrics: this.getMetrics() };
    yield { type: 'done' };
  }

  /** Local run log (git-ignored) for comparing harness and baseline runs afterwards. */
  private async writeRunLog(): Promise<void> {
    if (!this.logRuns) return;
    const dir = path.join(this.rootDir, '.intent', 'runs');
    await fs.mkdir(dir, { recursive: true });
    const spec = await this.store.loadActive();
    await fs.writeFile(
      path.join(dir, `${this.id}.json`),
      JSON.stringify(
        {
          id: this.id,
          harness: this.harness,
          model: this.model.id,
          specId: spec?.id ?? null,
          startedAt: new Date(this.startedAt).toISOString(),
          updatedAt: new Date().toISOString(),
          metrics: this.metrics,
          timeline: this.timeline,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }
}
