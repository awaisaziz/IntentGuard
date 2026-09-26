import { simpleGit } from 'simple-git';

/** Working-tree status, or null when the folder is not a git repository (then there is no diff). */
async function statusOrNull(repoRoot: string) {
  try {
    return await simpleGit(repoRoot).status(['--untracked-files=all']);
  } catch {
    return null;
  }
}

/**
 * Every path with working-tree changes: modified, new (including untracked), deleted,
 * and renamed files. New files matter most for scope checks, since a change that adds
 * a file outside scope must still be caught.
 */
export async function getChangedFiles(repoRoot: string): Promise<string[]> {
  const status = await statusOrNull(repoRoot);
  return status ? Array.from(new Set(status.files.map(f => f.path))) : [];
}

export async function getDiffStat(repoRoot: string): Promise<string> {
  const git = simpleGit(repoRoot);
  const diff = await git.diff(['--stat']);
  return diff;
}

export async function getStagedFiles(repoRoot: string): Promise<string[]> {
  return (await statusOrNull(repoRoot))?.staged ?? [];
}

export async function getRepoRoot(cwd: string = process.cwd()): Promise<string> {
  const git = simpleGit(cwd);
  try {
    const root = await git.revparse(['--show-toplevel']);
    return root.trim();
  } catch {
    return cwd;
  }
}

export async function commitWithSpec(repoRoot: string, message: string, specId: string): Promise<string> {
  const git = simpleGit(repoRoot);
  const fullMessage = `${message}\n\nIntent-Spec: ${specId}`;
  await git.commit(fullMessage);
  const log = await git.log(['-1']);
  return log.latest?.hash || '';
}
