import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { findIntentGuardHome } from '../utils/home.js';
import { connectRepo } from './connect.js';

/**
 * Workspaces are repositories cloned from GitHub into `<IntentGuard>/workspaces/`, a
 * git-ignored folder, so the dashboard and the chat agent can work on any project
 * without that project's files ever entering IntentGuard's own history.
 */

export const WORKSPACES_DIR = 'workspaces';
const ACTIVE_FILE = '.active.json';
const CLONE_TIMEOUT_MS = 5 * 60_000;

export class WorkspaceUrlError extends Error {}
export class WorkspaceCloneError extends Error {}

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  /** Canonical clone URL: https://github.com/<owner>/<repo>.git */
  cloneUrl: string;
  /** Folder name under workspaces/: `<owner>__<repo>` */
  name: string;
}

export interface WorkspaceInfo {
  /** Folder name under workspaces/, or the folder's base name for the start repository. */
  name: string;
  root: string;
  /** Origin URL with any embedded credentials removed. */
  remote?: string;
  branch?: string;
  specs: number;
  lastCommit?: { hash: string; message: string; date: string };
}

const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9_])?$/;

/**
 * Accepts `https://github.com/<owner>/<repo>` (optionally with `.git` or a trailing slash)
 * and `github.com/<owner>/<repo>`. Everything else is refused, so nothing but a
 * well-formed GitHub repository URL ever reaches git.
 * @throws WorkspaceUrlError
 */
export function parseGitHubUrl(input: string): GitHubRepoRef {
  const expected = 'Expected a GitHub repository URL like https://github.com/owner/repo';
  const text = (input ?? '').trim();
  const match = /^(?:https:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(text);
  if (!match) throw new WorkspaceUrlError(expected);
  const [, owner, repo] = match;
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo) || owner.includes('..') || repo.includes('..')) {
    throw new WorkspaceUrlError(expected);
  }
  return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git`, name: `${owner}__${repo}` };
}

/**
 * The folder that holds cloned repositories.
 * @throws When the IntentGuard checkout cannot be located
 */
export function workspacesDir(home: string | undefined = findIntentGuardHome()): string {
  if (!home) throw new Error('Could not locate the IntentGuard checkout.');
  return path.join(home, WORKSPACES_DIR);
}

function withoutCredentials(url: string): string {
  return url.replace(/^(https?:\/\/)[^/@\s]+@/i, '$1');
}

/** Git facts and the spec count for a repository folder. Missing git data is simply left out. */
export async function describeWorkspace(root: string, name: string = path.basename(root)): Promise<WorkspaceInfo> {
  const info: WorkspaceInfo = { name, root, specs: 0 };
  try {
    const files = await fs.readdir(path.join(root, '.intent', 'specs'));
    info.specs = files.filter(f => f.endsWith('.json')).length;
  } catch {
    // No specs yet
  }
  try {
    const git = simpleGit(root);
    if (await git.checkIsRepo()) {
      info.branch = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '')).trim() || undefined;
      const remote = (await git.remote(['get-url', 'origin']).catch(() => '')) || '';
      if (remote.trim()) info.remote = withoutCredentials(remote.trim());
      const log = await git.log(['-1']).catch(() => undefined);
      if (log?.latest) {
        info.lastCommit = { hash: log.latest.hash.slice(0, 7), message: log.latest.message, date: log.latest.date };
      }
    }
  } catch {
    // Not a git repository
  }
  return info;
}

/** Every repository cloned into workspaces/, by name. */
export async function listWorkspaces(home?: string): Promise<WorkspaceInfo[]> {
  const dir = workspacesDir(home);
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true }))
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.endsWith('.partial'))
      .map(e => e.name);
  } catch {
    return [];
  }
  return Promise.all(entries.sort().map(name => describeWorkspace(path.join(dir, name), name)));
}

/** Resolves a workspace name to its folder, refusing anything that is not a direct child. */
export async function resolveWorkspace(name: string, home?: string): Promise<string | undefined> {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('.')) return undefined;
  const root = path.join(workspacesDir(home), name);
  try {
    return (await fs.stat(root)).isDirectory() ? root : undefined;
  } catch {
    return undefined;
  }
}

export interface CloneOptions {
  home?: string;
  /** Clone from here instead of GitHub (tests). */
  source?: string;
}

export interface CloneResult {
  workspace: WorkspaceInfo;
  /** False when the repository was already cloned. */
  cloned: boolean;
  /** True when an existing clone was fast-forwarded to the remote. */
  updated: boolean;
}

// Never let git wait for a username or password: the server has no terminal
// Inherited GIT_* overrides (editor, askpass, ssh command) are dropped: simple-git refuses
// them as unsafe, and a clone needs none of them.
function gitEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || /^(?:GIT_|SSH_ASKPASS$|EDITOR$|PAGER$|PREFIX$)/i.test(key)) continue;
    env[key] = value;
  }
  return { ...env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
}

/**
 * Clones a GitHub repository into workspaces/ and initialises the intent layer in it.
 * An existing clone is fast-forwarded when possible; local changes are never discarded.
 * @throws WorkspaceUrlError for anything but a GitHub repository URL
 * @throws WorkspaceCloneError when git cannot clone the repository
 */
export async function cloneWorkspace(url: string, options: CloneOptions = {}): Promise<CloneResult> {
  const ref = parseGitHubUrl(url);
  const dir = workspacesDir(options.home);
  const dest = path.join(dir, ref.name);
  await fs.mkdir(dir, { recursive: true });

  let cloned = false;
  let updated = false;
  const exists = await fs
    .stat(dest)
    .then(s => s.isDirectory())
    .catch(() => false);

  if (exists) {
    try {
      const result = await simpleGit(dest, { timeout: { block: CLONE_TIMEOUT_MS } }).env(gitEnv()).pull(['--ff-only']);
      updated = result.summary.changes > 0 || result.files.length > 0;
    } catch {
      // Offline, diverged, or local changes: keep what is there
    }
  } else {
    const partial = `${dest}.partial`;
    await fs.rm(partial, { recursive: true, force: true });
    try {
      await simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } })
        .env(gitEnv())
        .clone(options.source ?? ref.cloneUrl, partial, ['--single-branch']);
      await fs.rename(partial, dest);
      cloned = true;
    } catch (err) {
      await fs.rm(partial, { recursive: true, force: true }).catch(() => undefined);
      const detail = (err instanceof Error ? err.message : String(err)).split(/\r?\n/).filter(Boolean).pop() ?? '';
      throw new WorkspaceCloneError(
        `Could not clone ${ref.owner}/${ref.repo}: ${withoutCredentials(detail) || 'git failed'}. ` +
          'Check that the repository exists and is public, or that git has credentials for it.'
      );
    }
  }

  // .intent/ only: agent configs and rule files are left to `intent connect`
  await connectRepo(dest, { mcp: false, rules: false });
  return { workspace: await describeWorkspace(dest, ref.name), cloned, updated };
}

/** The workspace the dashboard was last switched to, if its folder still exists. */
export async function readActiveWorkspace(home?: string): Promise<string | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(workspacesDir(home), ACTIVE_FILE), 'utf8'));
    return typeof raw?.name === 'string' && (await resolveWorkspace(raw.name, home)) ? raw.name : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the active workspace across server restarts; `null` returns to the start repository. */
export async function writeActiveWorkspace(name: string | null, home?: string): Promise<void> {
  const dir = workspacesDir(home);
  const file = path.join(dir, ACTIVE_FILE);
  if (name === null) {
    await fs.rm(file, { force: true });
    return;
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify({ name }, null, 2) + '\n', 'utf8');
}
