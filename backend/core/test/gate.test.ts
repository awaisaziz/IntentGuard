import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkEditAllowed, repoRelativePath } from '../src/scope/gate.js';
import { updateSpec } from '../src/workflow/update.js';
import { SpecStore } from '../src/store/spec-store.js';
import type { IntentSpec } from '../src/schema/intentspec.js';

const DRAFT: IntentSpec = {
  id: 'intent-gate1',
  status: 'draft',
  objective: 'add seat selection',
  rawRequest: 'add seat selection',
  outcomes: [],
  evidence: [{ id: 'ev-1', type: 'request', excerpt: 'add seat selection' }],
};

describe('checkEditAllowed', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-gate-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('maps absolute paths into the repository and rejects paths outside it', () => {
    expect(repoRelativePath(root, path.join(root, 'src', 'a.ts'))).toBe('src/a.ts');
    expect(repoRelativePath(root, 'src/a.ts')).toBe('src/a.ts');
    expect(repoRelativePath(root, path.join(root, '..', 'elsewhere.ts'))).toBeNull();
  });

  it('walks a vague request through the gate: no spec, not ready, answers recorded, then scope', async () => {
    const target = path.join(root, 'src', 'booking', 'seats.ts');
    expect((await checkEditAllowed(root, target)).code).toBe('no-spec');

    const store = new SpecStore(root);
    await store.save(DRAFT);
    await store.setActive(DRAFT.id);
    const blocked = await checkEditAllowed(root, target);
    expect(blocked.code).toBe('not-ready');
    expect(blocked.reason).toMatch(/Ask the developer about/);

    // The developer's answers, recorded the way intent_update_spec does it
    const update = await updateSpec(root, {
      objective: 'Let travellers reserve a free cabin seat before payment to cut support calls.',
      outcomes: ['lockSeat() returns the seat number for a free seat'],
      inScope: ['src/booking/**'],
      outOfScope: ['src/billing/**'],
      edgeCases: [{ scenario: 'Seat taken meanwhile', expectedBehavior: 'Return an error' }],
      verification: ['Unit test for lockSeat'],
      evidence: [{ type: 'bogus', excerpt: 'dropped' }, { type: 'metric', excerpt: '24% drop-off at checkout' }],
    });
    expect(update.readiness.ready).toBe(true);
    expect(update.spec.evidence).toHaveLength(2);

    expect(await checkEditAllowed(root, target)).toMatchObject({ allowed: true, file: 'src/booking/seats.ts' });
    const billing = await checkEditAllowed(root, path.join(root, 'src', 'billing', 'pay.ts'));
    expect(billing).toMatchObject({ allowed: false, code: 'out-of-scope' });
    expect((await checkEditAllowed(root, '.intent/specs/intent-gate1.json')).code).toBe('intent-state');
    expect((await checkEditAllowed(root, path.join(root, '..', 'x.ts'))).code).toBe('outside-repo');
  });

  it('sends an approved spec back to draft when it changes', async () => {
    const store = new SpecStore(root);
    await store.save({ ...DRAFT, status: 'approved' });
    await store.setActive(DRAFT.id);
    const result = await updateSpec(root, { outcomes: ['Seat map lists 12 free seats'] });
    expect(result.approvalReset).toBe(true);
    expect(result.spec.status).toBe('draft');
    await expect(updateSpec(root, { nonsense: true })).rejects.toThrow(/No valid spec fields/);
  });
});
