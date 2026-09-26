import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpecStore, type IntentSpec } from '@intentguard/core';
import { createApp } from '../src/app.js';

describe('IntentGuard API', () => {
  let rootDir: string;
  let app: ReturnType<typeof createApp>;

  const spec: IntentSpec = {
    id: 'intent-test1',
    status: 'draft',
    objective: 'Let travellers pick a cabin seat before paying for the booking.',
    outcomes: ['Seat map shows 0 double-booked seats'],
    scope: { inScope: ['src/booking/**'], outOfScope: ['src/billing/**'] },
    createdAt: 100,
  };

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-api-'));
    const store = new SpecStore(rootDir);
    await store.init();
    await store.save(spec);
    await store.setActive(spec.id);
    app = createApp(rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('lists specs with readiness scores and the active flag', async () => {
    const res = await app.request('/api/specs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: spec.id, active: true });
    expect(typeof body[0].readinessScore).toBe('number');
  });

  it('returns a spec and its readiness gates', async () => {
    expect(await (await app.request(`/api/specs/${spec.id}`)).json()).toMatchObject({ id: spec.id });
    const readiness = await (await app.request(`/api/specs/${spec.id}/readiness`)).json();
    expect(readiness.gates).toHaveLength(6);
  });

  it('returns 404 for unknown specs and 400 for path-like ids', async () => {
    expect((await app.request('/api/specs/nope')).status).toBe(404);
    expect((await app.request('/api/specs/..%2Fconfig')).status).toBe(400);
  });

  it('checks a file against the scope fence', async () => {
    const check = (filePath: string) =>
      app.request(`/api/specs/${spec.id}/scope-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
    expect(await (await check('src/booking/seats.ts')).json()).toMatchObject({ allowed: true });
    expect(await (await check('src/billing/pay.ts')).json()).toMatchObject({ allowed: false });
  });

  it('rejects spec creation without a request', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('reports agent integration status', async () => {
    const agents = await (await app.request('/api/agents')).json();
    expect(agents.map((a: { id: string }) => a.id)).toEqual(['claude', 'cursor', 'codex', 'bob']);
    expect(agents.every((a: { mcpConfigured: boolean }) => !a.mcpConfigured)).toBe(true);
  });
});
