import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findRelatedTests } from '../src/verify/test-mapper.js';

describe('findRelatedTests', () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-tests-'));
    const files = ['src/booking/seats.js', 'test/seats.test.js', 'src/pay/card.ts', 'src/pay/card.spec.ts', 'app/models.py', 'tests/test_models.py'];
    for (const f of files) {
      await fs.mkdir(path.join(root, path.dirname(f)), { recursive: true });
      await fs.writeFile(path.join(root, f), '');
    }
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('finds tests next to the file and in top-level test folders, as POSIX paths', async () => {
    const tests = await findRelatedTests(root, ['src/booking/seats.js', 'src/pay/card.ts', 'app/models.py']);
    expect(tests.sort()).toEqual(['src/pay/card.spec.ts', 'test/seats.test.js', 'tests/test_models.py']);
  });

  it('counts a changed test file as related', async () => {
    expect(await findRelatedTests(root, ['test/seats.test.js'])).toEqual(['test/seats.test.js']);
  });
});
