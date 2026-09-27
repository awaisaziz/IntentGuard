import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import {
  cloneWorkspace,
  listWorkspaces,
  parseGitHubUrl,
  readActiveWorkspace,
  resolveWorkspace,
  writeActiveWorkspace,
  WorkspaceCloneError,
  WorkspaceUrlError,
} from '../src/workflow/workspaces.js';

describe('parseGitHubUrl', () => {
  it('accepts the common forms of a repository URL', () => {
    const expected = { owner: 'acme', repo: 'demo-app', cloneUrl: 'https://github.com/acme/demo-app.git', name: 'acme__demo-app' };
    expect(parseGitHubUrl('https://github.com/acme/demo-app')).toEqual(expected);
    expect(parseGitHubUrl('  https://github.com/acme/demo-app.git  ')).toEqual(expected);
    expect(parseGitHubUrl('https://github.com/acme/demo-app/')).toEqual(expected);
    expect(parseGitHubUrl('github.com/acme/demo-app')).toEqual(expected);
    expect(parseGitHubUrl('https://www.github.com/acme/demo.js').repo).toBe('demo.js');
  });

  it('refuses everything else', () => {
    for (const bad of [
      '',
      'https://gitlab.com/acme/demo',
      'https://github.com/acme',
      'https://github.com/acme/demo/tree/main',
      'http://github.com/acme/demo',
      'https://github.com.evil.test/acme/demo',
      'https://github.com/acme/demo; rm -rf .',
      'https://github.com/../demo',
      'https://github.com/acme/..',
      'https://github.com/acme/--upload-pack=x',
      'file:///etc/passwd',
      '../../somewhere',
    ]) {
      expect(() => parseGitHubUrl(bad), bad).toThrow(WorkspaceUrlError);
    }
  });
});

describe('cloneWorkspace', () => {
  let home: string;
  let source: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-ws-home-'));
    source = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-ws-src-'));
    const git = simpleGit(source);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.com');
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'demo-app', scripts: { test: 'vitest run' } }));
    await git.add('.');
    await git.commit('first commit');
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(source, { recursive: true, force: true });
  });

  it('clones into workspaces/<owner>__<repo> and initialises the intent layer', async () => {
    const { workspace, cloned } = await cloneWorkspace('https://github.com/acme/demo-app', { home, source });
    expect(cloned).toBe(true);
    expect(workspace.name).toBe('acme__demo-app');
    expect(workspace.root).toBe(path.join(home, 'workspaces', 'acme__demo-app'));
    expect(workspace.lastCommit?.message).toBe('first commit');
    expect(workspace.specs).toBe(0);

    const config = JSON.parse(await fs.readFile(path.join(workspace.root, '.intent', 'config.json'), 'utf8'));
    expect(config.projectName).toBe('demo-app');
    expect(config.commands.test).toBeDefined();
    // Agent configs and rule files are not written into a cloned repository
    await expect(fs.access(path.join(workspace.root, '.mcp.json'))).rejects.toThrow();
    await expect(fs.access(path.join(workspace.root, 'AGENTS.md'))).rejects.toThrow();

    expect((await listWorkspaces(home)).map(w => w.name)).toEqual(['acme__demo-app']);
    expect(await resolveWorkspace('acme__demo-app', home)).toBe(workspace.root);
  });

  it('keeps an existing clone and its local changes', async () => {
    const first = await cloneWorkspace('https://github.com/acme/demo-app', { home, source });
    await fs.writeFile(path.join(first.workspace.root, 'notes.txt'), 'local work');
    const second = await cloneWorkspace('https://github.com/acme/demo-app.git', { home, source });
    expect(second.cloned).toBe(false);
    expect(await fs.readFile(path.join(second.workspace.root, 'notes.txt'), 'utf8')).toBe('local work');
  });

  it('leaves nothing behind when the clone fails', async () => {
    const missing = path.join(source, 'does-not-exist');
    await expect(cloneWorkspace('https://github.com/acme/gone', { home, source: missing })).rejects.toThrow(WorkspaceCloneError);
    expect(await listWorkspaces(home)).toEqual([]);
    expect(await fs.readdir(path.join(home, 'workspaces'))).toEqual([]);
  });

  it('refuses a bad URL before touching the disk', async () => {
    await expect(cloneWorkspace('https://example.com/acme/demo', { home, source })).rejects.toThrow(WorkspaceUrlError);
    await expect(fs.access(path.join(home, 'workspaces'))).rejects.toThrow();
  });

  it('remembers the active workspace only while its folder exists', async () => {
    expect(await readActiveWorkspace(home)).toBeUndefined();
    const { workspace } = await cloneWorkspace('https://github.com/acme/demo-app', { home, source });
    await writeActiveWorkspace(workspace.name, home);
    expect(await readActiveWorkspace(home)).toBe('acme__demo-app');
    expect((await listWorkspaces(home)).map(w => w.name)).toEqual(['acme__demo-app']);

    await fs.rm(workspace.root, { recursive: true, force: true });
    expect(await readActiveWorkspace(home)).toBeUndefined();
    await writeActiveWorkspace(null, home);
    expect(await resolveWorkspace('../outside', home)).toBeUndefined();
    expect(await resolveWorkspace('.active.json', home)).toBeUndefined();
  });
});
