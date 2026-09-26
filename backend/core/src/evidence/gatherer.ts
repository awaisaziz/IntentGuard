import type { GatheredEvidence } from '../schema/intentspec.js';
import { getChangedFiles, getStagedFiles } from '../utils/git.js';
import { findRelatedTests } from '../verify/test-mapper.js';

export async function gatherEvidence(repoRoot: string, rawRequest: string): Promise<GatheredEvidence> {
  const staged = await getStagedFiles(repoRoot);
  const changed = await getChangedFiles(repoRoot);
  const affectedFiles = Array.from(new Set([...staged, ...changed]));
  
  const relatedTests = await findRelatedTests(repoRoot, affectedFiles);
  
  return {
    affectedFiles,
    relatedTests,
    relatedDocs: ['README.md'], // placeholder logic
    currentBehavior: 'No current behavior analysis extracted yet.' // placeholder logic
  };
}
