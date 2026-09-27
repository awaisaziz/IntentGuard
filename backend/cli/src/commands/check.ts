import { SpecStore, getRepoRoot, computeReadiness } from '@intentguard/core';
import { formatReadiness, error } from '../ui/formatters.js';
import { formatCommandError } from './mcp-setup.js';

/**
 * Checks the readiness of an IntentSpec.
 * @param specId Optional ID of the spec to check (defaults to active)
 */
export async function checkCommand(specId?: string): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    const store = new SpecStore(repoRoot);
    
    const spec = specId ? await store.load(specId) : await store.loadActive();
    if (!spec) {
      throw new Error(specId ? `Spec ${specId} not found.` : 'No active spec found.');
    }
    
    const score = computeReadiness(spec);
    console.log(formatReadiness(score));
  } catch (err) {
    console.error(error(`Check failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
