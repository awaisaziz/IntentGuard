import fs from 'node:fs/promises';
import path from 'node:path';
import { AGENTS_RULES, BOB_RULES, CLAUDE_RULES, GEMINI_RULES } from './rules.js';
import { toPosixPath } from '../utils/home.js';

/**
 * Single source of truth for every AI coding agent IntentGuard integrates with.
 *
 * Each agent only discovers MCP servers at its own fixed path, so the config files
 * themselves cannot live in one folder. Instead, every file is generated from this
 * registry (`intent connect` / `intent agents setup`). MCP configs are machine-specific
 * and are kept out of git (git-ignored here, `.git/info/exclude` in connected repos).
 */

export type AgentId = 'claude' | 'bob' | 'codex' | 'gemini' | 'antigravity' | 'cursor';

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

/** How an agent starts the IntentGuard MCP server. */
export interface McpLaunch {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Launch spec for one repository. IntentGuard is local-only (never published), so agents
 * run the built server straight from the IntentGuard checkout with `node` (agents on Windows
 * spawn without a shell, where `npx` shims fail with ENOENT). Both paths are absolute because
 * IDE-based agents such as Bob do not start MCP servers in the project directory; INTENT_ROOT
 * tells the server which repository to guard.
 * @param serverEntry Absolute path to `mcp/dist/index.js`
 * @param projectRoot Absolute path of the repository being guarded
 */
export function mcpLaunch(serverEntry: string, projectRoot: string): McpLaunch {
  return {
    command: 'node',
    args: [toPosixPath(serverEntry)],
    env: { INTENT_ROOT: toPosixPath(projectRoot) },
  };
}

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
    id: 'bob',
    name: 'IBM Bob 2.0',
    mcpConfigPath: '.bob/mcp.json',
    mcpFormat: 'json',
    rules: [
      { path: 'AGENTS.md', content: AGENTS_RULES },
      { path: '.bob/rules/intentguard.md', content: BOB_RULES },
    ],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    mcpConfigPath: '.codex/config.toml',
    mcpFormat: 'toml',
    rules: [{ path: 'AGENTS.md', content: AGENTS_RULES }],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    mcpConfigPath: '.gemini/settings.json',
    mcpFormat: 'json',
    rules: [
      { path: 'AGENTS.md', content: AGENTS_RULES },
      { path: 'GEMINI.md', content: GEMINI_RULES },
    ],
  },
  {
    // Antigravity 2.0 reads workspace MCP servers from .agents/mcp_config.json, and workspace
    // rules from AGENTS.md and GEMINI.md at the repo root.
    id: 'antigravity',
    name: 'Google Antigravity',
    mcpConfigPath: '.agents/mcp_config.json',
    mcpFormat: 'json',
    rules: [
      { path: 'AGENTS.md', content: AGENTS_RULES },
      { path: 'GEMINI.md', content: GEMINI_RULES },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    mcpConfigPath: '.cursor/mcp.json',
    mcpFormat: 'json',
    rules: [{ path: 'AGENTS.md', content: AGENTS_RULES }],
  },
];

/** Repository-relative paths that hold machine-specific values and must never be committed. */
export const MACHINE_LOCAL_PATHS = [
  ...new Set(AGENT_INTEGRATIONS.map(a => a.mcpConfigPath)),
  '.intent/active.json',
  '.intent/runs/',
];

const MANAGED_FILES = new Set(AGENT_INTEGRATIONS.flatMap(a => [a.mcpConfigPath, ...a.rules.map(r => r.path)]));

/**
 * True for files IntentGuard itself writes: `.intent/` state and generated agent configs and
 * rules. They are not part of the change being verified, so they never count against scope.
 */
export function isIntentGuardManaged(file: string): boolean {
  const f = toPosixPath(file).replace(/^\.\//, '');
  return f.startsWith('.intent/') || MANAGED_FILES.has(f);
}

export function getAgent(id: string): AgentIntegration | undefined {
  return AGENT_INTEGRATIONS.find(a => a.id === id);
}

/** A TOML basic string. JSON string escapes are valid TOML escapes, so Windows paths stay intact. */
const tomlString = (value: string) => JSON.stringify(value);

/**
 * Merges the IntentGuard server entry into an agent's existing MCP config,
 * preserving any other servers the user has configured.
 * @param format The agent's config format
 * @param launch How the agent should start the server
 * @param existing Current file content, if any
 * @returns The new file content
 */
export function renderMcpConfig(format: McpFormat, launch: McpLaunch, existing?: string): string {
  if (format === 'toml') {
    const env = Object.entries(launch.env)
      .map(([k, v]) => `${k} = ${tomlString(v)}`)
      .join(', ');
    const section =
      `[mcp_servers.${MCP_SERVER_NAME}]\n` +
      `command = ${tomlString(launch.command)}\n` +
      `args = [${launch.args.map(tomlString).join(', ')}]\n` +
      (env ? `env = { ${env} }\n` : '');
    // Drop any previous intentguard table (and its sub-tables) up to the next unrelated table header
    const header = `[mcp_servers.${MCP_SERVER_NAME}]`;
    const subTable = `[mcp_servers.${MCP_SERVER_NAME}.`;
    const kept: string[] = [];
    let skipping = false;
    for (const line of (existing ?? '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === header || trimmed.startsWith(subTable)) skipping = true;
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
  config.mcpServers = { ...config.mcpServers, [MCP_SERVER_NAME]: launch };
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
export async function writeAgentMcpConfig(rootDir: string, agent: AgentIntegration, launch: McpLaunch): Promise<string> {
  const target = path.join(rootDir, agent.mcpConfigPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const existing = await readIfExists(target);
  await fs.writeFile(target, renderMcpConfig(agent.mcpFormat, launch, existing), 'utf8');
  return agent.mcpConfigPath;
}

export const RULES_BLOCK_START = '<!-- intentguard:start (managed by `intent connect`, edits inside are overwritten) -->';
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
