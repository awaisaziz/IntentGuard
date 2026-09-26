import { describe, it, expect } from 'vitest';
import { renderMcpConfig, renderRulesFile, RULES_BLOCK_START, RULES_BLOCK_END } from '../src/agents/registry.js';

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
});

describe('renderMcpConfig', () => {
  it('adds intentguard to JSON config without dropping other servers', () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: 'foo' } } });
    const result = JSON.parse(renderMcpConfig('json', existing));
    expect(result.mcpServers.other).toEqual({ command: 'foo' });
    expect(result.mcpServers.intentguard.args).toEqual(['@intentguard/mcp-server']);
  });

  it('replaces an existing intentguard TOML table and keeps the rest', () => {
    const existing = [
      'model = "o3"',
      '',
      '[mcp_servers.intentguard]',
      'command = "old"',
      'args = ["stale"]',
      '',
      '[mcp_servers.other]',
      'command = "foo"',
    ].join('\n');
    const result = renderMcpConfig('toml', existing);
    expect(result).toContain('model = "o3"');
    expect(result).toContain('[mcp_servers.other]\ncommand = "foo"');
    expect(result).not.toContain('stale');
    expect(result.match(/\[mcp_servers\.intentguard\]/g)).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once = renderMcpConfig('toml');
    expect(renderMcpConfig('toml', once)).toBe(once);
    const json = renderMcpConfig('json');
    expect(renderMcpConfig('json', json)).toBe(json);
  });
});
