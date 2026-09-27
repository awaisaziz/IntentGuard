import { SpecStore, getRepoRoot, verify } from '@intentguard/core';
import { withSpinner } from '../ui/spinner.js';
import { formatVerification, error, header } from '../ui/formatters.js';
import { formatCommandError } from './mcp-setup.js';

/**
 * Verifies the current changes against the specified spec.
 * @param specId Optional ID of the spec to verify against (defaults to active)
 */
export async function verifyCommand(specId?: string): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    const store = new SpecStore(repoRoot);
    
    const spec = specId ? await store.load(specId) : await store.loadActive();
    if (!spec) {
      throw new Error(specId ? `Spec ${specId} not found.` : 'No active spec found.');
    }
    
    console.log(header(`Verifying changes against ${spec.id}`));
    const result = await withSpinner('Verifying changes against spec...', async () => {
      return await verify(repoRoot, spec);
    });
    
    console.log(formatVerification(result));
    
    if (!result.passed) {
      process.exit(1);
    }
  } catch (err) {
    console.error(error(`Verification failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
