import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpecStore, type ChatModel, type ChatResponse, type IntentSpec } from '@intentguard/core';
import { createApp } from '../src/app.js';

class ScriptedModel implements ChatModel {
  readonly id = 'fake/scripted';
  constructor(private steps: ChatResponse[]) {}
  async chat(): Promise<ChatResponse> {
    return this.steps.shift() ?? { message: { content: 'done' } };
  }
}

const json = (body: unknown, extra: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body),
});

/** Parses an SSE body into [event, data] pairs. */
function parseSse(text: string): Array<{ event: string; data: any }> {
  return text
    .split(/\n\n/)
    .filter(Boolean)
    .map(block => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return { event, data: data ? JSON.parse(data) : undefined };
    });
}

const READY: IntentSpec = {
  id: 'intent-chat1',
  status: 'draft',
  objective: 'Let travellers pick a cabin seat before paying for the booking.',
  outcomes: ['Seat map lists every free seat for the chosen flight'],
  evidence: [{ id: 'ev-1', type: 'request', excerpt: 'add seat selection' }],
  scope: { inScope: ['src/booking/**'], outOfScope: ['src/billing/**'] },
  edgeCases: [{ scenario: 'Seat taken meanwhile', expectedBehavior: 'Show an error' }],
  verification: ['Unit tests for seat locking'],
};

describe('chat API', () => {
  let rootDir: string;
  let script: ChatResponse[];

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-chat-'));
    await fs.mkdir(path.join(rootDir, 'src', 'billing'), { recursive: true });
    await fs.writeFile(path.join(rootDir, 'src', 'billing', 'pay.ts'), 'export {};\n');
    script = [];
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const makeApp = () => createApp(rootDir, { createChatModel: () => new ScriptedModel(script), allowedOrigins: ['http://localhost:3847'] });

  it('streams agent events over SSE, with blocked edits visible to the client', async () => {
    script.push(
      { message: { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'write_file', arguments: '{"path":"src/billing/pay.ts","content":"x"}' } }] } },
      { message: { content: 'That file is outside the scope.' } }
    );
    const app = makeApp();
    const session = await (await app.request('/api/chat', json({}))).json();
    expect(session).toMatchObject({ harness: true, model: 'fake/scripted', spec: null });

    const res = await app.request(`/api/chat/${session.id}/messages`, json({ message: 'change billing' }));
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const events = parseSse(await res.text());
    const types = events.map(e => e.event);
    expect(types).toEqual(['tool_call', 'tool_result', 'assistant', 'metrics', 'done']);
    expect(events[1].data).toMatchObject({ blocked: 'no-spec', ok: false });
    expect(events[3].data.metrics.blocked['no-spec']).toBe(1);
  });

  it('approves a ready spec through the API and refuses when harness is off', async () => {
    const store = new SpecStore(rootDir);
    await store.save(READY);
    await store.setActive(READY.id);
    const app = makeApp();

    const on = await (await app.request('/api/chat', json({ harness: true }))).json();
    const approved = await app.request(`/api/chat/${on.id}/approve`, json({}));
    expect(approved.status).toBe(200);
    expect((await approved.json()).spec).toMatchObject({ id: READY.id, approved: true });

    const off = await (await app.request('/api/chat', json({ harness: false }))).json();
    expect((await app.request(`/api/chat/${off.id}/approve`, json({}))).status).toBe(409);
  });

  it('returns 503 with a setup hint when the model is not configured', async () => {
    const app = createApp(rootDir, {
      createChatModel: () => {
        throw new Error('IBM watsonx is not configured: set WATSONX_API_KEY');
      },
    });
    const res = await app.request('/api/chat', json({}));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/WATSONX_API_KEY/);
  });

  it('returns 404 for unknown sessions and 400 for empty messages', async () => {
    const app = makeApp();
    expect((await app.request('/api/chat/run-nope/messages', json({ message: 'hi' }))).status).toBe(404);
    const session = await (await app.request('/api/chat', json({}))).json();
    expect((await app.request(`/api/chat/${session.id}/messages`, json({ message: '  ' }))).status).toBe(400);
  });

  it('rejects foreign origins, non-local hosts, and non-JSON posts', async () => {
    const app = makeApp();
    expect((await app.request('/api/chat', json({}, { Origin: 'https://evil.example' }))).status).toBe(403);
    expect((await app.request('http://attacker.example/api/specs')).status).toBe(403);
    const plain = await app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    expect(plain.status).toBe(415);
    const allowed = await app.request('/api/chat', json({}, { Origin: 'http://localhost:3847' }));
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3847');
  });
});
