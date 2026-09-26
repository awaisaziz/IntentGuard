import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createIntentGuardServer } from '../src/server.js';

/** Text of every content item a tool returned. */
const text = (result: any): string => result.content.map((c: { text: string }) => c.text).join('\n');

describe('IntentGuard MCP server', () => {
  let root: string;
  let client: Client;
  const savedKey = process.env.WATSONX_API_KEY;

  beforeEach(async () => {
    delete process.env.WATSONX_API_KEY;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-mcp-'));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createIntentGuardServer(root).connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    if (savedKey !== undefined) process.env.WATSONX_API_KEY = savedKey;
    await fs.rm(root, { recursive: true, force: true });
  });

  it('exposes the nine intent tools and lifecycle instructions', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'intent_check_scope',
      'intent_create',
      'intent_gather_evidence',
      'intent_get_spec',
      'intent_questions',
      'intent_readiness',
      'intent_report',
      'intent_update_spec',
      'intent_verify',
    ]);
    expect(client.getInstructions()).toMatch(/Never fill gaps with assumptions/);
  });

  it('runs the clarify loop: vague request → questions → answers → ready → scope fence', async () => {
    const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });

    const created = text(await call('intent_create', { request: 'improve the booking flow' }));
    expect(created).toMatch(/Next: call intent_gather_evidence/);

    const questions = text(await call('intent_questions'));
    expect(questions).toMatch(/Ask the developer these before writing any code/);
    expect(questions).toContain('only restates the request');

    const seats = path.join(root, 'src', 'booking', 'seats.ts');
    expect(text(await call('intent_check_scope', { filePath: seats }))).toMatch(/^BLOCKED: src\/booking\/seats\.ts: Spec .* below the 70 readiness threshold/);
    expect(text(await call('intent_readiness'))).toMatch(/BLOCKED: do not write code/);

    const updated = text(
      await call('intent_update_spec', {
        objective: 'Let travellers reserve a free cabin seat before payment to cut support calls.',
        outcomes: ['lockSeat() returns the seat number for a free seat'],
        inScope: ['src/booking/**'],
        outOfScope: ['src/billing/**'],
        edgeCases: [{ scenario: 'Seat taken meanwhile', expectedBehavior: 'Return an error' }],
        verification: ['Unit test for lockSeat'],
      })
    );
    expect(updated).toMatch(/READY/);

    expect(text(await call('intent_readiness'))).toMatch(/READY: you may start coding/);
    expect(text(await call('intent_check_scope', { filePath: seats }))).toMatch(/^ALLOWED: src\/booking\/seats\.ts/);
    expect(text(await call('intent_check_scope', { filePath: 'src/billing/pay.ts' }))).toMatch(/^BLOCKED: src\/billing\/pay\.ts: .*outside the scope/);
  });

  it('rejects malformed spec updates', async () => {
    await client.callTool({ name: 'intent_create', arguments: { request: 'add seat selection' } });
    const result = await client.callTool({ name: 'intent_update_spec', arguments: { outcomes: [] as string[] } });
    expect(text(result)).toMatch(/Updated outcomes/);
    const bad = await client.callTool({ name: 'intent_update_spec', arguments: {} });
    expect(bad.isError).toBe(true);
  });
});
