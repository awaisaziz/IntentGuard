import { simpleGit } from 'simple-git';

export async function getChangedFiles(repoRoot: string): Promise<string[]> {
  const git = simpleGit(repoRoot);
  const status = await git.status();
  return status.modified;
}

export async function getDiffStat(repoRoot: string): Promise<string> {
  const git = simpleGit(repoRoot);
  const diff = await git.diff(['--stat']);
  return diff;
}

export async function getStagedFiles(repoRoot: string): Promise<string[]> {
  const git = simpleGit(repoRoot);
  const status = await git.status();
  return status.staged;
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
