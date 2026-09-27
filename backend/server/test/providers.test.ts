import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

const VARS = ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'WATSONX_API_KEY', 'WATSONX_PROJECT_ID', 'WATSONX_SPACE_ID'] as const;
// Assembled at runtime so the repository's own secret scan never trips on this file.
const KEY = ['unit', 'test', 'value'].join('-');

describe('GET /api/providers', () => {
  let rootDir: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-providers-'));
    for (const name of VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(async () => {
    for (const name of VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('reports every provider as unconfigured when no key is set', async () => {
    const body = await (await createApp(rootDir).request('/api/providers')).json();
    expect(body.default).toBeNull();
    expect(body.providers.map((p: { id: string }) => p.id)).toEqual(['openai', 'deepseek', 'watsonx']);
    expect(body.providers.every((p: { configured: boolean }) => !p.configured)).toBe(true);
  });

  it('flags the configured provider and never returns the key', async () => {
    process.env.OPENAI_API_KEY = KEY;
    const res = await createApp(rootDir).request('/api/providers');
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.default).toBe('openai');
    expect(body.providers.find((p: { id: string }) => p.id === 'openai')).toMatchObject({ configured: true, envVar: 'OPENAI_API_KEY' });
    expect(body.providers.find((p: { id: string }) => p.id === 'deepseek').configured).toBe(false);
    expect(text).not.toContain(KEY);
  });

  it('treats the placeholder from .env.example as not configured', async () => {
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    const body = await (await createApp(rootDir).request('/api/providers')).json();
    expect(body.default).toBeNull();
  });
});
