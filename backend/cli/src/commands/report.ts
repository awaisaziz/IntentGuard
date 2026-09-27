import { SpecStore, getRepoRoot, proofReportToMarkdown, verify, generateProofReport } from '@intentguard/core';
import { error, header } from '../ui/formatters.js';
import { withSpinner } from '../ui/spinner.js';
import { formatCommandError } from './mcp-setup.js';

/**
 * Prints the proof report for a spec.
 * @param specId Optional ID of the spec (defaults to active)
 */
export async function reportCommand(specId?: string): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    const store = new SpecStore(repoRoot);
    
    const spec = specId ? await store.load(specId) : await store.loadActive();
    if (!spec) {
      throw new Error(specId ? `Spec ${specId} not found.` : 'No active spec found.');
    }
    
    console.log(header(`Generating Proof Report for ${spec.id}`));
    
    const verification = await withSpinner('Running verification...', async () => {
      return await verify(repoRoot, spec);
    });
    
    const { report } = await store.saveReport(generateProofReport(spec.id, verification));
    
    console.log(proofReportToMarkdown(report));
    
  } catch (err) {
    console.error(error(`Failed to generate report: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
