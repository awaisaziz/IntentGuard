/** Why the harness refused a file edit. */
export type BlockReason = 'no-spec' | 'not-ready' | 'not-approved' | 'out-of-scope';

export const BLOCK_REASONS: BlockReason[] = ['no-spec', 'not-ready', 'not-approved', 'out-of-scope'];

/** Compact view of the active spec for chat clients. */
export interface SpecSnapshot {
  id: string;
  status: string;
  objective: string;
  readinessScore: number;
  ready: boolean;
  approved: boolean;
  threshold: number;
  inScope: string[];
  outOfScope: string[];
  blockers: string[];
  outcomes: string[];
}

export interface AgentMetrics {
  harness: boolean;
  model: string;
  /** Developer messages handled. */
  turns: number;
  llmCalls: number;
  toolCalls: number;
  promptTokens: number;
  completionTokens: number;
  /** Time spent working (model + tools), across all turns. */
  elapsedMs: number;
  filesWritten: string[];
  /**
   * Files written outside the active spec's scope. With the harness on these are refused,
   * so this stays empty; with it off, it shows the drift the harness would have stopped.
   */
  outOfScopeWrites: string[];
  blocked: Record<BlockReason, number>;
  checks: Array<{ name: string; passed: boolean }>;
}

export type AgentEvent =
  | { type: 'assistant'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; blocked?: BlockReason; summary: string }
  | { type: 'spec'; spec: SpecSnapshot | null }
  | { type: 'metrics'; metrics: AgentMetrics }
  | { type: 'error'; message: string }
  | { type: 'done' };
