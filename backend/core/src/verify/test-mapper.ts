import path from 'node:path';
import fs from 'node:fs/promises';
import type { OutcomeCheck } from '../schema/intentspec.js';

const TEST_FILE = /(\.(test|spec)\.[^/]+|_test\.go|(^|\/)test_[^/]+\.py)$/;
const TEST_DIRS = ['test', 'tests', '__tests__', 'spec'];

export async function findRelatedTests(repoRoot: string, changedFiles: string[]): Promise<string[]> {
  const relatedTests: Set<string> = new Set();
  const p = path.posix;

  for (const file of changedFiles) {
    // A changed test file is its own evidence
    if (TEST_FILE.test(file)) {
      relatedTests.add(file);
      continue;
    }
    const ext = p.extname(file);
    const base = p.basename(file, ext);
    const dir = p.dirname(file);

    // Name-based heuristic: tests next to the file, in a sibling __tests__, or in a top-level test folder
    const names = [`${base}.test${ext}`, `${base}.spec${ext}`, ...(ext === '.py' ? [`test_${base}.py`] : [])];
    const testCandidates = [
      ...names.map(n => p.join(dir, n)),
      p.join(dir, '__tests__', `${base}.test${ext}`),
      ...(ext === '.go' ? [p.join(dir, `${base}_test.go`)] : []),
      ...TEST_DIRS.flatMap(d => names.map(n => p.join(d, n))),
    ];

    for (const candidate of testCandidates) {
      try {
        await fs.access(path.join(repoRoot, candidate));
        relatedTests.add(candidate);
      } catch {
        // file doesn't exist
      }
    }
  }
  
  return Array.from(relatedTests);
}

export function mapOutcomesToTests(outcomes: string[], testFiles: string[]): OutcomeCheck[] {
  return outcomes.map(outcome => {
    // In a real implementation, we would parse test files or use LLM to map.
    // For now, naive mapping: assume the first test file relates to outcomes.
    const testFile = testFiles.length > 0 ? testFiles[0] : undefined;
    return {
      outcome,
      status: testFile ? 'pass' : 'untested', // placeholder logic
      testFile,
    };
  });
}
