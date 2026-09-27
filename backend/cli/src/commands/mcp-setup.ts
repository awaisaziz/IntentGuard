import { existsSync } from 'node:fs';
import path from 'node:path';
import { AGENT_INTEGRATIONS, connectRepo, getAgent, getRepoRoot, type AgentIntegration } from '@intentguard/core';
import { success, error, warning } from '../ui/formatters.js';

interface AgentOptions {
  all?: boolean;
  agent?: string;
}

/**
 * Returns a clean, single-line error message from any thrown value.
 * Handles non-Error throws (plain strings, numbers, etc.) so callers
 * never produce "Failed to ...: undefined".
 */
export function formatCommandError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

/**
 * Resolves which agents a command targets from --all / --agent.
 * @returns The selected agents, or null if the agent name is unknown
 */
export function selectAgents(options: AgentOptions): AgentIntegration[] | null {
  if (options.all || !options.agent || options.agent === 'all') return AGENT_INTEGRATIONS;
  const agent = getAgent(options.agent);
  return agent ? [agent] : null;
}

/**
 * Returns the selected agents, or throws an Error describing the problem
 * so the caller can decide how to present it. Does NOT call process.exit.
 */
export function selectAgentsOrExit(options: AgentOptions): AgentIntegration[] {
  const agents = selectAgents(options);
  if (!agents) {
    const known = AGENT_INTEGRATIONS.map(a => a.id).join(', ');
    throw new Error(`Unknown agent "${options.agent}". Known agents: ${known}`);
  }
  return agents;
}

/**
 * Resolves a --repo argument. pnpm runs scripts from the IntentGuard root, so relative paths
 * are taken from where the developer typed the command (INIT_CWD), not from here.
 */
export async function resolveRepo(repo?: string): Promise<string> {
  const base = process.env.INIT_CWD || process.cwd();
  const target = repo ? path.resolve(base, repo) : base;
  if (!existsSync(target)) throw new Error(`Repository not found: ${target}`);
  return getRepoRoot(target);
}

/**
 * Writes the IntentGuard MCP server entry into each selected agent's config for this repo.
 * @param options Options for the mcp-setup command
 */
export async function mcpSetupCommand(options: AgentOptions): Promise<void> {
  try {
    const agents = selectAgentsOrExit(options);
    const result = await connectRepo(await getRepoRoot(), { agents, rules: false });
    for (const file of result.mcpConfigs) {
      const agent = agents.find(a => a.mcpConfigPath === file);
      console.log(success(`Configured ${agent?.name ?? 'agent'} MCP (${file}).`));
    }
  } catch (err) {
    console.error(error(`MCP setup failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
