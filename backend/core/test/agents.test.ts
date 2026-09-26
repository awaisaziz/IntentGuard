import { describe, it, expect } from 'vitest';
import {
  AGENT_INTEGRATIONS,
  isIntentGuardManaged,
  mcpLaunch,
  renderMcpConfig,
  renderRulesFile,
  RULES_BLOCK_START,
  RULES_BLOCK_END,
} from '../src/agents/registry.js';

describe('renderRulesFile', () => {
  it('creates a file containing only the managed block', () => {
    expect(renderRulesFile('rules v1')).toBe(`${RULES_BLOCK_START}\nrules v1\n${RULES_BLOCK_END}\n`);
  });

  it('appends the block to hand-written content', () => {
    const result = renderRulesFile('rules v1', '# My project\n\nNotes.\n');
    expect(result.startsWith('# My project\n\nNotes.\n\n')).toBe(true);
    expect(result).toContain('rules v1');
  });

  it('refreshes only the block and keeps surrounding content', () => {
    const before = renderRulesFile('rules v1', '# Top\n') + '\n## Bottom\n';
    const after = renderRulesFile('rules v2', before);
    expect(after).toContain('# Top');
    expect(after).toContain('## Bottom');
    expect(after).toContain('rules v2');
    expect(after).not.toContain('rules v1');
    expect(renderRulesFile('rules v2', after)).toBe(after);
  });

  it('recognizes blocks written with an older marker wording', () => {
    const old = '<!-- intentguard:start (managed by `intent agents setup`, edits inside are overwritten) -->\nold\n<!-- intentguard:end -->\n';
    const result = renderRulesFile('new', old);
    expect(result).not.toContain('old');
    expect(result.match(/intentguard:start/g)).toHaveLength(1);
  });
});

describe('mcpLaunch', () => {
  it('launches the built server with node and pins the guarded repo', () => {
    const launch = mcpLaunch('C:\\tools\\IntentGuard\\mcp\\dist\\index.js', 'D:\\work\\booking-app');
    expect(launch).toEqual({
      command: 'node',
      args: ['C:/tools/IntentGuard/mcp/dist/index.js'],
      env: { INTENT_ROOT: 'D:/work/booking-app' },
    });
  });
});

describe('renderMcpConfig', () => {
  const launch = mcpLaunch('/opt/intentguard/mcp/dist/index.js', '/srv/app');

  it('adds intentguard to JSON config without dropping other servers', () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: 'foo' } } });
    const result = JSON.parse(renderMcpConfig('json', launch, existing));
    expect(result.mcpServers.other).toEqual({ command: 'foo' });
    expect(result.mcpServers.intentguard).toEqual(launch);
  });

  it('keeps unrelated settings in the same JSON file (e.g. Gemini settings)', () => {
    const existing = JSON.stringify({ theme: 'dark', mcpServers: {} });
    expect(JSON.parse(renderMcpConfig('json', launch, existing)).theme).toBe('dark');
  });

  it('replaces an existing intentguard TOML table, including sub-tables, and keeps the rest', () => {
    const existing = [
      'model = "o3"',
      '',
      '[mcp_servers.intentguard]',
      'command = "old"',
      'args = ["stale"]',
      '',
      '[mcp_servers.intentguard.env]',
      'INTENT_ROOT = "stale-root"',
      '',
      '[mcp_servers.other]',
      'command = "foo"',
    ].join('\n');
    const result = renderMcpConfig('toml', launch, existing);
    expect(result).toContain('model = "o3"');
    expect(result).toContain('[mcp_servers.other]\ncommand = "foo"');
    expect(result).not.toContain('stale');
    expect(result.match(/\[mcp_servers\.intentguard\]/g)).toHaveLength(1);
    expect(result).toContain('env = { INTENT_ROOT = "/srv/app" }');
  });

  it('escapes Windows paths correctly in TOML', () => {
    const win = { command: 'node', args: ['C:\\x\\index.js'], env: { INTENT_ROOT: 'D:\\y' } };
    expect(renderMcpConfig('toml', win)).toContain('args = ["C:\\\\x\\\\index.js"]');
  });

  it('is idempotent', () => {
    const once = renderMcpConfig('toml', launch);
    expect(renderMcpConfig('toml', launch, once)).toBe(once);
    const json = renderMcpConfig('json', launch);
    expect(renderMcpConfig('json', launch, json)).toBe(json);
  });
});

describe('agent registry', () => {
  it('covers Claude Code, Bob, Codex, Gemini CLI, Antigravity, and Cursor', () => {
    expect(AGENT_INTEGRATIONS.map(a => a.id)).toEqual(['claude', 'bob', 'codex', 'gemini', 'antigravity', 'cursor']);
  });

  it('puts Bob rules in .bob/rules/ where Bob loads them', () => {
    const bob = AGENT_INTEGRATIONS.find(a => a.id === 'bob')!;
    expect(bob.rules.map(r => r.path)).toContain('.bob/rules/intentguard.md');
  });

  it('treats IntentGuard state and generated agent files as managed', () => {
    for (const f of ['.intent/specs/a.json', '.mcp.json', '.bob/mcp.json', '.agents/mcp_config.json', 'GEMINI.md', 'AGENTS.md']) {
      expect(isIntentGuardManaged(f)).toBe(true);
    }
    expect(isIntentGuardManaged('src/booking/seats.ts')).toBe(false);
  });
});
