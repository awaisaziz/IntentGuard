import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import {
  AGENT_INTEGRATIONS,
  MACHINE_LOCAL_PATHS,
  mcpLaunch,
  writeAgentMcpConfig,
  writeAgentRules,
  type AgentIntegration,
} from '../agents/registry.js';
import { DEFAULT_CONFIG, detectProjectInfo, loadConfig, saveConfig } from '../store/config.js';
import { SpecStore } from '../store/spec-store.js';
import { getRepoRoot } from '../utils/git.js';
import { mcpServerEntry } from '../utils/home.js';
import { detectProjectCommands } from './checks.js';

export interface ConnectOptions {
  /** Agents to wire up (default: all). */
  agents?: AgentIntegration[];
  /** Write MCP configs (default true). */
  mcp?: boolean;
  /** Write rule files (default true). */
  rules?: boolean;
  /** Override the MCP server entry point (tests). */
  serverEntry?: string;
}

export interface ConnectResult {
  root: string;
  /** True when `.intent/config.json` was created by this call. */
  initialized: boolean;
  commands: Record<string, string>;
  mcpConfigs: string[];
  rules: string[];
  /** Paths added to `.git/info/exclude` so machine-specific files stay out of commits. */
  excluded: string[];
  /** Machine-specific files that are already tracked by git: the developer must not commit them. */
  trackedWarnings: string[];
}

const EXCLUDE_HEADER = '# IntentGuard: machine-specific agent configs and local state (added by `intent connect`)';

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Adds entries to the repo's local exclude file. Unlike .gitignore this file is never
 * committed, so connecting IntentGuard leaves no trace in the connected repo's history.
 */
async function excludeLocally(root: string, entries: string[]): Promise<string[]> {
  const git = simpleGit(root);
  const excludeRel = (await git.revparse(['--git-path', 'info/exclude'])).trim();
  const excludePath = path.resolve(root, excludeRel);
  let current = '';
  try {
    current = await fs.readFile(excludePath, 'utf8');
  } catch {
    // No exclude file yet
  }
  const present = new Set(current.split(/\r?\n/).map(l => l.trim()));
  const missing = entries.map(e => `/${e}`).filter(e => !present.has(e));
  if (missing.length === 0) return [];

  const lines = present.has(EXCLUDE_HEADER) ? missing : [EXCLUDE_HEADER, ...missing];
  await fs.mkdir(path.dirname(excludePath), { recursive: true });
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  await fs.appendFile(excludePath, `${prefix}${lines.join('\n')}\n`, 'utf8');
  return missing;
}

/**
 * Connects IntentGuard to a repository: initializes `.intent/`, points every agent's MCP
 * config at this IntentGuard checkout, installs the rule blocks, and keeps the
 * machine-specific files out of git.
 * @param target Any path inside the repository to connect
 */
export async function connectRepo(target: string, options: ConnectOptions = {}): Promise<ConnectResult> {
  const resolved = path.resolve(target);
  if (!(await isDirectory(resolved))) throw new Error(`Not a directory: ${target}`);

  const root = path.resolve(await getRepoRoot(resolved));
  const agents = options.agents ?? AGENT_INTEGRATIONS;
  const writeMcp = options.mcp !== false;
  const writeRules = options.rules !== false;
  const serverEntry = writeMcp ? (options.serverEntry ?? mcpServerEntry()) : '';

  // .intent/: keep an existing config, only filling in checks when none are configured
  let initialized = false;
  let config = await loadConfig(root);
  const configExists = await fs
    .access(path.join(root, '.intent', 'config.json'))
    .then(() => true)
    .catch(() => false);
  if (!configExists) {
    const info = await detectProjectInfo(root);
    config = {
      ...DEFAULT_CONFIG,
      projectName: info.projectName ?? path.basename(root),
      commands: await detectProjectCommands(root),
    };
    await saveConfig(root, config);
    initialized = true;
  } else if (!config.commands) {
    const detected = await detectProjectCommands(root);
    if (Object.keys(detected).length > 0) {
      const raw = JSON.parse(await fs.readFile(path.join(root, '.intent', 'config.json'), 'utf8'));
      raw.commands = detected;
      await fs.writeFile(path.join(root, '.intent', 'config.json'), JSON.stringify(raw, null, 2) + '\n', 'utf8');
      config.commands = detected;
    }
  }
  await new SpecStore(root).init();

  const mcpConfigs: string[] = [];
  const rules = new Set<string>();
  const launch = mcpLaunch(serverEntry, root);
  for (const agent of agents) {
    if (writeMcp) mcpConfigs.push(await writeAgentMcpConfig(root, agent, launch));
    if (writeRules) for (const file of await writeAgentRules(root, agent)) rules.add(file);
  }

  let excluded: string[] = [];
  let trackedWarnings: string[] = [];
  const git = simpleGit(root);
  if (await git.checkIsRepo().catch(() => false)) {
    excluded = await excludeLocally(root, MACHINE_LOCAL_PATHS);
    const tracked = await git.raw(['ls-files', '--', ...MACHINE_LOCAL_PATHS]).catch(() => '');
    trackedWarnings = tracked.split(/\r?\n/).filter(Boolean);
  }

  return {
    root,
    initialized,
    commands: config.commands ?? {},
    mcpConfigs,
    rules: [...rules],
    excluded,
    trackedWarnings,
  };
}
