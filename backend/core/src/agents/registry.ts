import fs from 'node:fs/promises';
import path from 'node:path';
import { AGENTS_RULES, BOB_RULES, CLAUDE_RULES } from './rules.js';

/**
 * Single source of truth for every AI coding agent IntentGuard integrates with.
 *
 * Each agent only discovers MCP servers at its own fixed path, so the config files
 * themselves cannot live in one folder. Instead, every file is generated from this
 * registry (`intent agents setup`) and the generated copies are git-ignored.
 */

export type AgentId = 'claude' | 'cursor' | 'codex' | 'bob';

export type McpFormat = 'json' | 'toml';

export interface RuleFile {
  path: string;
  content: string;
}

export interface AgentIntegration {
  id: AgentId;
  name: string;
  /** MCP config path, relative to the repo root. */
  mcpConfigPath: string;
  mcpFormat: McpFormat;
  /** Rule files this agent reads, relative to the repo root. */
  rules: RuleFile[];
}

export const MCP_SERVER_NAME = 'intentguard';

/**
 * Launch the local build directly with node. IntentGuard is local-only (never published),
 * and agents on Windows spawn commands without a shell, where `npx` (an npx.cmd shim) fails
 * with ENOENT. The path is relative to the repo root, which agents use as the working directory.
 */
export const MCP_SERVER = {
  command: 'node',
  args: ['mcp/dist/index.js'],
};

export const AGENT_INTEGRATIONS: AgentIntegration[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    mcpConfigPath: '.mcp.json',
    mcpFormat: 'json',
    rules: [
      { path: 'AGENTS.md', content: AGENTS_RULES },
      { path: 'CLAUDE.md', content: CLAUDE_RULES },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    mcpConfigPath: '.cursor/mcp.json',
    mcpFormat: 'json',
    rules: [{ path: 'AGENTS.md', content: AGENTS_RULES }],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    mcpConfigPath: '.codex/config.toml',
    mcpFormat: 'toml',
    rules: [{ path: 'AGENTS.md', content: AGENTS_RULES }],
  },
  {
    id: 'bob',
    name: 'IBM Bob 2.0',
    mcpConfigPath: '.bob/mcp.json',
    mcpFormat: 'json',
    rules: [
      { path: 'AGENTS.md', content: AGENTS_RULES },
      { path: '.bob/rules.md', content: BOB_RULES },
    ],
  },
];

export function getAgent(id: string): AgentIntegration | undefined {
  return AGENT_INTEGRATIONS.find(a => a.id === id);
}

/**
 * Merges the IntentGuard server entry into an agent's existing MCP config,
 * preserving any other servers the user has configured.
 * @param format The agent's config format
 * @param existing Current file content, if any
 * @returns The new file content
 */
export function renderMcpConfig(format: McpFormat, existing?: string): string {
  if (format === 'toml') {
    const section =
      `[mcp_servers.${MCP_SERVER_NAME}]\n` +
      `command = "${MCP_SERVER.command}"\n` +
      `args = [${MCP_SERVER.args.map(a => `"${a}"`).join(', ')}]\n`;
    // Drop any previous intentguard table: its header line up to the next table header
    const header = `[mcp_servers.${MCP_SERVER_NAME}]`;
    const kept: string[] = [];
    let skipping = false;
    for (const line of (existing ?? '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === header) skipping = true;
      else if (/^\[.+\]$/.test(trimmed)) skipping = false;
      if (!skipping) kept.push(line);
    }
    const rest = kept.join('\n').trim();
    return rest ? `${rest}\n\n${section}` : section;
  }

  let config: { mcpServers?: Record<string, unknown> } = {};
  try {
    config = existing ? JSON.parse(existing) : {};
  } catch {
    // Invalid JSON: start fresh rather than fail setup
  }
  config.mcpServers = { ...config.mcpServers, [MCP_SERVER_NAME]: MCP_SERVER };
  return JSON.stringify(config, null, 2) + '\n';
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Writes an agent's MCP config into the repo.
 * @returns The path written, relative to the repo root
 */
export async function writeAgentMcpConfig(rootDir: string, agent: AgentIntegration): Promise<string> {
  const target = path.join(rootDir, agent.mcpConfigPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const existing = await readIfExists(target);
  await fs.writeFile(target, renderMcpConfig(agent.mcpFormat, existing), 'utf8');
  return agent.mcpConfigPath;
}

export const RULES_BLOCK_START = '<!-- intentguard:start (managed by `intent agents setup`, edits inside are overwritten) -->';
export const RULES_BLOCK_END = '<!-- intentguard:end -->';

/**
 * Inserts or refreshes the IntentGuard block in a rule file, leaving any
 * hand-written content outside the markers untouched.
 * @param content Rule text to place inside the managed block
 * @param existing Current file content, if any
 * @returns The new file content
 */
export function renderRulesFile(content: string, existing?: string): string {
  const block = `${RULES_BLOCK_START}\n${content.trim()}\n${RULES_BLOCK_END}`;
  if (!existing?.trim()) return block + '\n';

  const start = existing.indexOf(RULES_BLOCK_START.slice(0, RULES_BLOCK_START.indexOf(' (')));
  const end = existing.indexOf(RULES_BLOCK_END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + RULES_BLOCK_END.length);
  }
  return `${existing.trimEnd()}\n\n${block}\n`;
}

/**
 * Writes an agent's rule files into the repo.
 * @returns The paths written, relative to the repo root
 */
export async function writeAgentRules(rootDir: string, agent: AgentIntegration): Promise<string[]> {
  for (const rule of agent.rules) {
    const target = path.join(rootDir, rule.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const existing = await readIfExists(target);
    await fs.writeFile(target, renderRulesFile(rule.content, existing), 'utf8');
  }
  return agent.rules.map(r => r.path);
}

export interface AgentStatus {
  id: AgentId;
  name: string;
  mcpConfigPath: string;
  mcpConfigured: boolean;
  rulesInstalled: boolean;
}

/**
 * Reports which agents currently have IntentGuard wired up in the repo.
 */
export async function getAgentStatuses(rootDir: string): Promise<AgentStatus[]> {
  return Promise.all(
    AGENT_INTEGRATIONS.map(async agent => {
      const mcp = await readIfExists(path.join(rootDir, agent.mcpConfigPath));
      const rules = await Promise.all(agent.rules.map(r => readIfExists(path.join(rootDir, r.path))));
      return {
        id: agent.id,
        name: agent.name,
        mcpConfigPath: agent.mcpConfigPath,
        mcpConfigured: !!mcp && mcp.includes(MCP_SERVER_NAME),
        rulesInstalled: rules.every(r => r?.includes(RULES_BLOCK_END)),
      };
    })
  );
}
