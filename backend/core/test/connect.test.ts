import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { connectRepo } from '../src/workflow/connect.js';
import { detectProjectCommands } from '../src/workflow/checks.js';

describe('connectRepo', () => {
  let root: string;
  const serverEntry = path.join(os.tmpdir(), 'intentguard-home', 'mcp', 'dist', 'index.js');

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-connect-'));
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'booking-app', scripts: { test: 'vitest run', lint: 'eslint .' } })
    );
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), '');
    await simpleGit(root).init();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('initializes .intent, wires every agent to this checkout, and keeps configs out of git', async () => {
    const result = await connectRepo(path.join(root), { serverEntry });

    expect(result.initialized).toBe(true);
    expect(result.commands).toEqual({ test: 'pnpm test', lint: 'pnpm run lint' });
    expect(result.mcpConfigs).toEqual(['.mcp.json', '.bob/mcp.json', '.codex/config.toml', '.gemini/settings.json', '.agents/mcp_config.json', '.cursor/mcp.json']);
    expect(result.rules).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.bob/rules/intentguard.md']));

    const claude = JSON.parse(await fs.readFile(path.join(root, '.mcp.json'), 'utf8'));
    expect(claude.mcpServers.intentguard.command).toBe('node');
    expect(claude.mcpServers.intentguard.args[0]).toMatch(/intentguard-home\/mcp\/dist\/index\.js$/);
    expect(claude.mcpServers.intentguard.env.INTENT_ROOT).toBe(result.root.replace(/\\/g, '/'));

    const toml = await fs.readFile(path.join(root, '.codex', 'config.toml'), 'utf8');
    expect(toml).toContain('[mcp_servers.intentguard]');
    expect(await fs.readFile(path.join(root, 'GEMINI.md'), 'utf8')).toContain('@./AGENTS.md');

    // Machine-specific files are ignored locally; shareable rule files are not
    const git = simpleGit(root);
    const status = await git.status(['--untracked-files=all']);
    const untracked = status.not_added;
    expect(untracked).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.intent/config.json']));
    for (const local of ['.mcp.json', '.bob/mcp.json', '.codex/config.toml', '.gemini/settings.json', '.agents/mcp_config.json', '.cursor/mcp.json']) {
      expect(untracked).not.toContain(local);
    }
    expect(result.trackedWarnings).toEqual([]);
  });

  it('is idempotent and preserves existing config and exclude entries', async () => {
    await connectRepo(root, { serverEntry });
    const config = path.join(root, '.intent', 'config.json');
    const raw = JSON.parse(await fs.readFile(config, 'utf8'));
    raw.readinessThreshold = 80;
    raw.commands = { test: 'make test' };
    await fs.writeFile(config, JSON.stringify(raw));

    const second = await connectRepo(root, { serverEntry });
    expect(second.initialized).toBe(false);
    expect(second.commands).toEqual({ test: 'make test' });
    expect(second.excluded).toEqual([]);
    expect(JSON.parse(await fs.readFile(config, 'utf8')).readinessThreshold).toBe(80);
    const agentsMd = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd.match(/intentguard:start/g)).toHaveLength(1);
  });

  it('warns when a machine-specific file is already tracked', async () => {
    await fs.writeFile(path.join(root, '.mcp.json'), '{"mcpServers":{}}');
    const git = simpleGit(root);
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.com');
    await git.add('.mcp.json');
    await git.commit('team mcp config');
    const result = await connectRepo(root, { serverEntry });
    expect(result.trackedWarnings).toEqual(['.mcp.json']);
  });

  it('refuses a path that is not a directory', async () => {
    await expect(connectRepo(path.join(root, 'missing'), { serverEntry })).rejects.toThrow(/Not a directory/);
  });
});

describe('detectProjectCommands', () => {
  it('ignores the npm placeholder test script and falls back to other ecosystems', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-detect-'));
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }));
    await fs.writeFile(path.join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    expect(await detectProjectCommands(dir)).toEqual({ test: 'python -m pytest -q' });
    await fs.rm(dir, { recursive: true, force: true });
  });
});
