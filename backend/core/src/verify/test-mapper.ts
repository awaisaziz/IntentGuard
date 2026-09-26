import path from 'node:path';
import fs from 'node:fs/promises';
import type { OutcomeCheck } from '../schema/intentspec.js';

export async function findRelatedTests(repoRoot: string, changedFiles: string[]): Promise<string[]> {
  const relatedTests: Set<string> = new Set();
  
  for (const file of changedFiles) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const dir = path.dirname(file);
    
    // Naive heuristic: look for file.test.ts or file.spec.ts in same dir
    const testCandidates = [
      path.join(dir, `${base}.test${ext}`),
      path.join(dir, `${base}.spec${ext}`),
      path.join(dir, '__tests__', `${base}.test${ext}`),
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
