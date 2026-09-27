import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpecStore, type ChatModel, type IntentSpec } from '@intentguard/core';
import { createApp } from '../src/app.js';

const spec = (id: string): IntentSpec => ({
  id,
  status: 'draft',
  objective: 'Let travellers pick a cabin seat before paying for the booking.',
  outcomes: ['Seat map shows 0 double-booked seats'],
});

describe('workspaces API', () => {
  let home: string;
  let startRoot: string;
  let cloned: string;
  let app: ReturnType<typeof createApp>;

  const post = (url: string, body: unknown) =>
    app.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-ws-api-'));
    startRoot = path.join(home, 'start');
    cloned = path.join(home, 'workspaces', 'acme__demo');
    await fs.mkdir(startRoot, { recursive: true });
    await fs.mkdir(cloned, { recursive: true });
    await new SpecStore(startRoot).save(spec('intent-start'));
    await new SpecStore(cloned).save(spec('intent-cloned'));
    const model: ChatModel = { id: 'fake', chat: async () => ({ message: { content: 'ok' } }) };
    app = createApp(startRoot, { home, createChatModel: () => model });
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  const specIds = async () => ((await (await app.request('/api/specs')).json()) as IntentSpec[]).map(s => s.id);

  it('lists cloned repositories and the start repository', async () => {
    const body = await (await app.request('/api/workspaces')).json();
    expect(body.active).toBeNull();
    expect(body.start.root).toBe(startRoot);
    expect(body.current.root).toBe(startRoot);
    expect(body.workspaces.map((w: { name: string }) => w.name)).toEqual(['acme__demo']);
    expect(body.workspaces[0].specs).toBe(1);
  });

  it('switches every endpoint to the chosen repository and back', async () => {
    expect(await specIds()).toEqual(['intent-start']);

    const switched = await post('/api/workspaces/activate', { name: 'acme__demo' });
    expect(switched.status).toBe(200);
    expect((await switched.json()).active).toBe('acme__demo');
    expect(await specIds()).toEqual(['intent-cloned']);
    expect((await app.request('/api/specs/intent-start')).status).toBe(404);

    // Survives a restart: the choice is written next to the clones
    const saved = JSON.parse(await fs.readFile(path.join(home, 'workspaces', '.active.json'), 'utf8'));
    expect(saved.name).toBe('acme__demo');

    expect((await (await post('/api/workspaces/activate', { name: null })).json()).active).toBeNull();
    expect(await specIds()).toEqual(['intent-start']);
  });

  it('drops chat sessions of the previous repository', async () => {
    const session = await (await post('/api/chat', { harness: false })).json();
    expect((await app.request(`/api/chat/${session.id}`)).status).toBe(200);
    await post('/api/workspaces/activate', { name: 'acme__demo' });
    expect((await app.request(`/api/chat/${session.id}`)).status).toBe(404);
  });

  it('refuses unknown workspaces and names that escape the folder', async () => {
    expect((await post('/api/workspaces/activate', { name: 'nope' })).status).toBe(404);
    expect((await post('/api/workspaces/activate', { name: '../start' })).status).toBe(404);
    expect((await post('/api/workspaces/activate', { name: '.active.json' })).status).toBe(404);
    expect(await specIds()).toEqual(['intent-start']);
  });

  it('refuses anything but a GitHub repository URL, without cloning', async () => {
    for (const url of ['', 'https://gitlab.com/acme/demo', 'https://github.com/acme/demo/tree/main', 'https://github.com/acme/x; echo hi']) {
      const res = await post('/api/workspaces', { url });
      expect(res.status, url).toBe(400);
    }
    expect((await fs.readdir(path.join(home, 'workspaces'))).sort()).toEqual(['acme__demo']);
  });
});
